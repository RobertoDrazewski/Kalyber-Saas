import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import MetricCard from './MetricCard';
import { Navigation, DollarSign, MapPin } from 'lucide-react';

export default function TabViajes() {
  const [trips, setTrips] = useState([]);
  const [metrics, setMetrics] = useState({ totalKm: 0, totalEarnings: 0, count: 0 });

  useEffect(() => {
    fetchAPI('/trips').then(data => {
      setTrips(data);
      // Calcular métricas rápidas
      const totalKm = data.reduce((acc, curr) => acc + Number(curr.distance_km || 0), 0);
      const totalEarnings = data.reduce((acc, curr) => acc + Number(curr.estimated_earnings || 0), 0);
      setMetrics({ totalKm: totalKm.toFixed(1), totalEarnings: totalEarnings.toFixed(2), count: data.length });
    }).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">KPIs y Viajes</h2>
      
      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Viajes Registrados" value={metrics.count} icon={Navigation} />
        <MetricCard title="Distancia Total" value={`${metrics.totalKm} km`} icon={MapPin} />
        <MetricCard title="Ganancias Est." value={`$${metrics.totalEarnings}`} icon={DollarSign} trend="Rendimiento del mes" />
      </div>

      {/* Tabla de Historial */}
      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-4 bg-[#0B1120] border-b border-slate-800">
          <h3 className="font-bold text-white">Historial Reciente</h3>
        </div>
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-[#0B1120] text-slate-400">
            <tr>
              <th className="px-6 py-4 font-medium">Patente</th>
              <th className="px-6 py-4 font-medium">Conductor</th>
              <th className="px-6 py-4 font-medium">Distancia</th>
              <th className="px-6 py-4 font-medium">Ganancia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {trips.slice(0, 10).map(t => (
              <tr key={t.id} className="hover:bg-[#1E293B] transition-colors">
                <td className="px-6 py-4 font-mono text-[#10B981]">{t.plate}</td>
                <td className="px-6 py-4">{t.driver_name || 'Sin Asignar'}</td>
                <td className="px-6 py-4">{t.distance_km} km</td>
                <td className="px-6 py-4 text-[#6366F1] font-bold">${t.estimated_earnings}</td>
              </tr>
            ))}
            {trips.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                  Aún no hay viajes registrados en la base de datos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}