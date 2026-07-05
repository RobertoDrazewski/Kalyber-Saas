import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { UserCog, Plus, Trash2, Shield } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

export default function TabUsuarios() {
  const currentUser = JSON.parse(localStorage.getItem('kyber_user') || '{}');
  const canCreateRole = currentUser.role === 'super_admin' ? 'admin' : 'driver';

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone_number: '', license_number: '' });
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => fetchAPI('/users').then(setUsers).catch(err => setLoadError(err.message));

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await fetchAPI('/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, role: canCreateRole }),
      });
      setForm({ name: '', email: '', password: '', phone_number: '', license_number: '' });
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

  const roleLabel = { super_admin: 'Super Admin', admin: 'Admin de flota', driver: 'Chofer' };
  const roleColor = { super_admin: 'text-[#F59E0B]', admin: 'text-[#6366F1]', driver: 'text-[#10B981]' };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <UserCog className="text-[#6366F1]" /> Usuarios
      </h2>
      <ErrorBanner message={loadError} />
      <p className="text-slate-400 text-sm">
        {currentUser.role === 'super_admin'
          ? 'Como Super Admin creás cuentas de Admin — cada una gestiona su propia flota, aislada del resto.'
          : 'Creá logins para tus choferes — van a poder entrar a su vista de mapa y elegir su auto.'}
      </p>

      {/* Alta de usuario */}
      <div className="bg-[#1E293B]/50 p-6 rounded-2xl border border-slate-700 space-y-4">
        {formError && <div className="bg-[#EF4444]/20 text-[#EF4444] p-3 rounded-lg text-sm">{formError}</div>}
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input required placeholder="Nombre completo" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input required type="email" placeholder="Email (para el login)" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input required type="password" placeholder="Password inicial" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          {canCreateRole === 'driver' && (
            <input placeholder="Teléfono (opcional)" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} />
          )}
          <button type="submit" disabled={saving} className="sm:col-span-2 bg-[#6366F1] px-6 py-2.5 rounded-lg text-white font-bold flex items-center justify-center gap-2 hover:bg-[#4F46E5] disabled:opacity-60">
            <Plus size={18} /> {saving ? 'Creando...' : `Crear ${canCreateRole === 'admin' ? 'Admin' : 'Chofer'}`}
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
