import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { Plus, Trash2, Phone, IdCard, Users } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

export default function TabConductores() {
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ full_name: '', phone_number: '', license_number: '' });
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => fetchAPI('/drivers').then(setDrivers).catch(err => setLoadError(err.message));

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.full_name.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      await fetchAPI('/drivers', { method: 'POST', body: JSON.stringify(form) });
      setForm({ full_name: '', phone_number: '', license_number: '' });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
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

      {/* Alta de conductor */}
      <div className="bg-[#1E293B]/50 p-6 rounded-2xl border border-slate-700 space-y-4">
        {formError && <div className="bg-[#EF4444]/20 text-[#EF4444] p-3 rounded-lg text-sm">{formError}</div>}
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-400 mb-1">Nombre completo</label>
            <input
              className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white"
              placeholder="Juan Pérez"
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
            <input
              className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white"
              placeholder="+54 9 261 000-0000"
              value={form.phone_number}
              onChange={e => setForm({ ...form, phone_number: e.target.value })}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-slate-400 mb-1">Licencia (opcional)</label>
            <input
              className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white"
              placeholder="N° de licencia"
              value={form.license_number}
              onChange={e => setForm({ ...form, license_number: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-[#6366F1] px-6 py-2 rounded-lg text-white font-bold flex items-center justify-center gap-2 hover:bg-[#4F46E5] h-[42px] disabled:opacity-60"
          >
            <Plus size={18} /> {saving ? 'Agregando...' : 'Agregar'}
          </button>
        </form>
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
              {d.license_number && (
                <p className="flex items-center gap-2"><IdCard size={14} className="text-slate-500" /> Licencia: {d.license_number}</p>
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
