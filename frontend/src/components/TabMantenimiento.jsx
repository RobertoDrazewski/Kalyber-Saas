import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=200&q=60';

function ScoreGauge({ label, value }) {
  const color = value < 40 ? '#EF4444' : value < 60 ? '#F59E0B' : '#10B981';
  const data = [{ name: label, value, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <div className="w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <RadialBar background dataKey="value" cornerRadius={10} max={100} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <span className="text-xs text-slate-400 -mt-6 font-bold" style={{ color }}>{value}%</span>
      <span className="text-[11px] text-slate-500 mt-1">{label}</span>
    </div>
  );
}

export default function TabMantenimiento() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchAPI('/maintenance/alerts').then(setAlerts).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <AlertTriangle className="text-[#F59E0B]" /> Mantenimiento Predictivo (IA)
      </h2>
      <p className="text-slate-400 text-sm max-w-3xl">
        Los scores de neumáticos y frenos son una estimación por kilometraje y patrón de manejo, no una medición directa de desgaste físico.
        Las anomalías sí se calculan sobre datos reales del motor (RPM, temperatura, voltaje) comparados contra el historial propio de cada auto.
      </p>
      <div className="grid grid-cols-1 gap-4">
        {alerts.length === 0 ? (
          <p className="text-slate-400">La flota está en estado óptimo. No hay alertas.</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.vehicle_id} className="bg-[#1E293B]/70 p-6 rounded-2xl border border-[#F59E0B]/30 flex flex-col md:flex-row gap-6 items-center">
              <img src={alert.photo_url || FALLBACK_PHOTO} className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0" />

              <div className="flex-1 w-full">
                <div className="flex justify-between flex-wrap gap-2">
                  <span className="font-bold text-lg text-white font-mono">{alert.plate} <span className="text-slate-400 font-normal text-sm">({alert.brand} {alert.model})</span></span>
                  {alert.anomaly_flag ? (
                    <span className="text-xs px-2 py-1 bg-[#EF4444]/20 text-[#EF4444] rounded flex items-center gap-1"><ShieldAlert size={12} /> Anomalía detectada</span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded">Requiere atención</span>
                  )}
                </div>
                {alert.ai_recommendation && (
                  <p className="text-sm text-slate-300 mt-2"><strong>IA recomienda:</strong> {alert.ai_recommendation}</p>
                )}
              </div>

              <div className="flex gap-4 shrink-0">
                <ScoreGauge label="Neumáticos" value={Number(alert.tire_wear_score)} />
                <ScoreGauge label="Frenos" value={Number(alert.brake_wear_score)} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
