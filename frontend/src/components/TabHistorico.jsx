import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { History, Calendar, Clock, MapPin } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

export default function TabHistorico() {
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchAPI('/trips')
      .then(setHistoryLogs)
      .catch(err => setLoadError(err.message));
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'En curso...';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <History className="text-[#10B981]" /> Bitácora Histórica
      </h2>
      <ErrorBanner message={loadError} />

      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-4 md:p-6">
        <p className="text-slate-400 mb-6 text-sm">
          Registro inalterable de actividad de la flota. Todos los turnos y jornadas de trabajo quedan guardados aquí.
        </p>

        <div className="space-y-4">
          {historyLogs.map((log, index) => (
            <div key={log.id || index} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[#0B1120] rounded-xl border border-slate-800 hover:border-slate-600 transition-colors gap-4">

              <div className="flex items-center gap-4 md:w-1/4">
                <div className="w-10 h-10 rounded-full bg-[#10B981]/20 flex items-center justify-center text-[#10B981] shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="font-mono text-white font-bold">{log.plate}</p>
                  <p className="text-xs text-slate-400">{log.driver_name || 'Piloto Automático / IA'}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:w-2/4 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-500" />
                  <span><span className="text-slate-500">Inicio:</span> {formatDate(log.start_time)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-500" />
                  <span><span className="text-slate-500">Fin:</span> {formatDate(log.end_time)}</span>
                </div>
              </div>

              <div className="md:w-1/4 md:text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6366F1]/10 text-[#6366F1] text-xs font-bold border border-[#6366F1]/20">
                  {log.distance_km} km recorridos
                </span>
              </div>

            </div>
          ))}

          {historyLogs.length === 0 && !loadError && (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-3">
              <History size={40} className="opacity-20" />
              <p>El historial de la flota está vacío.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
