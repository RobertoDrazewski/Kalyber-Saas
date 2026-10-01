import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Car, CheckCircle2, Wrench, DollarSign, Activity,
  TrendingUp, Award, Gauge, ThermometerSun, BatteryMedium,
  Fuel, Pencil, X, Check, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { fetchAPI } from '../services/api';
import ErrorBanner from '../components/ErrorBanner';
import MaintenanceEventForm from '../components/MaintenanceEventForm';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=200&q=60';

function vehicleIcon(photoUrl, isMine) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:44px;height:44px;border-radius:9999px;
      border:3px solid ${isMine ? '#10B981' : '#334155'};
      box-shadow:0 0 12px rgba(0,0,0,0.5);
      background:#0B1120 url('${photoUrl || FALLBACK_PHOTO}') center/cover no-repeat;
    "></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

// MySQL devuelve las columnas DECIMAL (lat/lng) como texto, no como
// número — sin este parseo, Leaflet recibe un string y el marcador
// no se dibuja, sin tirar ningún error visible en consola.
function toNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
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

// Fuerza el recálculo del tamaño del mapa tras montarse (mismo fix
// que ya usamos en TabPosicion para que ande bien en mobile).
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function DriverView() {
  const [vehicles, setVehicles] = useState([]);
  const [trail, setTrail] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [selectError, setSelectError] = useState('');
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('kyber_user') || '{}');

  const load = () => fetchAPI('/vehicles').then(setVehicles).catch(err => setLoadError(err.message));

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // antes 10s
    return () => clearInterval(interval);
  }, []);

  // Vehículos con coordenadas VÁLIDAS y ya convertidas a número —
  // esto es lo que realmente se le pasa al mapa.
  // Mismo filtro que la vista de super admin: solo autos con equipo
  // pareado (device_imei != null) se muestran en el mapa. Sin esto,
  // un auto sin equipo aparecía con su última posición vieja como si
  // siguiera reportando.
  const vehiclesWithCoords = vehicles
    .filter(v => v.device_imei != null)
    .map(v => ({ ...v, latNum: toNum(v.lat), lngNum: toNum(v.lng) }))
    .filter(v => v.latNum !== null && v.lngNum !== null);

  const myVehicle = vehiclesWithCoords.find(v => v.current_driver_name === user.name);

  // Mismo trazo segmentado por viaje que en Mapa en Vivo — se corta
  // cuando el auto queda quieto y arranca de otro color al volver a
  // moverse.
  // Mismos colores y constantes EXACTAS que la vista de super admin
  // (TabPosicion.jsx), para que el trazo se vea idéntico en las dos.
  const TRAIL_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316'];
  const MOVING_SPEED_KMH = 3;
  const STOP_GAP_MINUTES = 4;

  function segmentTripsForDisplay(rawSeries) {
    const points = rawSeries
      .map(p => ({ lat: toNum(p.lat), lng: toNum(p.lng), speed: toNum(p.speed_kmh), t: p.recorded_at }))
      .filter(p => p.lat !== null && p.lng !== null)
      // [FIX 19/07/2026] El backend devuelve las posiciones más nuevas
      // primero (ORDER BY recorded_at DESC). Si segmentamos en ese
      // orden, la línea va del futuro al pasado y une puntos que en
      // realidad no son consecutivos en el recorrido — de ahí las
      // rectas diagonales que cruzaban el mapa. Ordenamos ascendente
      // por tiempo para que la línea siga el camino real que hizo el
      // auto, de principio a fin.
      .sort((a, b) => new Date(a.t) - new Date(b.t));

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
          current.push([p.lat, p.lng]);
        }
      }
    });
    if (current.length > 1) segments.push(current);

    return segments;
  }

  const tripSegments = segmentTripsForDisplay(trail);

  // Trazo de la trayectoria del propio auto — se sigue extendiendo
  // solo mientras el equipo siga mandando posiciones.
  const loadTrail = () => {
    if (!myVehicle) return;
    fetchAPI(`/telemetry/vehicle/${myVehicle.id}?limit=120`)
      .then(rows => {
        setTrail(rows);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadTrail();
    if (!myVehicle) return;
    const interval = setInterval(loadTrail, 5000);
    return () => clearInterval(interval);
  }, [myVehicle?.id]);

  // [NUEVO 19/07/2026] Las 4 herramientas del chofer. Se cargan solo
  // si tiene un auto asignado (sin auto, no hay nada que mostrar). No
  // rompen la vista si el backend falla — cada una cae a null y su
  // tarjeta simplemente no se muestra.
  const [earnings, setEarnings] = useState(null);
  const [vehicleCheck, setVehicleCheck] = useState(null);
  const [drivingSummary, setDrivingSummary] = useState(null);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [newAchievement, setNewAchievement] = useState(null);

  const loadDriverTools = () => {
    fetchAPI('/drivers/me/earnings').then(setEarnings).catch(() => {});
    fetchAPI('/drivers/me/vehicle-check').then(setVehicleCheck).catch(() => {});
    fetchAPI('/drivers/me/driving-summary').then(data => {
      setDrivingSummary(data);
      // Si hay un logro recién desbloqueado, lo mostramos como
      // celebración una sola vez.
      if (data?.recien_desbloqueados?.length > 0) {
        setNewAchievement(data.recien_desbloqueados[0]);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    if (!myVehicle) { setEarnings(null); setVehicleCheck(null); setDrivingSummary(null); return; }
    loadDriverTools();
    const interval = setInterval(loadDriverTools, 15000); // menos frecuente que el mapa, no cambia tan rápido
    return () => clearInterval(interval);
  }, [myVehicle?.id]);

  const handleSaveRate = async () => {
    const rate = parseFloat(rateInput);
    if (!Number.isFinite(rate) || rate < 0) return;
    try {
      await fetchAPI('/drivers/me/rate', { method: 'PATCH', body: JSON.stringify({ rate_per_km: rate }) });
      setEditingRate(false);
      loadDriverTools();
    } catch (err) {
      // silencioso — no romper la vista por esto
    }
  };

  const handleSelect = async (vehicleId) => {
    setSelecting(true);
    setSelectError('');
    try {
      await fetchAPI('/vehicles/select-as-driver', {
        method: 'POST',
        body: JSON.stringify({ vehicle_id: vehicleId }),
      });
      load();
    } catch (err) {
      setSelectError(err.message);
    } finally {
      setSelecting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kyber_token');
    localStorage.removeItem('kyber_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col">
      <div className="bg-[#050B14] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white font-bold">{user.name || 'Chofer'}</p>
          <p className="text-xs text-slate-500">
            {myVehicle ? `Manejando: ${myVehicle.plate}` : 'Sin auto asignado'}
          </p>
        </div>
        <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 flex items-center gap-1 text-sm">
          <LogOut size={16} /> Salir
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1 flex flex-col">
        <ErrorBanner message={loadError} />
        {selectError && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm p-3 rounded-xl">{selectError}</div>
        )}
        {vehicles.length > 0 && vehiclesWithCoords.length === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/40 text-amber-400 text-sm p-3 rounded-xl">
            Tenés {vehicles.length} auto(s) en tu flota, pero ninguno mandó posición GPS todavía.
          </div>
        )}

        <div className="w-full bg-[#1E293B]/30 border border-slate-700 rounded-2xl overflow-hidden h-[340px] md:h-[500px] relative z-0">
          <MapContainer center={[-32.8895, -68.8458]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <MapResizer />
            {/* CORRECCIÓN: se reemplaza CARTO por OpenStreetMap para evitar el error "API KEY REQUIRED".
                Si en algún momento querés volver a CARTO, agregá tu key así:
                `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=TU_API_KEY_AQUI` */}
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {myVehicle && <FlyToVehicle vehicle={myVehicle} />}
            {/* [FIX 19/07/2026] Antes se dibujaba `trail` crudo como UNA
                sola Polyline — como trail viene ordenado por fecha DESC
                y sin segmentar, unía puntos lejanos en el tiempo y
                espacio con rectas diagonales que cruzaban todo el mapa
                (bug visible en la vista del chofer). Ahora usa los
                mismos tripSegments que la vista de super admin: un
                Polyline por viaje, cortado cuando el auto queda quieto. */}
            {tripSegments.map((segment, i) => (
              <Polyline
                key={i}
                positions={segment}
                pathOptions={{ color: TRAIL_COLORS[i % TRAIL_COLORS.length], weight: 4, opacity: 0.8 }}
              />
            ))}
            {vehiclesWithCoords.map(v => (
              <Marker key={v.id} position={[v.latNum, v.lngNum]} icon={vehicleIcon(v.photo_url, v.id === myVehicle?.id)}>
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

        {/* ============================================================
            HERRAMIENTAS DEL CHOFER (19/07/2026) — solo si tiene auto.
            Pensadas para que el equipo le SIRVA a él, no solo para
            controlarlo: cuánto lleva ganado, cómo está su auto, y
            reconocimiento por manejar bien.
            ============================================================ */}
        {myVehicle && earnings && !earnings.error_soft && (
          <div className="bg-gradient-to-br from-[#10B981]/10 to-[#1E293B]/40 rounded-2xl border border-[#10B981]/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <DollarSign size={16} className="text-[#10B981]" /> Tu jornada
              </h3>
              {!editingRate ? (
                <button
                  onClick={() => { setRateInput(String(earnings.rate_per_km)); setEditingRate(true); }}
                  className="text-[11px] text-slate-400 flex items-center gap-1 hover:text-white"
                >
                  <Pencil size={11} /> ${earnings.rate_per_km}/km {earnings.is_default_rate && '(ajustar)'}
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-xs">$</span>
                  <input
                    type="number"
                    value={rateInput}
                    onChange={e => setRateInput(e.target.value)}
                    className="w-16 bg-[#0B1120] border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    autoFocus
                  />
                  <span className="text-slate-400 text-xs">/km</span>
                  <button onClick={handleSaveRate} className="text-[#10B981] p-1"><Check size={14} /></button>
                  <button onClick={() => setEditingRate(false)} className="text-slate-500 p-1"><X size={14} /></button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#0B1120]/60 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-[#10B981]">${(earnings.hoy.estimado).toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Hoy · {earnings.hoy.km} km</p>
              </div>
              <div className="bg-[#0B1120]/60 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-white">${(earnings.semana.estimado).toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Semana · {earnings.semana.km} km</p>
              </div>
              <div className="bg-[#0B1120]/60 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-white">${(earnings.mes.estimado).toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Mes · {earnings.mes.km} km</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 mt-2 text-center">
              Estimación según tus km reales y tu tarifa — no es el dato oficial de la app de viajes.
            </p>
          </div>
        )}

        {/* Chequeo del auto — semáforo */}
        {myVehicle && vehicleCheck && !vehicleCheck.error_soft && vehicleCheck.checks?.length > 0 && (
          <div className={`rounded-2xl border p-4 ${
            vehicleCheck.general === 'alert' ? 'bg-red-500/10 border-red-500/40' :
            vehicleCheck.general === 'warn' ? 'bg-amber-500/10 border-amber-500/40' :
            'bg-[#1E293B]/50 border-slate-700'
          }`}>
            <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
              <Activity size={16} className={
                vehicleCheck.general === 'alert' ? 'text-red-400' :
                vehicleCheck.general === 'warn' ? 'text-amber-400' : 'text-[#10B981]'
              } />
              Chequeo de tu auto
              {vehicleCheck.general === 'ok' && <span className="text-[10px] text-[#10B981] font-normal">· Todo bien</span>}
              {vehicleCheck.general === 'warn' && <span className="text-[10px] text-amber-400 font-normal">· Revisá algo</span>}
              {vehicleCheck.general === 'alert' && <span className="text-[10px] text-red-400 font-normal">· Necesita atención</span>}
            </h3>
            <div className="space-y-2">
              {vehicleCheck.checks.map(c => {
                const Icon = c.key === 'temp' ? ThermometerSun : c.key === 'bateria' ? BatteryMedium : Fuel;
                const dot = c.estado === 'alert' ? 'bg-red-400' : c.estado === 'warn' ? 'bg-amber-400' : c.estado === 'ok' ? 'bg-[#10B981]' : 'bg-slate-600';
                return (
                  <div key={c.key} className="flex items-center gap-3 bg-[#0B1120]/50 rounded-lg px-3 py-2">
                    <Icon size={16} className="text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white">{c.label}</span>
                        <span className="text-sm font-bold text-slate-300">{c.detalle}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{c.consejo}</p>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resumen de manejo + logros */}
        {myVehicle && drivingSummary && !drivingSummary.error_soft && (
          <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-[#6366F1]" /> Tu manejo
            </h3>

            {/* Insight causa-efecto */}
            <div className="bg-[#6366F1]/10 border border-[#6366F1]/30 rounded-xl p-3 mb-3">
              <p className="text-sm text-slate-200 leading-relaxed">{drivingSummary.insight}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <p className="text-xl font-bold text-[#10B981]">{drivingSummary.dias_sin_frenada}</p>
                <p className="text-[10px] text-slate-500">días sin frenada brusca</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{drivingSummary.km_mes}</p>
                <p className="text-[10px] text-slate-500">km este mes</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{drivingSummary.excesos_mes}</p>
                <p className="text-[10px] text-slate-500">excesos de vel.</p>
              </div>
            </div>

            {/* Logros */}
            {drivingSummary.logros?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
                  <Award size={12} /> Tus logros
                </p>
                <div className="flex flex-wrap gap-2">
                  {drivingSummary.logros.map(l => (
                    <div key={l.key} className="flex items-center gap-1.5 bg-[#0B1120]/60 border border-slate-700 rounded-full px-3 py-1.5">
                      <span>{l.emoji}</span>
                      <span className="text-[11px] text-slate-300">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {myVehicle && (
          <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm flex items-center gap-2"><Wrench size={16} /> Mantenimiento de {myVehicle.plate}</h3>
              {!showMaintenanceForm && (
                <button
                  onClick={() => setShowMaintenanceForm(true)}
                  className="text-xs bg-[#6366F1]/10 text-[#6366F1] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#6366F1]/20"
                >
                  + Cargar comprobante
                </button>
              )}
            </div>
            {showMaintenanceForm ? (
              <MaintenanceEventForm
                vehicleId={myVehicle.id}
                currentOdometer={myVehicle.odometer_km}
                onDone={() => setShowMaintenanceForm(false)}
                onCancel={() => setShowMaintenanceForm(false)}
              />
            ) : (
              <p className="text-xs text-slate-500">Sacale una foto al ticket del taller/lubricentro y cargalo acá — le queda al admin en el historial del auto.</p>
            )}
          </div>
        )}

        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-4">
          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Car size={16} /> Elegí tu auto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.filter(v => v.status === 'active').map(v => {
              const isMine = v.id === myVehicle?.id;
              return (
                <button
                  key={v.id}
                  onClick={() => handleSelect(v.id)}
                  disabled={selecting}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    isMine ? 'bg-[#10B981]/10 border-[#10B981]/50' : 'bg-[#0B1120] border-slate-700 hover:border-slate-500'
                  } disabled:opacity-60`}
                >
                  <img src={v.photo_url || FALLBACK_PHOTO} className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-white font-bold">{v.plate}</p>
                    <p className="text-xs text-slate-400 truncate">{v.brand} {v.model}</p>
                  </div>
                  {isMine && <CheckCircle2 size={18} className="text-[#10B981] shrink-0" />}
                </button>
              );
            })}
            {vehicles.length === 0 && !loadError && (
              <p className="text-slate-500 text-sm col-span-2">No hay autos disponibles en tu flota todavía.</p>
            )}
          </div>
        </div>
      </div>
      {/* [NUEVO 19/07/2026] Celebración de logro recién desbloqueado —
          aparece una sola vez, el chofer lo cierra. Refuerzo positivo test. */}
      {newAchievement && (
        <div
          className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-6"
          onClick={() => setNewAchievement(null)}
        >
          <div className="bg-gradient-to-b from-[#1E293B] to-[#0B1120] border border-[#10B981]/50 rounded-3xl p-8 max-w-xs text-center shadow-2xl shadow-[#10B981]/20">
            <div className="text-6xl mb-4">{newAchievement.emoji}</div>
            <p className="text-[#10B981] font-bold text-xs uppercase tracking-widest mb-2">¡Logro desbloqueado!</p>
            <p className="text-white font-bold text-lg mb-4">{newAchievement.label}</p>
            <button
              onClick={() => setNewAchievement(null)}
              className="w-full py-2.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm"
            >
              ¡Genial!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
