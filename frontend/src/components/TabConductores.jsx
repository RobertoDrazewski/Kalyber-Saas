import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';

export default function TabConductores() {
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    fetchAPI('/drivers').then(setDrivers).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Perfil de Conductores</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {drivers.map(d => (
          <div key={d.id} className="bg-[#1E293B]/50 p-6 rounded-2xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-1">{d.full_name}</h3>
            <p className="text-sm text-slate-400 mb-4">Tel: {d.phone_number}</p>
            <div className="flex justify-between items-center bg-[#0B1120] p-3 rounded-lg">
              <span className="text-sm text-slate-400">Score de Manejo IA</span>
              <span className={`font-bold ${d.avg_score > 80 ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>
                {d.avg_score ? parseFloat(d.avg_score).toFixed(1) : 'N/A'}/100
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}