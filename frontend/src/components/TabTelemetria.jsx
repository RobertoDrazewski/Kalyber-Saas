import { useEffect, useState, useMemo } from 'react';
import { fetchAPI } from '../services/api';
import MetricCard from './MetricCard';
import {
  Activity, Gauge, Zap, ShieldCheck, Fuel, Wrench, Cpu, MapPin, Clock,
  AlertTriangle, ShieldAlert, CheckCircle2, X, Navigation, History,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ErrorBanner from './ErrorBanner';

const AVANZADO = 'VL502';

function PlanBadge({ model }) {
  const isAvanzado = model === AVANZADO;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
      isAvanzado ? 'bg-[#6366F1]/15 text-[#818CF8]' : 'bg-slate-700/40 text-slate-400'
    }`}>
      {isAvanzado ? 'Avanzado' : 'Básico'}
    </span>
  );
}

// El ACC (motor encendido/apagado) llega confirmado en vivo tanto del
// VL502 (tag 0x0522) como del VL04 (offset 27 del paquete 0x37,
// confirmado 13/07/2026 contra el heartbeat real). Si no hay dato
// (equipo recién pareado, sin lecturas todavía), mostramos "sin dato"
// en vez de inventar un estado.
function AccBadge({ accOn }) {
  if (accOn === null || accOn === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-slate-700/30 text-slate-400 border border-slate-600">
        <X size={12} /> Sin dato
      </span>
    );
  }
  return accOn ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40">
      <Zap size={12} /> Motor ENCENDIDO
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-700/30 text-slate-400 border border-slate-600">
      <X size={12} /> Motor APAGADO
    </span>
  );
}

// Flecha de rumbo — reusa el ícono de Navigation (apunta al NE por
// defecto) rotado según el heading real del último ping GPS.
function HeadingCompass({ heading }) {
  if (heading === null || heading === undefined) return <span className="text-slate-600 text-xs">Sin rumbo</span>;
  return (
    <div className="flex items-center gap-1.5 text-slate-300">
      <Navigation size={16} style={{ transform: `rotate(${heading}deg)` }} className="text-[#6366F1] transition-transform" />
      <span className="text-xs font-mono">{Math.round(heading)}°</span>
    </div>
  );
}

function GaugeStat({ icon: Icon, label, value, unit, color = '#10B981' }) {
  return (
    <div className="bg-[#0B1120] rounded-xl border border-slate-800 p-3 text-center">
      <Icon size={16} className="mx-auto mb-1" style={{ color }} />
      <p className="text-white font-bold text-sm">{value ?? '—'}<span className="text-[10px] text-slate-500 ml-0.5">{value != null ? unit : ''}</span></p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

// Grupos de flags booleanos que manda el VL502 (Tabla 25 del manual).
// null = el equipo todavía no reportó ese campo (no es lo mismo que
// "false"), así que se muestra aparte como "sin dato" en vez de
// asumir un estado que no fue confirmado.
const STATUS_GROUPS = [
  {
    title: 'Puertas y baúl',
    items: [
      ['puerta_del_izq', 'Del. izquierda'], ['puerta_del_der', 'Del. derecha'],
      ['puerta_tras_izq', 'Tras. izquierda'], ['puerta_tras_der', 'Tras. derecha'], ['baul', 'Baúl'],
    ],
    badWhenTrue: true, // true = abierta = alerta
  },
  {
    title: 'Cinturones y freno de mano',
    items: [
      ['cinturon_conductor', 'Cinturón conductor'], ['cinturon_acompanante', 'Cinturón acompañante'],
      ['freno_mano_puesto', 'Freno de mano puesto'],
    ],
    badWhenTrue: false, // true = colocado = OK
  },
  {
    title: 'Luces',
    items: [
      ['luz_alta', 'Luz alta'], ['luz_baja', 'Luz baja'], ['luz_posicion', 'Posición'],
      ['luz_antiniebla', 'Antiniebla'], ['balizas', 'Balizas'],
    ],
    badWhenTrue: null, // informativo, no es ni bueno ni malo
  },
  {
    title: 'Fallas y alarmas del equipo',
    items: [
      ['falla_ecm', 'Falla ECM'], ['falla_abs', 'Falla ABS'], ['falla_srs', 'Falla SRS'],
      ['airbag_desplegado', 'Airbag desplegado'], ['alarma_aceite', 'Alarma de aceite'],
      ['alarma_presion_neumaticos', 'Presión de neumáticos'], ['alarma_mantenimiento', 'Mantenimiento'],
    ],
    badWhenTrue: true,
  },
];

function StatusPill({ label, value, bad }) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-slate-600 text-xs">
        <X size={12} /> {label}
      </div>
    );
  }
  // bad === null → informativo (ni verde ni rojo), solo indica ON/OFF
  const isAlert = bad !== null && value === bad;
  const cls = bad === null
    ? (value ? 'bg-[#6366F1]/10 text-[#818CF8] border-[#6366F1]/30' : 'bg-[#0B1120] border-slate-800 text-slate-500')
    : (isAlert ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30');
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${cls}`}>
      {bad !== null && isAlert ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
      {label}
    </div>
  );
}

