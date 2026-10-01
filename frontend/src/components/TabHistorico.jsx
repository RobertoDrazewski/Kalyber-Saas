import { useEffect, useState, useMemo } from 'react';
import { fetchAPI } from '../services/api';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { History, Clock, MapPin, Gauge, X, RefreshCw, AlertTriangle } from 'lucide-react';
import ErrorBanner from './ErrorBanner';
import { getEventIcon } from '../utils/eventIcons';
import { reverseGeocode } from '../utils/reverseGeocode';

const dotIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #0B1120;box-shadow:0 0 6px rgba(0,0,0,.6);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function formatDate(dateString) {
  if (!dateString) return 'En curso...';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(dateString));
}
function formatTime(dateString) {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
}
function formatDuration(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

// [NUEVO 17/07/2026] Antes el mapa siempre arrancaba centrado en un
// punto fijo de Mendoza con zoom 13 — si el viaje era corto o quedaba
// lejos de ese centro, había que buscarlo a mano con scroll/drag.
// Este componente no renderiza nada visible: usa el hook useMap() de
// react-leaflet para, cada vez que cambia el trazo (tripTrail), pedirle
// al mapa que encuadre automáticamente TODO el recorrido con un margen
// prolijo — mismo patrón que Google Maps cuando abrís una ruta.
function FitBoundsToTrail({ trail }) {
  const map = useMap();
  useEffect(() => {
    if (!trail || trail.length === 0) return;
    if (trail.length === 1) {
      map.setView(trail[0], 15);
      return;
    }
    map.fitBounds(trail, { padding: [40, 40], maxZoom: 16 });
  }, [trail, map]);
  return null;
}

export default function TabHistorico() {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [loadError, setLoadError] = useState('');
  const [reconstructing, setReconstructing] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripTrail, setTripTrail] = useState([]);
  // [NUEVO 14/07/2026] Eventos/alarmas reales del tramo del viaje
  // seleccionado, con ícono por tipo — antes la bitácora del cliente
  // no mostraba ningún evento, solo distancia/duración/velocidad.
  const [tripEvents, setTripEvents] = useState([]);

  // [NUEVO 17/07/2026] Dirección real de inicio y fin del viaje —
  // antes solo se veía la hora, sin ubicación legible. Se resuelve
  // recién cuando ya tenemos el trazo (tripTrail[0] y el último punto),
  // así usamos coordenadas reales del GPS y no las del centro del
  // vehículo que puede haberse movido desde entonces.
  const [tripAddresses, setTripAddresses] = useState({ start: null, end: null });
  useEffect(() => {
    if (tripTrail.length === 0) { setTripAddresses({ start: null, end: null }); return; }
    setTripAddresses({ start: null, end: null });
    const [startLat, startLng] = tripTrail[0];
    const [endLat, endLng] = tripTrail[tripTrail.length - 1];
    reverseGeocode(startLat, startLng).then(r => setTripAddresses(prev => ({ ...prev, start: r })));
    if (tripTrail.length > 1) {
      reverseGeocode(endLat, endLng).then(r => setTripAddresses(prev => ({ ...prev, end: r })));
    }
  }, [tripTrail]);

  const load = () => fetchAPI('/trips').then(setTrips).catch(err => setLoadError(err.message));

  const refresh = async () => {
    setReconstructing(true);
    try {
      await fetchAPI('/trips/reconstruct', { method: 'POST' });
    } catch (err) {
      // si falla la reconstrucción no rompemos la pantalla, igual mostramos lo que ya había
    }
    await load();
    setReconstructing(false);
  };

  useEffect(() => {
    refresh();
    fetchAPI('/vehicles').then(setVehicles).catch(() => {});
  }, []);

  // Cuando se selecciona un viaje, buscamos el trazo real de ese
  // tramo (Telemetry_Raw entre start_time y end_time del vehículo).
  useEffect(() => {
    if (!selectedTrip) { setTripTrail([]); return; }
    fetchAPI(`/telemetry/vehicle/${selectedTrip.vehicle_id}?limit=500`)
      .then(rows => {
        const start = new Date(selectedTrip.start_time).getTime();
        const end = new Date(selectedTrip.end_time || Date.now()).getTime();
        const points = rows
          .filter(r => {
            const t = new Date(r.recorded_at).getTime();
            return t >= start - 60000 && t <= end + 60000 && r.lat && r.lng;
          })
          .map(r => [parseFloat(r.lat), parseFloat(r.lng)]);
        setTripTrail(points);
      })
      .catch(() => setTripTrail([]));
  }, [selectedTrip]);

  // Eventos/alarmas reales dentro de la ventana del viaje — mismo
  // endpoint que ya usa TabTelemetria (/telemetry/vehicle/:id/alarms),
  // filtrado acá por tiempo para mostrar solo lo que pasó DURANTE ese
  // viaje puntual, no todo el histórico del auto.
  useEffect(() => {
    if (!selectedTrip) { setTripEvents([]); return; }
    const start = new Date(selectedTrip.start_time);
    const end = new Date(selectedTrip.end_time || Date.now());
    // Margen de 1 minuto de cada lado, mismo criterio que antes — el
    // ACC "encendido" suele registrarse unos segundos antes de que el
    // GPS detecte el primer movimiento del viaje.
    const since = new Date(start.getTime() - 60000).toISOString();
    const until = new Date(end.getTime() + 60000).toISOString();
    fetchAPI(`/telemetry/vehicle/${selectedTrip.vehicle_id}/alarms?limit=200&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`)
      .then(rows => setTripEvents(Array.isArray(rows) ? rows : []))
      .catch(() => setTripEvents([]));
  }, [selectedTrip]);

  const filteredTrips = useMemo(() => {
    return vehicleFilter === 'all' ? trips : trips.filter(t => String(t.vehicle_id) === vehicleFilter);
  }, [trips, vehicleFilter]);

  // Agrupar por día para el diseño tipo "bitácora"
  const groupedByDay = useMemo(() => {
    const groups = {};
    for (const t of filteredTrips) {
      const day = new Date(t.start_time).toISOString().slice(0, 10);
      if (!groups[day]) groups[day] = [];
      groups[day].push(t);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTrips]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="text-[#10B981]" /> Bitácora de Viajes
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={vehicleFilter}
            onChange={e => setVehicleFilter(e.target.value)}
            className="bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">Todos los autos</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
          </select>
          <button
            onClick={refresh}
            disabled={reconstructing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#6366F1] text-sm font-semibold hover:bg-[#6366F1]/20 disabled:opacity-50"
          >
            <RefreshCw size={14} className={reconstructing ? 'animate-spin' : ''} />
            {reconstructing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      <ErrorBanner message={loadError} />
      <p className="text-slate-500 text-sm -mt-4">
        Los viajes se arman solos a partir del GPS real: empiezan cuando el auto arranca a moverse y cierran cuando queda quieto un rato.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista agrupada por día */}
        <div className={`space-y-6 ${selectedTrip ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {groupedByDay.map(([day, dayTrips]) => {
            const totalKm = dayTrips.reduce((s, t) => s + Number(t.distance_km || 0), 0);
            return (
              <div key={day}>
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <h3 className="text-white font-bold text-sm">
                    {new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(day))}
                  </h3>
                  <span className="text-xs text-slate-500">{dayTrips.length} viaje(s) · {totalKm.toFixed(1)} km</span>
                </div>
                <div className="space-y-2">
                  {dayTrips.map(trip => (
                    <button
                      key={trip.id}
                      onClick={() => setSelectedTrip(trip)}
                      className={`w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#1E293B]/50 rounded-xl border text-left transition-colors gap-3 ${
                        selectedTrip?.id === trip.id ? 'border-[#6366F1]' : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:w-1/4">
                        <div className="w-9 h-9 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981] shrink-0">
                          <MapPin size={16} />
                        </div>
                        <div>
                          <p className="font-mono text-white font-bold text-sm">{trip.plate}</p>
                          <p className="text-xs text-slate-500">{trip.driver_name || 'Sin conductor asignado'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-300 sm:w-1/4">
                        <Clock size={13} className="text-slate-500 shrink-0" />
                        {formatTime(trip.start_time)} — {formatTime(trip.end_time)}
                        <span className="text-slate-500">({formatDuration(trip.duration_minutes)})</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-300 sm:w-1/4">
                        <Gauge size={13} className="text-slate-500 shrink-0" />
                        Máx. {trip.max_speed_kmh ?? '—'} km/h
                      </div>
                      <div className="sm:w-1/6 sm:text-right">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6366F1]/10 text-[#6366F1] text-xs font-bold border border-[#6366F1]/20">
                          {Number(trip.distance_km).toFixed(1)} km
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {groupedByDay.length === 0 && !loadError && !reconstructing && (
            <div className="text-center py-16 text-slate-500 flex flex-col items-center gap-3 bg-[#1E293B]/30 rounded-2xl border border-slate-800">
              <History size={40} className="opacity-20" />
              <p>Todavía no hay viajes registrados con datos reales.</p>
              <p className="text-xs">Van a aparecer solos apenas el auto haga un recorrido y quede detenido un rato.</p>
            </div>
          )}
        </div>

        {/* Panel del viaje seleccionado, con su trazo real */}
        {selectedTrip && (
          <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 overflow-hidden h-fit sticky top-4">
            <div className="p-4 border-b border-slate-800 flex justify-between items-start">
              <div>
                <p className="font-mono text-white font-bold">{selectedTrip.plate}</p>
                <p className="text-xs text-slate-400">{formatDate(selectedTrip.start_time)} · {formatTime(selectedTrip.start_time)} - {formatTime(selectedTrip.end_time)}</p>
                {/* [NUEVO 17/07/2026] Calle y altura real de inicio/fin,
                    en vez de tener que buscarlas mirando el mapa. */}
                <div className="mt-2 space-y-1 text-xs">
                  <p className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />
                    {tripAddresses.start ? tripAddresses.start.full : 'Buscando dirección de inicio…'}
                  </p>
                  {tripTrail.length > 1 && (
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-[#EF4444] shrink-0" />
                      {tripAddresses.end ? tripAddresses.end.full : 'Buscando dirección de destino…'}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedTrip(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="h-64">
              <MapContainer center={tripTrail[0] || [-32.8895, -68.8458]} zoom={13} style={{ height: '100%', width: '100%' }}>
                {/* CORRECCIÓN: se reemplaza CARTO por OpenStreetMap para evitar el error "API KEY REQUIRED".
                    Si en algún momento querés volver a CARTO, agregá tu key así:
                    `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=TU_API_KEY_AQUI` */}
                <TileLayer
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                {tripTrail.length > 1 && <Polyline positions={tripTrail} pathOptions={{ color: '#6366F1', weight: 4 }} />}
                {tripTrail.length > 0 && <Marker position={tripTrail[0]} icon={dotIcon('#10B981')} />}
                {tripTrail.length > 1 && <Marker position={tripTrail[tripTrail.length - 1]} icon={dotIcon('#EF4444')} />}
                <FitBoundsToTrail trail={tripTrail} />
              </MapContainer>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3 text-center border-t border-slate-800">
              <div>
                <p className="text-white font-bold">{Number(selectedTrip.distance_km).toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">km</p>
              </div>
              <div>
                <p className="text-white font-bold">{formatDuration(selectedTrip.duration_minutes)}</p>
                <p className="text-[11px] text-slate-500">duración</p>
              </div>
              <div>
                <p className="text-white font-bold">{selectedTrip.max_speed_kmh ?? '—'}</p>
                <p className="text-[11px] text-slate-500">km/h máx.</p>
              </div>
            </div>

            {/* Eventos del tramo — con ícono por tipo, para que el
                cliente entienda de un vistazo qué pasó en el viaje sin
                tener que descifrar códigos crudos. */}
            <div className="p-4 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-400" /> Eventos de este viaje
              </p>
              {tripEvents.length === 0 ? (
                <p className="text-slate-600 text-xs">Sin eventos registrados en este tramo.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {tripEvents.map(ev => {
                    const { Icon, cls } = getEventIcon(ev);
                    return (
                      <div key={ev.id} className="flex items-center gap-2 text-xs text-slate-300">
                        <Icon size={13} className={`shrink-0 ${cls}`} />
                        <span className="truncate">{ev.description || ev.label}</span>
                        <span className="text-slate-600 ml-auto shrink-0">{formatTime(ev.recorded_at)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
