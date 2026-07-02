import { useEffect, useState, useMemo } from 'react';
import { fetchAPI } from '../services/api';
import { CalendarDays, Clock, Navigation, X } from 'lucide-react';
import ErrorBanner from './ErrorBanner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function pad(n) { return String(n).padStart(2, '0'); }

export default function TabCalendario() {
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${pad(today.getMonth() + 1)}`);
  const [days, setDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayTrips, setDayTrips] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchAPI(`/trips/calendar?month=${month}`).then(setDays).catch(err => setLoadError(err.message));
  }, [month]);

  const dayMap = useMemo(() => {
    const m = new Map();
    days.forEach(d => m.set(d.day.slice(0, 10), d));
    return m;
  }, [days]);

  const gridDays = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const firstOfMonth = new Date(y, m - 1, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
    return cells;
  }, [month]);

  const chartData = days.map(d => ({ day: d.day.slice(8, 10), viajes: d.trip_count, horas: parseFloat(d.total_hours) }));

  const openDay = async (dateStr) => {
    if (!dateStr) return;
    setSelectedDay(dateStr);
    const trips = await fetchAPI(`/trips/calendar/${dateStr}`).catch(() => []);
    setDayTrips(trips);
  };

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  const monthLabel = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
    .format(new Date(`${month}-01T12:00:00`));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <CalendarDays className="text-[#6366F1]" /> Calendario de Actividad
        </h2>
        <div className="flex items-center gap-3 bg-[#1E293B]/50 border border-slate-700 rounded-xl px-3 py-1.5">
          <button onClick={() => shiftMonth(-1)} className="text-slate-400 hover:text-white px-2">‹</button>
          <span className="text-white font-medium capitalize w-40 text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="text-slate-400 hover:text-white px-2">›</button>
        </div>
      </div>

      <ErrorBanner message={loadError} />

      <p className="text-slate-400 text-sm">
        Horas y viajes por día, reconstruidos a partir del GPS (equipo real o simulador). Cada celda es un día real de actividad, no un turno cargado a mano.
      </p>

      {/* Gráfico de viajes por día */}
      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip contentStyle={{ background: '#0B1120', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
            <Bar dataKey="viajes" fill="#6366F1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grilla del mes */}
      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-6">
        <div className="grid grid-cols-7 gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase text-center">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {gridDays.map((dateStr, idx) => {
            if (!dateStr) return <div key={idx} />;
            const info = dayMap.get(dateStr);
            const dayNum = parseInt(dateStr.slice(8, 10));
            const hasActivity = !!info;
            return (
              <button
                key={dateStr}
                onClick={() => openDay(dateStr)}
                className={`aspect-square rounded-xl border p-2 flex flex-col items-start justify-between text-left transition-all ${
                  hasActivity
                    ? 'bg-[#6366F1]/10 border-[#6366F1]/40 hover:border-[#6366F1]'
                    : 'bg-[#0B1120] border-slate-800 hover:border-slate-600'
                }`}
              >
                <span className="text-xs text-slate-400">{dayNum}</span>
                {hasActivity && (
                  <div className="w-full">
                    <p className="text-[#10B981] font-bold text-sm leading-tight">{info.trip_count} viajes</p>
                    <p className="text-slate-400 text-[11px]">{info.total_hours}h</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel de detalle del día */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-[#0B1120] border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#0B1120]">
              <h3 className="text-lg font-bold text-white">Actividad del {selectedDay}</h3>
              <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-3">
              {dayTrips.length === 0 && <p className="text-slate-500 text-sm">No hay viajes registrados este día.</p>}
              {dayTrips.map(t => (
                <div key={t.id} className="bg-[#1E293B]/50 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[#10B981] font-bold">{t.plate}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <Clock size={12} />
                      {new Date(t.start_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      {t.end_time ? new Date(t.end_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'en curso'}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-white flex items-center gap-1 justify-end"><Navigation size={12} /> {t.distance_km} km</p>
                    <p className="text-[#6366F1] font-bold">${t.estimated_earnings}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
