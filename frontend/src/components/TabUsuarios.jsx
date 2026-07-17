import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { UserCog, Plus, Trash2, Shield, Mail, MessageCircle } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

const EMPTY_FORM = {
  role: '', email: '', password: '', phone_number: '',
  entity_type: 'persona', first_name: '', last_name: '', dni: '',
  company_name: '', cuit: '', license_expiry: '',
};

const roleLabel = { super_admin: 'Super Admin', admin: 'Admin de flota', driver: 'Chofer' };
const roleColor = { super_admin: 'text-[#F59E0B]', admin: 'text-[#6366F1]', driver: 'text-[#10B981]' };

export default function TabUsuarios() {
  const currentUser = JSON.parse(localStorage.getItem('kyber_user') || '{}');
  // super_admin puede crear admin o chofer (para cualquier flota);
  // admin solo puede crear chofer (para la suya propia).
  const creatableRoles = currentUser.role === 'super_admin' ? ['admin', 'driver'] : ['driver'];

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, role: creatableRoles[0] });
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [lastNotif, setLastNotif] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => fetchAPI('/users').then(setUsers).catch(err => setLoadError(err.message));
  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    setLastNotif(null);
    setSaving(true);
    try {
      const payload = { ...form };
      if (form.role !== 'admin') delete payload.entity_type;
      if (!payload.password) delete payload.password; // el backend genera una si no la mandamos
      const result = await fetchAPI('/users', { method: 'POST', body: JSON.stringify(payload) });
      setLastNotif(result.notif || null);
      setForm({ ...EMPTY_FORM, role: creatableRoles[0] });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario? Pierde acceso inmediatamente.')) return;
    try {
      await fetchAPI(`/users/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setLoadError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <UserCog className="text-[#6366F1]" /> Usuarios
      </h2>
      <ErrorBanner message={loadError} />
      <p className="text-slate-400 text-sm">
        {currentUser.role === 'super_admin'
          ? 'Creá administradores de flota (clientes) o choferes para cualquier flota. Cada uno recibe su usuario y clave por mail (y por WhatsApp si es chofer).'
          : 'Creá los choferes de tu flota — reciben su login por mail y WhatsApp, y quedan listos para elegir auto en su vista.'}
      </p>

      {/* Alta de usuario */}
      <div className="bg-[#1E293B]/50 p-6 rounded-2xl border border-slate-700 space-y-4">
        {formError && <div className="bg-[#EF4444]/20 text-[#EF4444] p-3 rounded-lg text-sm">{formError}</div>}
        {lastNotif && (
          <div className="bg-[#10B981]/10 text-[#10B981] p-3 rounded-lg text-sm flex flex-wrap gap-4">
            <span className="flex items-center gap-1"><Mail size={14} /> Mail: {lastNotif.email?.sent ? 'enviado' : 'no se pudo enviar'}</span>
            {lastNotif.whatsapp && (
              <span className="flex items-center gap-1"><MessageCircle size={14} /> WhatsApp: {lastNotif.whatsapp.sent ? 'enviado' : `no enviado (${lastNotif.whatsapp.reason || 'proveedor no configurado'})`}</span>
            )}
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-4">
          {/* Selector de rol — solo tiene sentido si el creador puede crear más de un tipo */}
          {creatableRoles.length > 1 && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo de usuario a crear</label>
              <div className="flex gap-2">
                {creatableRoles.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...EMPTY_FORM, role: r })}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
                      form.role === r ? 'bg-[#6366F1] border-[#6366F1] text-white' : 'border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {roleLabel[r]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required type="email" placeholder="Email (usuario de login)" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input type="password" placeholder="Contraseña (vacío = se genera sola)" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>

          {/* Admin: persona física vs empresa */}
          {form.role === 'admin' && (
            <>
              <div className="flex gap-2">
                {['persona', 'empresa'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, entity_type: t })}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
                      form.entity_type === t ? 'bg-[#6366F1] border-[#6366F1] text-white' : 'border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t === 'persona' ? 'Persona física' : 'Empresa'}
                  </button>
                ))}
              </div>
              {form.entity_type === 'persona' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input required placeholder="Nombre" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                  <input required placeholder="Apellido" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                  <input required placeholder="DNI" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input required placeholder="Razón social" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                  <input required placeholder="CUIT" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.cuit} onChange={e => setForm({ ...form, cuit: e.target.value })} />
                </div>
              )}
              <input placeholder="Teléfono de contacto (opcional)" className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} />
            </>
          )}

          {/* Chofer: nombre, apellido, DNI, vencimiento de carnet, teléfono */}
          {form.role === 'driver' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input required placeholder="Nombre" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
              <input required placeholder="Apellido" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
              <input required placeholder="DNI" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
              <div>
                <label className="block text-xs text-slate-400 mb-1">Vencimiento del carnet de conducir</label>
                <input required type="date" className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.license_expiry} onChange={e => setForm({ ...form, license_expiry: e.target.value })} />
              </div>
              <input required placeholder="Teléfono (para alertas de manejo)" className="sm:col-span-2 bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} />
            </div>
          )}

          <button type="submit" disabled={saving} className="w-full bg-[#6366F1] px-6 py-2.5 rounded-lg text-white font-bold flex items-center justify-center gap-2 hover:bg-[#4F46E5] disabled:opacity-60">
            <Plus size={18} /> {saving ? 'Creando...' : `Crear ${roleLabel[form.role] || ''}`}
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map(u => (
          <div key={u.id} className="bg-[#1E293B]/50 p-5 rounded-2xl border border-slate-700 flex justify-between items-center">
            <div>
              <p className="text-white font-bold">{u.name}</p>
              <p className="text-xs text-slate-400">{u.email}</p>
              {u.dni && <p className="text-[11px] text-slate-500">DNI {u.dni}</p>}
              {u.cuit && <p className="text-[11px] text-slate-500">CUIT {u.cuit}</p>}
              <p className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${roleColor[u.role] || 'text-slate-400'}`}>
                <Shield size={12} /> {roleLabel[u.role] || u.role}
              </p>
            </div>
            {u.id !== currentUser.id && (
              <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-400">
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
        {users.length === 0 && !loadError && <p className="text-slate-500 text-sm md:col-span-2">Todavía no creaste usuarios.</p>}
      </div>
    </div>
  );
}
