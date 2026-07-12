import { useState } from 'react';
import { fetchAPI } from '../services/api';
import { Camera, Paperclip } from 'lucide-react';

export const TYPE_OPTIONS = [
  { value: 'neumaticos', label: 'Neumáticos' },
  { value: 'frenos', label: 'Frenos' },
  { value: 'fluidos', label: 'Fluidos (aceite, etc.)' },
  { value: 'bateria', label: 'Batería' },
  { value: 'motor', label: 'Motor' },
  { value: 'otro', label: 'Otros' },
];
export const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map(t => [t.value, t.label]));
export const TYPE_COLOR = {
  neumaticos: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30',
  frenos: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30',
  fluidos: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30',
  bateria: 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/30',
  motor: 'bg-[#EC4899]/10 text-[#EC4899] border-[#EC4899]/30',
  otro: 'bg-slate-700/30 text-slate-300 border-slate-600',
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Formulario de alta/edición de un mantenimiento — LO MISMO lo usa el
// panel de admin (TabMantenimientoRealizado) y la vista del chofer
// (DriverView), para su propio auto asignado.
export default function MaintenanceEventForm({ vehicleId, currentOdometer, editing, onDone, onCancel }) {
  const [form, setForm] = useState({
    type: editing?.type || 'fluidos',
    description: editing?.description || '',
    event_date: editing?.event_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    km_at_event: editing?.km_at_event ?? currentOdometer ?? '',
    cost: editing?.cost || '',
    provider: editing?.provider || '',
  });
  const [photoBase64, setPhotoBase64] = useState(editing?.photo_url || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoBase64(await fileToBase64(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...form, vehicle_id: vehicleId, photo_url: photoBase64 };
      if (editing) {
        await fetchAPI(`/maintenance/events/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await fetchAPI('/maintenance/events', { method: 'POST', body: JSON.stringify(body) });
      }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#0B1120] border border-slate-700 rounded-xl p-4 space-y-3">
      {error && <div className="bg-[#EF4444]/20 text-[#EF4444] p-2 rounded-lg text-xs">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Tipo</label>
          <select className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Fecha</label>
          <input type="date" className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} required />
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-slate-400 mb-1">Descripción</label>
        <input className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="ej. Cambio de aceite y filtro" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Km</label>
          <input type="number" className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={form.km_at_event} onChange={e => setForm({ ...form, km_at_event: e.target.value })} />
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Costo ($)</label>
          <input type="number" className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Taller/proveedor</label>
          <input className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-slate-400 mb-1">Comprobante (foto o archivo)</label>
        <label className="flex items-center gap-2 w-fit px-3 py-2 rounded-lg border border-dashed border-slate-600 text-slate-400 text-xs cursor-pointer hover:border-[#6366F1] hover:text-white">
          <Camera size={14} /> {photoBase64 ? 'Cambiar archivo' : 'Subir foto del ticket'}
          <input type="file" accept="image/*,.pdf" capture="environment" onChange={handlePhoto} className="hidden" />
        </label>
        {photoBase64 && (
          <div className="mt-2">
            {photoBase64.startsWith('data:image') ? (
              <img src={photoBase64} className="h-20 rounded-lg border border-slate-700 object-cover" />
            ) : (
              <span className="text-xs text-[#10B981] flex items-center gap-1"><Paperclip size={12} /> Archivo adjunto</span>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-[#6366F1] py-2 rounded-lg text-white text-sm font-bold hover:bg-[#4F46E5] disabled:opacity-60">
          {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar mantenimiento'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:text-white">Cancelar</button>
      </div>
    </form>
  );
}
