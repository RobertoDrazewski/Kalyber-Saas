import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { Key, Plus, Copy, Trash2, Check, AlertTriangle, Code2 } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

const API_BASE = 'https://kalyber-saas-production.up.railway.app/api/v1';

function fmtDate(d) {
  if (!d) return 'nunca';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-slate-400 hover:text-white shrink-0"
    >
      {copied ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />}
    </button>
  );
}

export default function TabApiKeys() {
  const [keys, setKeys] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null); // se muestra UNA sola vez

  const load = () => fetchAPI('/apikeys').then(setKeys).catch(err => setLoadError(err.message));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await fetchAPI('/apikeys', { method: 'POST', body: JSON.stringify({ label: label || 'Sin nombre' }) });
      setNewKey(result.api_key);
      setLabel('');
      load();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm('¿Revocar esta API key? Cualquier sistema que la use va a dejar de funcionar de inmediato.')) return;
    try {
      await fetchAPI(`/apikeys/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setLoadError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Key className="text-[#F59E0B]" /> API Keys — Integraciones
      </h2>
      <p className="text-slate-500 text-sm -mt-4">
        Generá una clave para que un sistema externo tuyo (ERP, planilla propia, lo que sea) pueda leer los datos de tu propia flota — vehículos, telemetría y viajes. Nunca puede ver ni tocar datos de otro cliente.
      </p>
      <ErrorBanner message={loadError} />

      {/* Alta */}
      <div className="bg-[#1E293B]/50 p-6 rounded-2xl border border-slate-700 space-y-4">
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Nombre (para reconocerla después)</label>
            <input
              className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white"
              placeholder="ej. Integración con mi ERP"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>
          <button type="submit" disabled={creating} className="bg-[#6366F1] px-6 py-2.5 rounded-lg text-white font-bold flex items-center justify-center gap-2 hover:bg-[#4F46E5] disabled:opacity-60">
            <Plus size={18} /> {creating ? 'Generando...' : 'Generar nueva key'}
          </button>
        </form>

        {newKey && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 space-y-2">
            <p className="text-amber-400 text-sm font-bold flex items-center gap-2">
              <AlertTriangle size={16} /> Guardala ahora — no la vamos a volver a mostrar
            </p>
            <div className="flex items-center gap-2 bg-[#0B1120] rounded-lg px-3 py-2 font-mono text-sm text-white overflow-x-auto">
              <span className="whitespace-nowrap">{newKey}</span>
              <CopyButton text={newKey} />
            </div>
            <button onClick={() => setNewKey(null)} className="text-xs text-slate-400 hover:text-white">Ya la guardé, cerrar</button>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-[#0B1120] text-slate-400">
            <tr>
              <th className="px-6 py-3">Nombre</th>
              <th className="px-6 py-3">Clave</th>
              <th className="px-6 py-3">Último uso</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {keys.map(k => (
              <tr key={k.id}>
                <td className="px-6 py-3">{k.label}</td>
                <td className="px-6 py-3 font-mono text-xs text-slate-500">{k.key_prefix}...</td>
                <td className="px-6 py-3 text-xs">{fmtDate(k.last_used_at)}</td>
                <td className="px-6 py-3">
                  {k.revoked_at
                    ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">Revocada</span>
                    : <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981]">Activa</span>}
                </td>
                <td className="px-6 py-3 text-right">
                  {!k.revoked_at && (
                    <button onClick={() => handleRevoke(k.id)} className="text-red-500 hover:text-red-400"><Trash2 size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Todavía no generaste ninguna API key.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Referencia rápida */}
      <div className="bg-[#1E293B]/30 rounded-2xl border border-slate-800 p-6">
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Code2 size={16} /> Cómo se usa</h3>
        <p className="text-xs text-slate-400 mb-3">Mandale esto a quien programe la integración — con la key, cualquier request a estos endpoints le devuelve solo los datos de tu flota:</p>
        <div className="bg-[#0B1120] rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1 overflow-x-auto">
          <p className="text-slate-500"># Header en cada request:</p>
          <p>Authorization: Bearer kal_live_...</p>
          <p className="text-slate-500 pt-2"># Endpoints disponibles:</p>
          <p>GET {API_BASE}/vehicles</p>
          <p>GET {API_BASE}/vehicles/:id/telemetry</p>
          <p>GET {API_BASE}/trips</p>
          <p>GET {API_BASE}/drivers</p>
        </div>
      </div>
    </div>
  );
}