// Cada evento de Telemetry_Alarms trae un alarm_id — PERO OJO: el
// VL04 (GT06) y el VL502 (JT808) usan DOS tablas de códigos distintas
// que comparten el mismo rango de números para cosas diferentes (ej:
// 0x2C = "colisión" en VL04 pero "cambio de marcha" en VL502). Clasificar
// por alarm_id numérico clasificaba mal — colisión real aparecía gris.
// Clasificamos por palabras clave en label/description en cambio, que
// ya vienen en texto plano y no colisionan entre las dos fuentes.
function severityColor(alarm) {
  const text = `${alarm.label || ''} ${alarm.description || ''}`.toLowerCase();
  const critical = ['collision', 'colisi', 'sos', 'vuelco', 'rollover', 'emergencia', 'harsh_braking', 'frenada brusca'];
  const warning = ['harsh', 'brusc', 'turn', 'giro', 'overspeed', 'exceso de velocidad', 'power_cut', 'corte de energ',
    'unplugged', 'desconectado', 'battery', 'bateria', 'batería', 'tamper', 'sabotaje', 'fence', 'geocerca',
    'remolque', 'robo', 'theft', 'fatiga', 'fatigue'];
  if (critical.some(k => text.includes(k))) return { cls: 'bg-red-500/10 text-red-400 border-red-500/30', dot: 'bg-red-500' };
  if (warning.some(k => text.includes(k))) return { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' };
  return { cls: 'bg-slate-700/20 text-slate-400 border-slate-700', dot: 'bg-slate-500' };
}

// Timeline de eventos reales — se usa igual en el panel Avanzado y en
// el Básico, la única diferencia es de dónde salen los eventos (ambos
// pegan a la misma tabla Telemetry_Alarms vía el mismo endpoint).
function AlarmTimeline({ alarms }) {
  if (alarms.length === 0) {
    return <p className="text-slate-600 text-sm">Sin eventos registrados todavía para este auto.</p>;
  }
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {alarms.map(a => {
        const sev = severityColor(a);
        return (
          <div key={a.id} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${sev.cls}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${sev.dot}`}></span>
              <span className="text-sm font-medium truncate">{a.label}</span>
            </div>
            <span className="text-[11px] shrink-0 opacity-80">{fmtHora(a.recorded_at)}</span>
          </div>
        );
      })}
    </div>
  );
}

function fmtHora(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function parseStatusFlags(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

// ============================================================
// Panel de Control Profesional — solo para autos con VL502
// (Plan Avanzado). Todo lo que se muestra acá viene de datos reales
// que el equipo manda; nada se calcula ni se inventa en el front.
// ============================================================
function PanelAvanzado({ vehicle, series, alarms, dtc, trips }) {
  const last = series[series.length - 1] || {};
  // FIX (13/07/2026): el VL502 manda posición (0x0200) mucho más
  // seguido que datos de motor (0x0900, ~1 de cada 5 paquetes según
  // los logs reales) — son mensajes SEPARADOS. Tomar directamente
  // "la última fila" para RPM/temp/batería/combustible casi siempre
  // agarraba un paquete de posición pura, con todo eso en null, y
  // mostraba "Sin dato" aunque el motor SÍ estuviera reportando bien
  // (se veía perfecto en los logs del TCP, pero nunca en el panel).
  // Ahora buscamos la lectura más reciente que realmente traiga algo
  // de motor, por separado de "last" (que se sigue usando para
  // velocidad/ACC, eso sí viene en cada paquete).
  const lastObd = [...series].reverse().find(r =>
    r.engine_rpm != null || r.coolant_temp != null || r.battery_voltage != null || r.fuel_level != null
  ) || {};
  const statusFlags = parseStatusFlags(vehicle.last_status_flags) || parseStatusFlags(last.status_flags);
  const hasRpmData = series.some(s => s.engine_rpm != null);

  return (
    <div className="space-y-6">
      {/* Header de estado */}
      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[#10B981] font-bold text-lg">{vehicle.plate}</span>
            <PlanBadge model={AVANZADO} />
            <AccBadge accOn={last.acc_signal ?? null} />
          </div>
          <div className="flex items-center gap-4">
            <HeadingCompass heading={vehicle.heading} />
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={13} /> {fmtHora(vehicle.last_ping_at)}
            </span>
          </div>
        </div>

        {/* Gauges — todo lo que el VL502 puede reportar */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <GaugeStat icon={Gauge} label="Velocidad" value={vehicle.speed_kmh ?? last.speed_kmh} unit="km/h" color="#10B981" />
          <GaugeStat icon={Zap} label="RPM" value={lastObd.engine_rpm} unit="" color="#6366F1" />
          <GaugeStat icon={Fuel} label="Combustible" value={lastObd.fuel_level} unit="%" color="#F59E0B" />
          <GaugeStat icon={Cpu} label="Temp. motor" value={lastObd.coolant_temp} unit="°C" color="#EF4444" />
          <GaugeStat icon={Zap} label="Batería" value={lastObd.battery_voltage} unit="V" color="#818CF8" />
          <GaugeStat icon={Wrench} label="Presión aceite" value={lastObd.oil_pressure_kpa} unit="kPa" color="#94A3B8" />
          <GaugeStat icon={MapPin} label="Odómetro equipo" value={(lastObd.device_odometer_km ?? vehicle.device_odometer_km) != null ? Math.round(lastObd.device_odometer_km ?? vehicle.device_odometer_km).toLocaleString('es-AR') : null} unit="km" color="#10B981" />
        </div>
      </div>

      {/* Gráfico RPM/velocidad */}
      {series.length > 0 && (
        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
          <p className="text-sm text-slate-400 mb-3">RPM y velocidad — últimas lecturas</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="recorded_at" tickFormatter={t => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="left" stroke="#10B981" fontSize={11} domain={[0, 200]} allowDataOverflow={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#6366F1" fontSize={11} domain={[0, 8000]} allowDataOverflow={false} />
                <Tooltip contentStyle={{ background: '#0B1120', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={t => new Date(t).toLocaleTimeString('es-AR')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="speed_kmh" name="Velocidad (km/h)" stroke="#10B981" dot={false} strokeWidth={2} />
                {hasRpmData && <Line yAxisId="right" type="monotone" dataKey="engine_rpm" name="RPM" stroke="#6366F1" dot={false} strokeWidth={2} connectNulls={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Estado del vehículo — luces, puertas, cinturones, fallas */}
      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
        <p className="text-sm text-slate-400 mb-4">Estado del vehículo (último reporte)</p>
        {!statusFlags ? (
          <p className="text-slate-600 text-sm">Este equipo todavía no reportó el estado de puertas/luces/cinturones — aparece apenas mande el primer paquete con esos datos.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {STATUS_GROUPS.map(group => (
              <div key={group.title}>
                <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-2">{group.title}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map(([key, label]) => (
                    <StatusPill key={key} label={label} value={statusFlags[key] ?? null} bad={group.badWhenTrue} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Eventos de manejo reales — frenadas, giros, colisiones, geocerca */}
        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
          <p className="text-sm text-slate-400 mb-4 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-400" /> Eventos de manejo (histórico real)</p>
          <AlarmTimeline alarms={alarms} />
        </div>

        {/* Códigos de falla (DTC) */}
        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
          <p className="text-sm text-slate-400 mb-4 flex items-center gap-2"><ShieldAlert size={15} className="text-red-400" /> Códigos de falla (DTC)</p>
          {dtc.length === 0 ? (
            <p className="text-[#10B981] text-sm flex items-center gap-2"><CheckCircle2 size={14} /> Sin fallas reportadas por la ECU.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {dtc.map(d => {
                let codes = [];
                try { codes = Array.isArray(d.trouble_codes) ? d.trouble_codes : JSON.parse(d.trouble_codes); } catch { codes = []; }
                return (
                  <div key={d.id} className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Sistema {d.system_id}</span>
                      <span className="text-slate-500">{fmtHora(d.recorded_at)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {codes.map((c, i) => (
                        <span key={i} className="font-mono text-[11px] text-red-300 bg-red-500/10 px-2 py-0.5 rounded">{c}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Viajes reportados por el propio equipo (odómetro/combustible reales del tramo) */}
      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
        <p className="text-sm text-slate-400 mb-4 flex items-center gap-2"><History size={15} className="text-[#6366F1]" /> Viajes reportados por el equipo</p>
        {trips.length === 0 ? (
          <p className="text-slate-600 text-sm">Este equipo todavía no reportó ningún viaje con inicio y fin.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Inicio</th>
                  <th className="py-2 pr-4 font-medium">Fin</th>
                  <th className="py-2 pr-4 font-medium">Distancia</th>
                  <th className="py-2 pr-4 font-medium">Combustible</th>
                  <th className="py-2 pr-4 font-medium">Ralentí</th>
                  <th className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {trips.map(t => (
                  <tr key={t.id}>
                    <td className="py-2 pr-4">{fmtHora(t.start_time)}</td>
                    <td className="py-2 pr-4">{t.end_time ? fmtHora(t.end_time) : <span className="text-[#10B981]">en curso</span>}</td>
                    <td className="py-2 pr-4">{t.distance_km != null ? `${t.distance_km} km` : '—'}</td>
                    <td className="py-2 pr-4">{t.fuel_consumed_l != null ? `${t.fuel_consumed_l} L` : '—'}</td>
                    <td className="py-2 pr-4">{t.idling_seconds != null ? `${Math.round(t.idling_seconds / 60)} min` : '—'}</td>
                    <td className="py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.status === 'finalizado' ? 'bg-slate-700/40 text-slate-400' : 'bg-[#10B981]/15 text-[#10B981]'}`}>
                        {t.status === 'finalizado' ? 'Finalizado' : 'En curso'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Panel Básico — el JM-VL04 no tiene lectura de motor (RPM, temp.,
// combustible), eso sigue siendo exclusivo del Plan Avanzado (VL502).
//
// PERO confirmado 13/07/2026 contra tráfico real: el VL04 SÍ reporta
// por red (no solo buzzer local) colisión, corte de energía y
// desconexión física — y usa el mismo mecanismo de transporte para
// frenada/aceleración/giro brusco, así que también deberían llegar.
// Además el equipo manda su propio odómetro real (no estimado por
// GPS) y el estado de ACC en cada posición. El score de conducción y
// el desgaste de frenos (Telemetry_Heuristics) ya se calculan igual
// que en el Avanzado, porque solo dependen de harsh_brake + km — no
// de datos de motor. Antes de este cambio nada de esto se mostraba.
// ============================================================
function PanelBasico({ vehicle, series, alarms }) {
  const last = series[series.length - 1] || {};
  const accOn = last.acc_signal ?? vehicle.last_status_flags?.acc_signal ?? null;

  return (
    <div className="space-y-6">
      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[#10B981] font-bold text-lg">{vehicle.plate}</span>
            <PlanBadge model="VL04" />
            <AccBadge accOn={accOn} />
          </div>
          <div className="flex items-center gap-4">
            <HeadingCompass heading={vehicle.heading} />
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={13} /> {fmtHora(vehicle.last_ping_at)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <GaugeStat icon={Gauge} label="Velocidad" value={vehicle.speed_kmh} unit="km/h" color="#10B981" />
          <GaugeStat icon={MapPin} label="Odómetro equipo" value={vehicle.device_odometer_km != null ? Math.round(vehicle.device_odometer_km).toLocaleString('es-AR') : null} unit="km" color="#10B981" />
          <GaugeStat icon={ShieldCheck} label="Score de manejo" value={vehicle.driver_score} unit="/100" color={vehicle.driver_score != null && vehicle.driver_score < 70 ? '#F59E0B' : '#10B981'} />
          <GaugeStat icon={Wrench} label="Desgaste frenos" value={vehicle.brake_wear_score} unit="/100" color={vehicle.brake_wear_score != null && vehicle.brake_wear_score < 40 ? '#EF4444' : '#818CF8'} />
        </div>
        <p className="text-xs text-slate-500 mt-4 border-t border-slate-800 pt-3">
          Equipo <strong className="text-slate-300">Básico (JM-VL04)</strong>: GPS, velocidad y odómetro real del propio equipo. Confirmado que colisión, corte de energía y desconexión física llegan a este panel en vivo (no solo suena en cabina); frenada/aceleración/giro brusco usan el mismo camino y deberían llegar igual — todavía no tuvimos el primer evento real de manejo para confirmarlo al 100%. No tiene lectura de motor (RPM, temperatura, combustible): eso es exclusivo del Plan Avanzado (VL502).
        </p>
      </div>

      {series.length > 0 && (
        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
          <p className="text-sm text-slate-400 mb-3">Velocidad — últimas lecturas</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="recorded_at" tickFormatter={t => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} stroke="#64748b" fontSize={11} />
                <YAxis stroke="#10B981" fontSize={11} domain={[0, 200]} allowDataOverflow={false} />
                <Tooltip contentStyle={{ background: '#0B1120', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={t => new Date(t).toLocaleTimeString('es-AR')} />
                <Line type="monotone" dataKey="speed_kmh" name="Velocidad (km/h)" stroke="#10B981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Eventos de manejo reales — mismo mecanismo y misma tabla que el Avanzado */}
      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
        <p className="text-sm text-slate-400 mb-4 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-400" /> Eventos de manejo (histórico real)</p>
        <AlarmTimeline alarms={alarms} />
      </div>
    </div>
  );
}

export default function TabTelemetria() {
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [series, setSeries] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [dtc, setDtc] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loadError, setLoadError] = useState('');

  const load = () => fetchAPI('/telemetry/live').then(rows => {
    setData(rows);
    if (!selectedId && rows.length > 0) setSelectedId(rows[0].vehicle_id);
  }).catch(err => setLoadError(err.message));

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const selectedVehicle = data.find(d => d.vehicle_id === selectedId);
  const isSelectedAvanzado = selectedVehicle?.device_model === AVANZADO;

  useEffect(() => {
    if (!selectedId) return;
    const loadSeries = () => fetchAPI(`/telemetry/vehicle/${selectedId}?limit=60`).then(setSeries).catch(console.error);
    loadSeries();
    const interval = setInterval(loadSeries, 8000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // Las alarmas (Telemetry_Alarms) ya llegan de los DOS equipos —
  // VL502 vía JT808 y VL04 vía GT06 0x26/0x27, confirmado 13/07/2026
  // (colisión, corte de energía, desconexión física). DTC y "viajes
  // reportados por el equipo" SÍ siguen siendo exclusivos del VL502
  // porque dependen del OBD real, que el VL04 no tiene.
  useEffect(() => {
    if (!selectedId) { setAlarms([]); setDtc([]); setTrips([]); return; }
    const loadExtra = () => {
      fetchAPI(`/telemetry/vehicle/${selectedId}/alarms?limit=50`).then(setAlarms).catch(console.error);
      if (isSelectedAvanzado) {
        fetchAPI(`/telemetry/vehicle/${selectedId}/dtc?limit=20`).then(setDtc).catch(console.error);
        fetchAPI(`/telemetry/vehicle/${selectedId}/trips-device?limit=15`).then(setTrips).catch(console.error);
      } else {
        setDtc([]); setTrips([]);
      }
    };
    loadExtra();
    const interval = setInterval(loadExtra, 15000);
    return () => clearInterval(interval);
  }, [selectedId, isSelectedAvanzado]);

  const activeAnomaliesAvanzado = data.filter(d => d.anomaly_flag && d.device_model === AVANZADO).length;
  const avanzadoCount = useMemo(() => data.filter(d => d.device_model === AVANZADO).length, [data]);
  const basicoCount = data.length - avanzadoCount;

  const avanzadoVehicles = data.filter(d => d.device_model === AVANZADO);
  const basicoVehicles = data.filter(d => d.device_model !== AVANZADO);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Telemetría en Vivo</h2>
      <ErrorBanner message={loadError} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Autos Activos" value={data.length} icon={Activity} trend="Actualizado ahora" />
        <MetricCard title="Anomalías (motor)" value={activeAnomaliesAvanzado} icon={AlertTriangle} trend={activeAnomaliesAvanzado > 0 ? 'Revisar mantenimiento' : 'Todo en rango'} />
        <MetricCard title="Plan Avanzado" value={avanzadoCount} icon={Zap} trend="ECU, alarmas y DTC reales" />
        <MetricCard title="Plan Básico" value={basicoCount} icon={ShieldCheck} trend="GPS + eventos de manejo reales" />
      </div>

      {/* Plan Avanzado — lista separada */}
      {avanzadoVehicles.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#818CF8] mb-2">Plan Avanzado (VL502)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {avanzadoVehicles.map(t => {
              const flags = parseStatusFlags(t.last_status_flags);
              const doorsOpen = flags ? ['puerta_del_izq', 'puerta_del_der', 'puerta_tras_izq', 'puerta_tras_der', 'baul'].filter(k => flags[k]).length : null;
              return (
                <button
                  key={t.vehicle_id}
                  onClick={() => setSelectedId(t.vehicle_id)}
                  className={`text-left bg-[#1E293B]/50 rounded-2xl border p-4 transition-colors ${
                    selectedId === t.vehicle_id ? 'border-[#6366F1]' : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-mono text-[#10B981] font-bold">{t.plate}</span>
                    <PlanBadge model={t.device_model} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center mb-2">
                    <div><p className="text-white font-bold text-sm">{t.engine_rpm ?? '—'}</p><p className="text-[10px] text-slate-500">RPM</p></div>
                    <div><p className="text-white font-bold text-sm">{t.speed_kmh ?? '—'}</p><p className="text-[10px] text-slate-500">km/h</p></div>
                    <div><p className="text-white font-bold text-sm">{t.last_fuel_level ?? '—'}</p><p className="text-[10px] text-slate-500">% comb.</p></div>
                    <div><p className="text-white font-bold text-sm">{t.driver_score ?? '—'}</p><p className="text-[10px] text-slate-500">Score</p></div>
                  </div>
                  {doorsOpen !== null && doorsOpen > 0 && (
                    <p className="text-[11px] text-amber-400 flex items-center gap-1"><AlertTriangle size={11} /> {doorsOpen} puerta(s)/baúl abierto(s)</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Plan Básico — lista separada, sin columnas de motor/score */}
      {basicoVehicles.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Plan Básico (VL04) — solo GPS y velocidad</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {basicoVehicles.map(t => (
              <button
                key={t.vehicle_id}
                onClick={() => setSelectedId(t.vehicle_id)}
                className={`text-left bg-[#1E293B]/50 rounded-2xl border p-4 transition-colors ${
                  selectedId === t.vehicle_id ? 'border-[#6366F1]' : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="font-mono text-[#10B981] font-bold">{t.plate}</span>
                  <PlanBadge model={t.device_model} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-white font-bold text-sm">{t.speed_kmh ?? '—'}</p><p className="text-[11px] text-slate-500">km/h</p></div>
                  <div><p className="text-white font-bold text-sm">{t.driver_score ?? '—'}</p><p className="text-[11px] text-slate-500">Score</p></div>
                  <div><p className="text-white font-bold text-sm">{t.lat != null ? 'OK' : '—'}</p><p className="text-[11px] text-slate-500">GPS</p></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 && !loadError && (
        <p className="text-slate-500 text-sm">Sin datos de telemetría todavía.</p>
      )}

      {/* Panel de detalle del auto seleccionado */}
      {selectedVehicle && (
        isSelectedAvanzado
          ? <PanelAvanzado vehicle={selectedVehicle} series={series} alarms={alarms} dtc={dtc} trips={trips} />
          : <PanelBasico vehicle={selectedVehicle} series={series} alarms={alarms} />
      )}
    </div>
  );
}
