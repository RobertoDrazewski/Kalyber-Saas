import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { Trash2, Phone, IdCard, Users, UserCog, AlertTriangle } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

// El alta de choferes se sacó de acá — ahora se crean desde la tab
// "Usuarios" (les da login, DNI, vencimiento de carnet y les manda
// las credenciales por mail/WhatsApp). Esta tab queda solo para
// listar, ver el score y dar de baja.
export default function TabConductores() {
  const [drivers, setDrivers] = useState([]);
  const [loadError, setLoadError] = useState('');

  const load = () => fetchAPI('/drivers').then(setDrivers).catch(err => setLoadError(err.message));

  useEffect(() => { load(); }, []);

  const isExpiringSoon = (dateStr) => {
    if (!dateStr) return false;
    const days = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
    return days < 30; // vencido o vence en menos de 30 días
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este conductor?')) return;
    try {
      await fetchAPI(`/drivers/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const toggleStatus = async (d) => {
    const newStatus = d.status === 'active' ? 'inactive' : 'active';
    try {
      await fetchAPI(`/drivers/${d.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      load();
    } catch (err) {
      setLoadError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Users className="text-[#6366F1]" /> Conductores
      </h2>
      <ErrorBanner message={loadError} />
      <p className="text-slate-400 text-sm">
        Cualquier conductor puede manejar cualquier auto de la flota — no quedan atados a un vehículo fijo.
      </p>

      {/* El alta ahora se hace desde Usuarios (les da login + manda credenciales) */}
      <div className="flex items-center gap-2 text-sm text-[#818CF8] bg-[#6366F1]/10 border border-[#6366F1]/30 rounded-xl px-4 py-3 w-fit">
        <UserCog size={16} /> Para agregar un chofer nuevo (con login, DNI y vencimiento de carnet), andá a la tab "Usuarios"
      </div>

      {/* Lista de conductores — tarjetas, ya son app-friendly en mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {drivers.map(d => (
          <div key={d.id} className="bg-[#1E293B]/50 p-6 rounded-2xl border border-slate-700 flex flex-col gap-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">{d.full_name}</h3>
                <button
                  onClick={() => toggleStatus(d)}
                  className={`text-[11px] px-2 py-0.5 rounded-full mt-1 inline-block ${
                    d.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-slate-700/50 text-slate-400'
                  }`}
                >
                  {d.status === 'active' ? 'Activo' : 'Inactivo'}
                </button>
              </div>
              <button onClick={() => handleDelete(d.id)} className="text-red-500 hover:text-red-400 shrink-0">
                <Trash2 size={18} />
              </button>
            </div>

            <div className="space-y-1.5 text-sm text-slate-300">
              {d.phone_number && (
                <p className="flex items-center gap-2"><Phone size={14} className="text-slate-500" /> {d.phone_number}</p>
              )}
              {d.dni && (
                <p className="flex items-center gap-2"><IdCard size={14} className="text-slate-500" /> DNI: {d.dni}</p>
              )}
              {d.license_expiry && (
                <p className={`flex items-center gap-2 ${isExpiringSoon(d.license_expiry) ? 'text-[#F59E0B]' : ''}`}>
                  {isExpiringSoon(d.license_expiry) ? <AlertTriangle size={14} /> : <IdCard size={14} className="text-slate-500" />}
                  Carnet vence: {new Date(d.license_expiry).toLocaleDateString('es-AR')}
                </p>
              )}
            </div>

            <div className="flex justify-between items-center bg-[#0B1120] p-3 rounded-lg mt-1">
              <span className="text-sm text-slate-400">Score de Manejo IA</span>
              <span className={`font-bold ${d.avg_score > 80 ? 'text-[#10B981]' : d.avg_score ? 'text-[#F59E0B]' : 'text-slate-500'}`}>
                {d.avg_score ? parseFloat(d.avg_score).toFixed(1) : 'N/A'}/100
              </span>
            </div>
          </div>
        ))}

        {drivers.length === 0 && !loadError && (
          <p className="text-slate-500 text-sm md:col-span-2">Todavía no cargaste ningún conductor.</p>
        )}
      </div>
    </div>
  );
}
