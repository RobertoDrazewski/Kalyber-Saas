import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { Radio, Plus, Link2, Unlink } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

const MODEL_INFO = {
  VL04: { label: 'JM-VL04 · Plan Básico', color: 'text-slate-300', desc: 'Inercial 4G — GPS + acelerómetro, sin ECU' },
  VL502: { label: 'JM-VL502 · Plan Avanzado', color: 'text-[#6366F1]', desc: 'Escáner OBD2 — lee ECU/CAN real (RPM, temp, combustible, DTC)' },
};

export default function TabEquipos() {
  const [devices, setDevices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ imei: '', label: '', model: 'VL502' });
  const [pairTarget, setPairTarget] = useState({});
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([
    fetchAPI('/devices').then(setDevices),
    fetchAPI('/vehicles').then(setVehicles),
  ]).catch(err => setLoadError(err.message));

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.imei.trim()) {
      setFormError('El IMEI es obligatorio');
      return;
    }
    setSaving(true);
    try {
      await fetchAPI('/devices', { method: 'POST', body: JSON.stringify(form) });
      setForm({ imei: '', label: '', model: 'VL502' });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePair = async (imei) => {
    const vehicle_id = pairTarget[imei];
    if (!vehicle_id) return;
    try {
      await fetchAPI('/devices/pair', { method: 'POST', body: JSON.stringify({ imei, vehicle_id }) });
      load();
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const handleUnpair = async (imei) => {
    if (!confirm('¿Desparear este equipo del vehículo?')) return;
    try {
      await fetchAPI(`/devices/${imei}/pair`, { method: 'DELETE' });
      load();
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const availableVehicles = vehicles.filter(v => v.source !== 'simulated' && !v.device_imei);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Radio className="text-[#10B981]" /> Equipos GPS / OBD2
      </h2>
      <ErrorBanner message={loadError} />
      <p className="text-slate-400 text-sm max-w-2xl">
        Acá das de alta cada equipo apenas te llegue (por IMEI), antes de instalarlo. Una vez programado y probado con la prestadora, lo vinculás al vehículo del cliente.
      </p>

      {/* Alta de equipo */}
      <div className="bg-[#1E293B]/50 p-6 rounded-2xl border border-slate-700 space-y-4">
        {formError && <div className="bg-[#EF4444]/20 text-[#EF4444] p-3 rounded-lg text-sm">{formError}</div>}
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-400 mb-1">IMEI</label>
            <input
              className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white font-mono"
              placeholder="15 dígitos"
              value={form.imei}
              onChange={e => setForm({ ...form, imei: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Modelo</label>
            <select
              className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white w-full sm:w-56"
              value={form.model}
              onChange={e => setForm({ ...form, model: e.target.value })}
            >
              <option value="VL04">JM-VL04 (Básico)</option>
              <option value="VL502">JM-VL502 (Avanzado)</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-slate-400 mb-1">Etiqueta (opcional)</label>
            <input
              className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white"
              placeholder="ej. Lote julio 2026"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-[#6366F1] px-6 py-2 rounded-lg text-white font-bold flex items-center justify-center gap-2 hover:bg-[#4F46E5] h-[42px] disabled:opacity-60"
          >
            <Plus size={18} /> {saving ? 'Agregando...' : 'Dar de alta'}
          </button>
        </form>
      </div>

      {/* Lista de equipos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map(d => {
          const info = MODEL_INFO[d.model] || MODEL_INFO.VL502;
          return (
            <div key={d.id} className="bg-[#1E293B]/50 p-5 rounded-2xl border border-slate-700 space-y-3">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-mono text-white font-bold">{d.imei}</p>
                  <p className={`text-xs font-semibold ${info.color}`}>{info.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{info.desc}</p>
                  {d.label && <p className="text-[11px] text-slate-500 mt-0.5">"{d.label}"</p>}
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                  d.status === 'paired' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-slate-700/50 text-slate-400'
                }`}>
                  {d.status === 'paired' ? `Pareado — ${d.vehicle_plate}` : 'Sin parear'}
                </span>
              </div>

              {d.status === 'paired' ? (
                <button
                  onClick={() => handleUnpair(d.imei)}
                  className="w-full flex items-center justify-center gap-2 text-sm bg-[#EF4444]/10 text-[#EF4444] py-2 rounded-lg hover:bg-[#EF4444]/20"
                >
                  <Unlink size={14} /> Desparear
                </button>
              ) : (
                <div className="flex gap-2">
                  <select
                    className="flex-1 bg-[#0B1120] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={pairTarget[d.imei] || ''}
                    onChange={e => setPairTarget({ ...pairTarget, [d.imei]: e.target.value })}
                  >
                    <option value="">Elegir vehículo...</option>
                    {availableVehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handlePair(d.imei)}
                    disabled={!pairTarget[d.imei]}
                    className="bg-[#10B981]/20 text-[#10B981] px-3 rounded-lg hover:bg-[#10B981]/30 disabled:opacity-40 shrink-0"
                  >
                    <Link2 size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {devices.length === 0 && !loadError && (
          <p className="text-slate-500 text-sm md:col-span-2">Todavía no diste de alta ningún equipo.</p>
        )}
      </div>
    </div>
  );
}
