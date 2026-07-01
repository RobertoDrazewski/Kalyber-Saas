import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import MetricCard from './MetricCard';
import { Activity, Gauge } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TabTelemetria() {
  const [data, setData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [series, setSeries] = useState([]);

  const load = () => fetchAPI('/telemetry/live').then(rows => {
    setData(rows);
    if (!selectedId && rows.length > 0) setSelectedId(rows[0].vehicle_id);
  }).catch(console.error);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetchAPI(`/telemetry/vehicle/${selectedId}?limit=30`).then(setSeries).catch(console.error);
    const interval = setInterval(() => {
      fetchAPI(`/telemetry/vehicle/${selectedId}?limit=30`).then(setSeries).catch(console.error);
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const activeAnomalies = data.filter(d => d.anomaly_flag).length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Telemetría en Vivo</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Autos Activos" value={data.length} icon={Activity} trend="Actualizado ahora" />
        <MetricCard title="Anomalías activas" value={activeAnomalies} icon={Gauge} trend={activeAnomalies > 0 ? 'Revisar mantenimiento' : 'Todo en rango'} />
      </div>

      {selectedId && series.length > 0 && (
        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6 h-64">
          <p className="text-sm text-slate-400 mb-2">RPM y velocidad — {data.find(d => d.vehicle_id === selectedId)?.plate}</p>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="recorded_at" tickFormatter={t => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0B1120', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={t => new Date(t).toLocaleTimeString('es-AR')} />
              <Line type="monotone" dataKey="engine_rpm" name="RPM" stroke="#6366F1" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="speed_kmh" name="Velocidad" stroke="#10B981" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-[#0B1120] text-slate-400">
            <tr>
              <th className="px-6 py-4 font-medium">Patente</th>
              <th className="px-6 py-4 font-medium">RPM</th>
              <th className="px-6 py-4 font-medium">Velocidad</th>
              <th className="px-6 py-4 font-medium">Carga Motor</th>
              <th className="px-6 py-4 font-medium">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.map(t => (
              <tr key={t.vehicle_id} onClick={() => setSelectedId(t.vehicle_id)} className={`hover:bg-[#1E293B] transition-colors cursor-pointer ${selectedId === t.vehicle_id ? 'bg-[#1E293B]' : ''}`}>
                <td className="px-6 py-4 font-mono text-[#10B981]">{t.plate}</td>
                <td className="px-6 py-4">{t.engine_rpm} RPM</td>
                <td className="px-6 py-4">{t.speed_kmh} km/h</td>
                <td className="px-6 py-4">{t.engine_load}%</td>
                <td className="px-6 py-4 text-xs">{t.vehicle_source === 'simulated' ? 'Demo' : 'Real'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
