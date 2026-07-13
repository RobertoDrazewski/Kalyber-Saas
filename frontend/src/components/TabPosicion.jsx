import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fetchAPI } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { X, Gauge, Fuel, Wrench, Hash, Clock } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

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

export default function TabPosicion() {
  const [vehicles, setVehicles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [series, setSeries] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [alerts, setAlerts] = useState([]);

  const load = () => fetchAPI('/vehicles').then(setVehicles).catch(err => setLoadError(err.message));

  // Refresco de posición cada 5s (antes 10s) — con la trayectoria
  // dibujándose de verdad, un refresco más ágil se nota mucho más.
  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

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
        <div className="w-full md:flex-1 bg-[#1E293B]/30 border border-slate-700 rounded-2xl overflow-hidden h-[340px] md:h-[500px] relative z-0">
          <MapContainer center={[-32.8895, -68.8458]} zoom={12} maxZoom={19} style={{ height: '100%', width: '100%' }}>
            <MapResizer />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={20}
              maxNativeZoom={19}
            />
            {selected && <FlyToVehicle vehicle={selectedVehicleCoord} />}

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
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="recorded_at" tickFormatter={t => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="left" stroke="#10B981" fontSize={11} domain={[0, 200]} allowDataOverflow={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#6366F1" fontSize={11} domain={[0, 8000]} allowDataOverflow={false} />
                <Tooltip contentStyle={{ background: '#0B1120', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={t => new Date(t).toLocaleTimeString('es-AR')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="speed_kmh" name="Velocidad (km/h)" stroke="#10B981" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="engine_rpm" name="RPM" stroke="#6366F1" dot={false} strokeWidth={2} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
