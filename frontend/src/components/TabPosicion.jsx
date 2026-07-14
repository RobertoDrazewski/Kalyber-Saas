import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fetchAPI } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { X, Gauge, Fuel, Wrench, Hash, Clock, MapPinned, Plus, Trash2, Crosshair, Pencil } from 'lucide-react';
import ErrorBanner from './ErrorBanner';
import { forwardFillSeries } from '../utils/chartFill';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=200&q=60';

function haceCuanto(dateString) {
  if (!dateString) return 'sin datos';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h}h ${min % 60}min`;
}

// MySQL devuelve las columnas DECIMAL (lat/lng) como texto — sin
// convertir a número, Leaflet no dibuja bien ni el marcador ni la
// polilínea, y el mapa "salta" en vez de mostrar un trazo continuo.
function toNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// Sin esto, cada refresco de posición (cada 5s) creaba un ícono
// L.divIcon NUEVO para cada auto, aunque la foto fuera la misma —
// React-Leaflet lo toma como "cambió el ícono" y lo vuelve a pintar,
// generando el parpadeo. Cacheamos por foto: si ya existe, reusamos
// el mismo objeto en vez de crear uno de nuevo.
const iconCache = new Map();
function vehicleIcon(photoUrl) {
  const key = photoUrl || FALLBACK_PHOTO;
  if (iconCache.has(key)) return iconCache.get(key);

  const icon = L.divIcon({
    className: '',
    html: `
      <div style="
        width:44px;height:44px;border-radius:9999px;
        border:3px solid #10B981;
        box-shadow:0 0 12px rgba(0,0,0,0.5);
        background:#0B1120 url('${key}') center/cover no-repeat;
      "></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
  iconCache.set(key, icon);
  return icon;
}

