import { useEffect, useState, useMemo } from 'react';
import { fetchAPI } from '../services/api';
import MetricCard from './MetricCard';
import { Activity, Gauge, Zap, ShieldCheck } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ErrorBanner from './ErrorBanner';

function PlanBadge({ model }) {
  const isAvanzado = model === 'VL502';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
      isAvanzado ? 'bg-[#6366F1]/15 text-[#818CF8]' : 'bg-slate-700/40 text-slate-400'
    }`}>
      {isAvanzado ? 'Avanzado' : 'Básico'}
    </span>
  );
}

export default function TabTelemetria() {
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [series, setSeries] = useState([]);
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

  useEffect(() => {
    if (!selectedId) return;
    fetchAPI(`/telemetry/vehicle/${selectedId}?limit=60`).then(setSeries).catch(console.error);
    const interval = setInterval(() => {
      fetchAPI(`/telemetry/vehicle/${selectedId}?limit=60`).then(setSeries).catch(console.error);
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const selectedVehicle = data.find(d => d.vehicle_id === selectedId);
  const isSelectedAvanzado = selectedVehicle?.device_model === 'VL502';

  const activeAnomalies = data.filter(d => d.anomaly_flag).length;
  const avanzadoCount = useMemo(() => data.filter(d => d.device_model === 'VL502').length, [data]);
  const basicoCount = data.length - avanzadoCount;

  // Con equipos Básicos mezclados, la serie puede traer puntos sin
  // RPM (siempre null) — no rompe el gráfico, Recharts simplemente no
  // dibuja el tramo, pero igual lo filtramos para no mandar ruido.
  const hasRpmData = series.some(s => s.engine_rpm != null);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Telemetría en Vivo</h2>
      <ErrorBanner message={loadError} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Autos Activos" value={data.length} icon={Activity} trend="Actualizado ahora" />
        <MetricCard title="Anomalías activas" value={activeAnomalies} icon={Gauge} trend={activeAnomalies > 0 ? 'Revisar mantenimiento' : 'Todo en rango'} />
        <MetricCard title="Plan Avanzado" value={avanzadoCount} icon={Zap} trend="Con lectura de motor" />
        <MetricCard title="Plan Básico" value={basicoCount} icon={ShieldCheck} trend="Solo GPS y velocidad" />
      </div>

      {/* Lista de autos — ahora con badge de plan, así se distingue de un vistazo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map(t => (
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
            {t.device_model === 'VL502' ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-white font-bold text-sm">{t.engine_rpm ?? '—'}</p>
                  <p className="text-[11px] text-slate-500">RPM</p>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{t.speed_kmh ?? '—'}</p>
                  <p className="text-[11px] text-slate-500">km/h</p>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{t.driver_score ?? '—'}</p>
                  <p className="text-[11px] text-slate-500">Score</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-white font-bold text-sm">{t.speed_kmh ?? '—'}</p>
                  <p className="text-[11px] text-slate-500">km/h</p>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{t.driver_score ?? '—'}</p>
                  <p className="text-[11px] text-slate-500">Score conducción</p>
                </div>
              </div>
            )}
          </button>
        ))}
        {data.length === 0 && !loadError && (
          <p className="text-slate-500 text-sm col-span-full">Sin datos de telemetría todavía.</p>
        )}
      </div>

      {/* Gráfico — mismo patrón de ejes separados que ya usamos en Mapa en Vivo */}
      {selectedId && series.length > 0 && (
        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">
              {isSelectedAvanzado ? 'RPM y velocidad' : 'Velocidad'} — <span className="font-mono text-white">{selectedVehicle?.plate}</span>
            </p>
            <PlanBadge model={selectedVehicle?.device_model} />
          </div>

          {!isSelectedAvanzado && (
            <p className="text-xs text-slate-500 mb-3">
              Este auto tiene el equipo Básico (VL04) — no lee RPM del motor, solo GPS y velocidad. Por eso el gráfico solo muestra una línea.
            </p>
          )}

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="recorded_at" tickFormatter={t => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="left" stroke="#10B981" fontSize={11} domain={[0, 200]} allowDataOverflow={false} />
                {isSelectedAvanzado && (
                  <YAxis yAxisId="right" orientation="right" stroke="#6366F1" fontSize={11} domain={[0, 8000]} allowDataOverflow={false} />
                )}
                <Tooltip contentStyle={{ background: '#0B1120', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={t => new Date(t).toLocaleTimeString('es-AR')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="speed_kmh" name="Velocidad (km/h)" stroke="#10B981" dot={false} strokeWidth={2} />
                {isSelectedAvanzado && (
                  <Line yAxisId="right" type="monotone" dataKey="engine_rpm" name="RPM" stroke="#6366F1" dot={false} strokeWidth={2} connectNulls={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabla desktop — sin columnas fantasma para autos Básicos */}
      <div className="hidden md:block bg-[#1E293B]/50 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-[#0B1120] text-slate-400">
            <tr>
              <th className="px-6 py-4 font-medium">Patente</th>
              <th className="px-6 py-4 font-medium">Plan</th>
              <th className="px-6 py-4 font-medium">RPM</th>
              <th className="px-6 py-4 font-medium">Velocidad</th>
              <th className="px-6 py-4 font-medium">Score conducción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.map(t => (
              <tr key={t.vehicle_id} onClick={() => setSelectedId(t.vehicle_id)} className={`hover:bg-[#1E293B] transition-colors cursor-pointer ${selectedId === t.vehicle_id ? 'bg-[#1E293B]' : ''}`}>
                <td className="px-6 py-4 font-mono text-[#10B981]">{t.plate}</td>
                <td className="px-6 py-4"><PlanBadge model={t.device_model} /></td>
                <td className="px-6 py-4">
                  {t.device_model === 'VL502'
                    ? (t.engine_rpm != null ? `${t.engine_rpm} RPM` : <span className="text-slate-600">Sin lectura todavía</span>)
                    : <span className="text-slate-600" title="El equipo Básico no lee el motor">No aplica (Plan Básico)</span>}
                </td>
                <td className="px-6 py-4">{t.speed_kmh ?? 0} km/h</td>
                <td className="px-6 py-4">{t.driver_score ?? '—'}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Sin datos de telemetría todavía.</td></tr>
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
