import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fetchAPI } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=200&q=60';

// MySQL devuelve las columnas DECIMAL (lat/lng) como texto — sin
// convertir a número, Leaflet no dibuja bien ni el marcador ni la
// polilínea, y el mapa "salta" en vez de mostrar un trazo continuo.
function toNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function vehicleIcon(photoUrl) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:44px;height:44px;border-radius:9999px;
        border:3px solid #10B981;
        box-shadow:0 0 12px rgba(0,0,0,0.5);
        background:#0B1120 url('${photoUrl || FALLBACK_PHOTO}') center/cover no-repeat;
      "></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

function FlyToVehicle({ vehicle }) {
  const map = useMap();
  useEffect(() => {
    if (vehicle && vehicle.latNum !== null && vehicle.lngNum !== null) {
      map.flyTo([vehicle.latNum, vehicle.lngNum], 15, { duration: 0.8 });
    }
  }, [vehicle, map]);
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

  const load = () => fetchAPI('/vehicles').then(setVehicles).catch(err => setLoadError(err.message));

  // Refresco de posición cada 5s (antes 10s) — con la trayectoria
  // dibujándose de verdad, un refresco más ágil se nota mucho más.
  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
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
          <MapContainer center={[-32.8895, -68.8458]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <MapResizer />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
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

            {vehiclesWithCoords.map(v => (
              <Marker
                key={v.id}
                position={[v.latNum, v.lngNum]}
                icon={vehicleIcon(v.photo_url)}
                eventHandlers={{ click: () => setSelected(v) }}
              >
                <Popup>
                  <div className="text-black">
                    <p className="font-bold">{v.plate}</p>
                    <p>{v.brand} {v.model}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
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
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0B1120', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={t => new Date(t).toLocaleTimeString('es-AR')} />
                <Line type="monotone" dataKey="speed_kmh" name="Velocidad (km/h)" stroke="#10B981" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="engine_rpm" name="RPM" stroke="#6366F1" dot={false} strokeWidth={2} yAxisId={0} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