function FlyToVehicle({ vehicle }) {
  const map = useMap();
  const lastFlownId = useRef(null);
  useEffect(() => {
    // OJO: antes esto dependía del objeto "vehicle" completo, que se
    // recrea con una referencia nueva CADA VEZ que refresca la
    // posición (cada 5s) — aunque el auto no haya elegido otro, React
    // volvía a disparar el flyTo, cancelando cualquier arrastre/zoom
    // manual del usuario y generando el parpadeo. Ahora solo vuela
    // cuando cambia el ID del auto seleccionado, no en cada refresco.
    if (!vehicle || vehicle.latNum === null || vehicle.lngNum === null) return;
    if (lastFlownId.current === vehicle.id) return;
    lastFlownId.current = vehicle.id;
    map.flyTo([vehicle.latNum, vehicle.lngNum], 15, { duration: 0.8 });
  }, [vehicle?.id, vehicle?.latNum, vehicle?.lngNum, map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Escucha clicks en el mapa SOLO mientras el usuario está en modo
// "ubicar centro de geocerca" — el resto del tiempo no hace nada, no
// interfiere con el click normal de los markers/popups.
function FenceClickHandler({ active, onPick }) {
  useMapEvents({
    click(e) {
      if (active) onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function TabPosicion() {
  const [vehicles, setVehicles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [series, setSeries] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [alerts, setAlerts] = useState([]);

  // Geocercas del auto seleccionado + estado del flujo de creación.
  const [geofences, setGeofences] = useState([]);
  const [placingFence, setPlacingFence] = useState(false); // true = "tocá el mapa para elegir el centro"
  const [pendingCenter, setPendingCenter] = useState(null); // [lat, lng] ya elegido, esperando confirmar radio/modo
  const [fenceRadius, setFenceRadius] = useState(150);
  const [fenceMode, setFenceMode] = useState('OUT');
  const [fenceName, setFenceName] = useState('');
  const [savingFence, setSavingFence] = useState(false);
  const [fenceError, setFenceError] = useState('');
  const [fenceNotice, setFenceNotice] = useState(''); // aviso benigno (guardado pero sin sync), no es un error real
  const [resyncingId, setResyncingId] = useState(null);
  // [NUEVO 14/07/2026] Edición de geocercas ya creadas — antes solo se
  // podían crear o borrar, no editar nombre/radio/modo.
  const [editingFenceId, setEditingFenceId] = useState(null);

  const load = () => fetchAPI('/vehicles').then(setVehicles).catch(err => setLoadError(err.message));

  // Refresco de posición cada 5s (antes 10s) — con la trayectoria
  // dibujándose de verdad, un refresco más ágil se nota mucho más.
  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  // Geocercas — se cargan de nuevo cada vez que cambia el auto
  // seleccionado. Al deseleccionar, se limpia todo el flujo de
  // creación para no dejar un estado "a medio hacer" colgado.
  const loadGeofences = () => {
    if (!selected) { setGeofences([]); return; }
    fetchAPI(`/geofences/vehicle/${selected.id}`).then(setGeofences).catch(() => setGeofences([]));
  };
  useEffect(() => {
    loadGeofences();
    setPlacingFence(false);
    setPendingCenter(null);
    setFenceError('');
    setFenceNotice('');
    setEditingFenceId(null);
  }, [selected?.id]);

  function startEditFence(f) {
    setEditingFenceId(f.id);
    setPendingCenter([Number(f.lat), Number(f.lng)]);
    setFenceName(f.name || '');
    setFenceRadius(f.radius_m);
    setFenceMode(f.mode);
    setPlacingFence(false);
    setFenceError('');
    setFenceNotice('');
  }

  function cancelFenceForm() {
    setPendingCenter(null);
    setFenceName('');
    setFenceRadius(150);
    setFenceMode('OUT');
    setEditingFenceId(null);
  }

  async function confirmFence() {
    if (!selected || !pendingCenter) return;
    setSavingFence(true);
    setFenceError('');
    setFenceNotice('');
    try {
      const res = editingFenceId
        ? await fetchAPI(`/geofences/${editingFenceId}`, {
            method: 'PUT',
            body: JSON.stringify({
              name: fenceName || null,
              lat: pendingCenter[0],
              lng: pendingCenter[1],
              radius_m: fenceRadius,
              mode: fenceMode,
            }),
          })
        : await fetchAPI('/geofences', {
            method: 'POST',
            body: JSON.stringify({
              vehicle_id: selected.id,
              name: fenceName || null,
              lat: pendingCenter[0],
              lng: pendingCenter[1],
              radius_m: fenceRadius,
              mode: fenceMode,
            }),
          });
      cancelFenceForm();
      setPlacingFence(false);
      // Se guardó bien en los dos casos — esto NO es un error, es un
      // aviso: si el equipo estaba offline, avisamos que hay que
      // reintentar el envío (hay botón para eso en la lista de abajo),
      // pero la geocerca ya está en la base y no hay que crearla de nuevo.
      if (!res.device_synced) setFenceNotice(res.message);
      loadGeofences();
    } catch (err) {
      setFenceError(err.message);
    } finally {
      setSavingFence(false);
    }
  }

  async function resyncFence(id) {
    setResyncingId(id);
    setFenceNotice('');
    setFenceError('');
    try {
      const res = await fetchAPI(`/geofences/${id}/resync`, { method: 'POST' });
      setFenceNotice(res.message);
      loadGeofences();
    } catch (err) {
      setFenceError(err.message);
    } finally {
      setResyncingId(null);
    }
  }

  async function removeFence(id) {
    if (!confirm('¿Borrar esta geocerca? Esto solo la saca del panel — si el equipo la tiene configurada por SMS, hay que desactivarla aparte con FENCE,OFF#.')) return;
    try {
      await fetchAPI(`/geofences/${id}`, { method: 'DELETE' });
      loadGeofences();
    } catch (err) {
      setFenceError(err.message);
    }
  }

  // Alertas de mantenimiento — se muestran en el popup de cada auto.
  // No hace falta refrescarlas tan seguido, cambian mucho menos que la posición.
  useEffect(() => {
    fetchAPI('/maintenance/alerts').then(setAlerts).catch(() => {});
    const interval = setInterval(() => fetchAPI('/maintenance/alerts').then(setAlerts).catch(() => {}), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadSeries = () => {
    if (!selected) return;
    fetchAPI(`/telemetry/vehicle/${selected.id}?limit=120`).then(setSeries).catch(console.error);
  };

  useEffect(() => {
    loadSeries();
    if (!selected) return;
    // El trazo se sigue extendiendo solo mientras el auto seleccionado
    // siga mandando posiciones nuevas, sin tener que volver a elegirlo.
    const interval = setInterval(loadSeries, 5000);
    return () => clearInterval(interval);
  }, [selected]);

  const vehiclesWithCoords = vehicles
    .map(v => ({ ...v, latNum: toNum(v.lat), lngNum: toNum(v.lng) }))
    .filter(v => v.latNum !== null && v.lngNum !== null);

  const selectedVehicleCoord = vehiclesWithCoords.find(v => v.id === selected?.id);

  // Trazo segmentado POR VIAJE — no es una sola línea continua. Se
  // corta cuando el auto queda quieto un rato (baja el pasajero) y
  // arranca un tramo nuevo, de otro color, cuando vuelve a moverse
  // (sube el pasajero siguiente). Misma lógica de "viaje" que usa
  // Histórico (reconstructTrips en el backend), aplicada acá en vivo
  // sobre la ventana reciente de datos.
  const TRAIL_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316'];
  const MOVING_SPEED_KMH = 3;
  const STOP_GAP_MINUTES = 4;

  function segmentTripsForDisplay(rawSeries) {
    const points = rawSeries
      .map(p => ({ lat: toNum(p.lat), lng: toNum(p.lng), speed: toNum(p.speed_kmh), t: p.recorded_at }))
      .filter(p => p.lat !== null && p.lng !== null);

    const segments = [];
    let current = [];
    let lastMovingIdx = -1;

    points.forEach((p, i) => {
      const isMoving = (p.speed ?? 0) > MOVING_SPEED_KMH;
      if (isMoving) {
        current.push([p.lat, p.lng]);
        lastMovingIdx = i;
      } else if (current.length) {
        const minutesSinceMove = (new Date(p.t) - new Date(points[lastMovingIdx].t)) / 60000;
        if (minutesSinceMove > STOP_GAP_MINUTES) {
          if (current.length > 1) segments.push(current);
          current = [];
        } else {
          current.push([p.lat, p.lng]); // semáforo/tráfico corto, sigue el mismo viaje
        }
      }
    });
    if (current.length > 1) segments.push(current); // tramo más reciente (puede seguir en curso)

    return segments;
  }

  const tripSegments = segmentTripsForDisplay(series);

  // FIX: este useMemo estaba antes metido directo adentro del JSX del
  // gráfico (dentro de un bloque "{selected && (...)}"), lo que viola
  // las Reglas de los Hooks — un hook no puede llamarse condicionalmente,
  // porque React cuenta los hooks en el orden en que se ejecutan en cada
  // render, y ese bloque no siempre se ejecuta. Eso tiraba "Rendered more
  // hooks than during the previous render" apenas se deseleccionaba un
  // auto. Ahora se calcula acá arriba, sin condición, y el JSX de abajo
  // solo lo referencia.
  const chartSeries = useMemo(() => forwardFillSeries(series, ['engine_rpm']), [series]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Mapa en Tiempo Real</h2>
      <ErrorBanner message={loadError} />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Lista de autos por patente */}
        <div className="w-full md:w-64 shrink-0 bg-[#1E293B]/30 border border-slate-700 rounded-2xl p-3 h-48 md:h-[500px] overflow-y-auto space-y-2 flex md:block flex-row overflow-x-auto md:overflow-x-visible">
          {vehicles.map(v => (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className={`w-full md:w-full shrink-0 md:shrink flex items-center gap-3 p-2 rounded-xl text-left transition-colors min-w-[160px] md:min-w-0 ${
                selected?.id === v.id ? 'bg-[#6366F1]/20 border border-[#6366F1]/40' : 'hover:bg-[#0B1120] border border-transparent'
              }`}
            >
              <img src={v.photo_url || FALLBACK_PHOTO} className="w-10 h-10 rounded-full object-cover border border-slate-700" />
              <div>
                <p className="font-mono text-sm text-white font-bold">{v.plate}</p>
                <p className="text-[11px] text-slate-400">{v.brand}</p>
              </div>
            </button>
          ))}
          {vehicles.length === 0 && <p className="text-slate-500 text-sm p-2">Sin vehículos todavía.</p>}
        </div>

        {/* Mapa */}
        <div className={`w-full md:flex-1 bg-[#1E293B]/30 border border-slate-700 rounded-2xl overflow-hidden h-[340px] md:h-[500px] relative z-0 ${placingFence ? 'cursor-crosshair' : ''}`}>
          {placingFence && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-[#10B981] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <Crosshair size={14} /> Tocá el mapa donde querés el centro de la geocerca
            </div>
          )}
          <MapContainer center={[-32.8895, -68.8458]} zoom={12} maxZoom={19} style={{ height: '100%', width: '100%' }}>
            <MapResizer />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={20}
              maxNativeZoom={19}
            />
            {selected && <FlyToVehicle vehicle={selectedVehicleCoord} />}
            <FenceClickHandler active={placingFence} onPick={(latlng) => { setPendingCenter(latlng); setPlacingFence(false); }} />

            {/* Geocercas ya guardadas del auto seleccionado */}
            {selected && geofences.map(f => (
              <Circle
                key={f.id}
                center={[Number(f.lat), Number(f.lng)]}
                radius={f.radius_m}
                pathOptions={{
                  color: f.mode === 'OUT' ? '#F59E0B' : f.mode === 'BOTH' ? '#EC4899' : '#6366F1',
                  fillColor: f.mode === 'OUT' ? '#F59E0B' : f.mode === 'BOTH' ? '#EC4899' : '#6366F1',
                  fillOpacity: 0.12,
                  weight: 2,
                  dashArray: f.device_synced ? undefined : '6 6', // punteado = todavía no confirmamos que llegó al equipo
                }}
              >
                <Popup>
                  <div className="text-black text-xs space-y-1">
                    <p className="font-bold">{f.name || `Geocerca #${f.id}`}</p>
                    <p>Radio: {f.radius_m}m · Modo: {f.mode === 'OUT' ? 'Avisa si sale' : f.mode === 'BOTH' ? 'Avisa si entra o sale' : 'Avisa si entra'}</p>
                    <p>{f.device_synced ? '✅ Comando enviado al equipo' : '⚠️ Sin confirmar en el equipo'}</p>
                    <button onClick={() => removeFence(f.id)} className="text-red-600 font-semibold underline mt-1">Borrar</button>
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Preview de la geocerca en construcción, antes de confirmar radio/modo */}
            {pendingCenter && (
              <Circle
                center={pendingCenter}
                radius={fenceRadius}
                pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.15, weight: 2, dashArray: '4 4' }}
              />
            )}

            {/* Un Polyline por viaje detectado, cada uno con su color */}
            {selected && tripSegments.map((segment, i) => (
              <Polyline
                key={i}
                positions={segment}
                pathOptions={{ color: TRAIL_COLORS[i % TRAIL_COLORS.length], weight: 4, opacity: 0.8 }}
              />
            ))}

            {vehiclesWithCoords.map(v => {
              const alert = alerts.find(a => a.vehicle_id === v.id);
              return (
                <Marker
                  key={v.id}
                  position={[v.latNum, v.lngNum]}
                  icon={vehicleIcon(v.photo_url)}
                  eventHandlers={{ click: () => setSelected(v) }}
                >
                  <Popup minWidth={220} maxWidth={260} maxHeight={260} autoPan={true}>
                    <div className="text-black space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                      <div className="flex items-center gap-2">
                        <img src={v.photo_url || FALLBACK_PHOTO} className="w-10 h-10 rounded-lg object-cover" />
                        <div>
                          <p className="font-bold font-mono leading-none">{v.plate}</p>
                          <p className="text-xs text-gray-600">{v.brand} {v.model}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${v.device_model === 'VL502' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                            {v.device_model === 'VL502' ? 'Plan Avanzado' : 'Plan Básico'}
                          </span>
                        </div>
                      </div>

                      {/* Básico y Avanzado comparten esto — es lo único que el VL04 realmente tiene */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-1 border-t border-gray-200">
                        <span className="flex items-center gap-1 text-gray-600"><Gauge size={12} /> {Math.round(v.odometer_km || 0).toLocaleString('es-AR')} km</span>
                        <span className="flex items-center gap-1 text-gray-600">{v.speed_kmh != null ? `${v.speed_kmh} km/h` : '—'}</span>
                      </div>

                      {/* Solo Avanzado (VL502) — el VL04 no tiene sensor de motor, no mostramos estos campos ni con "No disponible" */}
                      {v.device_model === 'VL502' && (
                        <>
                          {v.vin && (
                            <p className="text-[11px] text-gray-500 flex items-center gap-1">
                              <Hash size={11} /> VIN: {v.vin}
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-1 border-t border-gray-200">
                            <span className="flex items-center gap-1 text-gray-600">
                              <Fuel size={12} /> Combustible: {v.fuel_level != null ? `${v.fuel_level}%` : 'No disponible'}
                            </span>
                            <span className="flex items-center gap-1 text-gray-600">
                              RPM: {v.last_rpm != null ? v.last_rpm : 'No disponible'}
                            </span>
                          </div>
                        </>
                      )}

                      <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Clock size={11} /> Última lectura: {haceCuanto(v.last_reading_at)}
                      </p>

                      {alert && v.device_model === 'VL502' && (
                        <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 mt-1">
                          <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                            <Wrench size={11} /> Necesita atención
                          </p>
                          <p className="text-[11px] text-amber-700">{alert.ai_recommendation}</p>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Panel lateral de info + gráfico al seleccionar un auto */}
      {selected && (
        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
          <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <img src={selected.photo_url || FALLBACK_PHOTO} className="w-16 h-16 rounded-xl object-cover border border-slate-700" />
              <div>
                <h3 className="text-xl font-bold text-white font-mono">{selected.plate}</h3>
                <p className="text-slate-400 text-sm">{selected.brand} {selected.model} · {Math.round(selected.odometer_km || 0)} km</p>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="recorded_at" tickFormatter={t => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="left" stroke="#10B981" fontSize={11} domain={[0, 200]} allowDataOverflow={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#6366F1" fontSize={11} domain={[0, 8000]} allowDataOverflow={false} />
                <Tooltip contentStyle={{ background: '#0B1120', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={t => new Date(t).toLocaleTimeString('es-AR')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="speed_kmh" name="Velocidad (km/h)" stroke="#10B981" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="engine_rpm" name="RPM" stroke="#6366F1" dot={false} strokeWidth={2} connectNulls={true} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Geocercas del auto */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <MapPinned size={15} className="text-[#F59E0B]" /> Geocercas
              </p>
              {!placingFence && !pendingCenter && (
                <button
                  onClick={() => { setPlacingFence(true); setFenceError(''); }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/20"
                >
                  <Plus size={13} /> Nueva geocerca
                </button>
              )}
            </div>

            <ErrorBanner message={fenceError} />
            {fenceNotice && (
              <div className="bg-amber-500/10 border border-amber-500/40 text-amber-400 p-3 rounded-xl mb-4 text-sm">
                {fenceNotice}
              </div>
            )}

            {placingFence && (
              <p className="text-xs text-slate-500 mb-2">Hacé click en el mapa de arriba para elegir el centro. <button onClick={() => setPlacingFence(false)} className="text-slate-400 underline">Cancelar</button></p>
            )}

            {/* Form de confirmación, aparece apenas se elige un punto en el mapa (o al editar una geocerca existente) */}
            {pendingCenter && (
              <div className="bg-[#0B1120] border border-[#10B981]/30 rounded-xl p-4 mb-3 space-y-3">
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  {editingFenceId && <Pencil size={11} className="text-[#818CF8]" />}
                  {editingFenceId ? 'Editando geocerca — c' : 'C'}entro: <span className="font-mono text-slate-300">{pendingCenter[0].toFixed(6)}, {pendingCenter[1].toFixed(6)}</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Nombre (opcional)</label>
                    <input
                      value={fenceName}
                      onChange={e => setFenceName(e.target.value)}
                      placeholder="Ej: Estacionamiento"
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Radio (metros)</label>
                    <input
                      type="number"
                      min={10}
                      max={50000}
                      value={fenceRadius}
                      onChange={e => setFenceRadius(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Avisar cuando el auto...</label>
                  <select
                    value={fenceMode}
                    onChange={e => setFenceMode(e.target.value)}
                    className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white"
                  >
                    <option value="OUT">Sale del área (ej: se movió de donde lo dejé)</option>
                    <option value="IN">Entra al área (ej: llegó a destino)</option>
                    <option value="BOTH">Entra Y sale del área (avisa las dos veces)</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={confirmFence}
                    disabled={savingFence || !fenceRadius}
                    className="flex-1 bg-[#10B981] hover:bg-[#0ea371] text-white text-sm font-bold py-2 rounded-lg disabled:opacity-50"
                  >
                    {savingFence ? 'Guardando...' : editingFenceId ? 'Guardar cambios y reenviar al equipo' : 'Guardar y enviar al equipo'}
                  </button>
                  <button
                    onClick={cancelFenceForm}
                    className="px-4 text-sm text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista de geocercas ya guardadas */}
            {geofences.length === 0 && !placingFence && !pendingCenter ? (
              <p className="text-slate-600 text-sm">Sin geocercas configuradas para este auto todavía.</p>
            ) : (
              <div className="space-y-2">
                {geofences.map(f => (
                  <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{f.name || `Geocerca #${f.id}`}</p>
                      <p className="text-[11px] text-slate-500">
                        {f.radius_m}m · {f.mode === 'BOTH' ? 'avisa al entrar y al salir' : f.mode === 'OUT' ? 'avisa al salir' : 'avisa al entrar'} · {f.device_synced ? '✅ en el equipo' : '⚠️ sin confirmar'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!f.device_synced && (
                        <button
                          onClick={() => resyncFence(f.id)}
                          disabled={resyncingId === f.id}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#6366F1]/10 text-[#818CF8] border border-[#6366F1]/30 hover:bg-[#6366F1]/20 disabled:opacity-50"
                        >
                          {resyncingId === f.id ? 'Enviando...' : 'Reintentar'}
                        </button>
                      )}
                      <button onClick={() => startEditFence(f)} className="text-slate-500 hover:text-[#818CF8]" title="Editar geocerca">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => removeFence(f.id)} className="text-slate-500 hover:text-red-400" title="Borrar geocerca">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
