import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { UserCog, Plus, Trash2, Shield, Mail, MessageCircle, Wrench, Building2, ChevronDown, ChevronUp, Car } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

const EMPTY_FORM = {
  role: '', email: '', password: '', phone_number: '',
  entity_type: 'persona', first_name: '', last_name: '', dni: '',
  company_name: '', cuit: '', license_expiry: '',
  // [NUEVO 17/07/2026] Campos propios del alta de Taller (Kalyber
  // Scanner) — separados de company_name/cuit de arriba a propósito:
  // esos son del alta genérica de "admin" (Users), estos son los que
  // arma el registro de Workshops en sí (nombre comercial del taller
  // puede diferir del nombre legal, dirección física, dueño/responsable).
  workshop_name: '', workshop_cuit: '', workshop_owner_name: '',
  workshop_phone: '', workshop_address: '',
};

const roleLabel = { super_admin: 'Super Admin', admin: 'Admin de flota', driver: 'Chofer', taller: 'Taller (Kalyber Scanner)' };
const roleColor = { super_admin: 'text-[#F59E0B]', admin: 'text-[#6366F1]', driver: 'text-[#10B981]', taller: 'text-[#EC4899]' };

export default function TabUsuarios() {
  const currentUser = JSON.parse(localStorage.getItem('kyber_user') || '{}');
  // super_admin puede crear admin, chofer, o dar de alta un Taller
  // (producto Kalyber Scanner — ver nota completa más abajo en
  // handleAdd); admin solo puede crear chofer para la suya propia.
  const creatableRoles = currentUser.role === 'super_admin' ? ['admin', 'driver', 'taller'] : ['driver'];

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, role: creatableRoles[0] });
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [lastNotif, setLastNotif] = useState(null);
  const [saving, setSaving] = useState(false);

  // [NUEVO 17/07/2026] Talleres — solo super_admin las ve. Vive
  // separado de `users` porque Workshops es una tabla propia (no es
  // un Users más), con sus propios datos comerciales y estadísticas
  // de uso (equipos pareados, autos escaneados, DTCs).
  const [workshops, setWorkshops] = useState([]);
  const [expandedWorkshop, setExpandedWorkshop] = useState(null);
  const [workshopHistory, setWorkshopHistory] = useState({});
  const loadWorkshops = () => {
    if (currentUser.role !== 'super_admin') return;
    fetchAPI('/scanner/workshops').then(rows => setWorkshops(Array.isArray(rows) ? rows : [])).catch(() => {});
  };

  const load = () => fetchAPI('/users').then(rows => setUsers(Array.isArray(rows) ? rows : [])).catch(err => setLoadError(err.message));
  useEffect(() => { load(); loadWorkshops(); }, []);

  const toggleWorkshopHistory = async (id) => {
    if (expandedWorkshop === id) { setExpandedWorkshop(null); return; }
    setExpandedWorkshop(id);
    if (!workshopHistory[id]) {
      try {
        const rows = await fetchAPI(`/scanner/workshops/${id}/history`);
        setWorkshopHistory(prev => ({ ...prev, [id]: Array.isArray(rows) ? rows : [] }));
      } catch {
        setWorkshopHistory(prev => ({ ...prev, [id]: [] }));
      }
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    setLastNotif(null);
    setSaving(true);
    try {
      if (form.role === 'taller') {
        // [NUEVO 17/07/2026] Alta de Taller — dos pasos, porque en el
        // backend son dos tablas distintas a propósito (Users para el
        // login, Workshops para los datos comerciales + el resto del
        // producto Kalyber Scanner). No hay un rol 'taller' en Users
        // — se crea como 'admin' + entity_type 'empresa' (mismo
        // criterio que cualquier admin de flota tipo empresa), y ESO
        // es lo que usa para loguearse en /scanner.
        if (!form.workshop_name || !form.workshop_cuit) {
          setFormError('Nombre del taller y CUIT son obligatorios');
          setSaving(false);
          return;
        }
        const userResult = await fetchAPI('/users', {
          method: 'POST',
          body: JSON.stringify({
            role: 'taller',
            email: form.email,
            password: form.password || undefined,
            company_name: form.workshop_name,
            cuit: form.workshop_cuit,
            phone_number: form.workshop_phone,
          }),
        });

        try {
          await fetchAPI('/scanner/workshops', {
            method: 'POST',
            body: JSON.stringify({
              name: form.workshop_name,
              cuit: form.workshop_cuit,
              owner_name: form.workshop_owner_name,
              phone: form.workshop_phone,
              email: form.email,
              address: form.workshop_address,
              owner_user_id: userResult.id,
            }),
          });
        } catch (workshopErr) {
          // El usuario de login YA quedó creado en este punto — no lo
          // revertimos (no hay transacción cross-request), pero
          // avisamos bien claro para que no quede a medias sin que el
          // super_admin se entere.
          setFormError(`El login se creó bien (${form.email}), pero falló el alta del taller: ${workshopErr.message}. Reintentá el taller solo, sin recrear el usuario.`);
          setSaving(false);
          load();
          return;
        }

        setLastNotif(userResult.notif || null);
        setForm({ ...EMPTY_FORM, role: creatableRoles[0] });
        load();
        loadWorkshops();
        setSaving(false);
        return;
      }

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

          {/* [NUEVO 17/07/2026] Taller (Kalyber Scanner) — nombre
              comercial, CUIT, dueño/responsable, teléfono y dirección
              del local. El email/password de arriba son el login que
              va a usar el mecánico para entrar a /scanner. */}
          {form.role === 'taller' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input required placeholder="Nombre del taller" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.workshop_name} onChange={e => setForm({ ...form, workshop_name: e.target.value })} />
                <input required placeholder="CUIT" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.workshop_cuit} onChange={e => setForm({ ...form, workshop_cuit: e.target.value })} />
              </div>
              <input placeholder="Nombre del dueño/responsable" className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.workshop_owner_name} onChange={e => setForm({ ...form, workshop_owner_name: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input placeholder="Teléfono del taller" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.workshop_phone} onChange={e => setForm({ ...form, workshop_phone: e.target.value })} />
                <input placeholder="Dirección del local" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white" value={form.workshop_address} onChange={e => setForm({ ...form, workshop_address: e.target.value })} />
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Wrench size={11} /> El mecánico va a entrar a <code className="text-[#EC4899]">/scanner</code> con el email y la contraseña de arriba.</p>
            </div>
          )}

          <button type="submit" disabled={saving} className="w-full bg-[#6366F1] px-6 py-2.5 rounded-lg text-white font-bold flex items-center justify-center gap-2 hover:bg-[#4F46E5] disabled:opacity-60">
            <Plus size={18} /> {saving ? 'Creando...' : `Crear ${roleLabel[form.role] || ''}`}
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map(u => {
          // Si este 'admin' es en realidad el login de un taller, se lo
          // marcamos distinto acá — Users no tiene un rol 'taller'
          // propio (ver nota en handleAdd), así que lo resolvemos
          // cruzando contra la lista de Workshops ya cargada.
          const asWorkshop = workshops.find(w => w.owner_user_id === u.id);
          return (
            <div key={u.id} className="bg-[#1E293B]/50 p-5 rounded-2xl border border-slate-700 flex justify-between items-center">
              <div>
                <p className="text-white font-bold">{u.name}</p>
                <p className="text-xs text-slate-400">{u.email}</p>
                {u.dni && <p className="text-[11px] text-slate-500">DNI {u.dni}</p>}
                {u.cuit && <p className="text-[11px] text-slate-500">CUIT {u.cuit}</p>}
                {asWorkshop ? (
                  <p className="text-[11px] font-semibold mt-1 flex items-center gap-1 text-[#EC4899]">
                    <Wrench size={12} /> Taller — {asWorkshop.name}
                  </p>
                ) : (
                  <p className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${roleColor[u.role] || 'text-slate-400'}`}>
                    <Shield size={12} /> {roleLabel[u.role] || u.role}
                  </p>
                )}
              </div>
              {u.id !== currentUser.id && (
                <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-400">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          );
        })}
        {users.length === 0 && !loadError && <p className="text-slate-500 text-sm md:col-span-2">Todavía no creaste usuarios.</p>}
      </div>

      {/* [NUEVO 17/07/2026] Talleres — solo super_admin. Datos
          comerciales + estadísticas de uso de cada uno, con historial
          de autos escaneados expandible (SIN patente/foto acá — ver
          nota de privacidad en migration-scanner-product.sql, esos
          datos son propiedad del taller, no de Kalyber). */}
      {currentUser.role === 'super_admin' && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="text-[#EC4899]" size={20} /> Talleres (Kalyber Scanner)
          </h3>
          {workshops.length === 0 ? (
            <p className="text-slate-500 text-sm">Todavía no diste de alta ningún taller.</p>
          ) : (
            <div className="space-y-3">
              {workshops.map(w => (
                <div key={w.id} className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 overflow-hidden">
                  <button onClick={() => toggleWorkshopHistory(w.id)} className="w-full flex items-center justify-between p-5 text-left">
                    <div>
                      <p className="text-white font-bold flex items-center gap-2">
                        {w.name}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          w.subscription_status === 'active' ? 'bg-[#10B981]/15 text-[#10B981]' :
                          w.subscription_status === 'trial' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          {w.subscription_status === 'active' ? 'Activo' : w.subscription_status === 'trial' ? 'Prueba' : w.subscription_status}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{w.owner_name || 'Sin dueño registrado'} · CUIT {w.cuit || '—'}</p>
                      <div className="flex gap-4 mt-2 text-[11px] text-slate-500">
                        <span>{w.equipos_pareados} equipo(s)</span>
                        <span>{w.autos_escaneados} auto(s) escaneados</span>
                        <span>{w.dtcs_totales} DTC(s) detectados</span>
                      </div>
                    </div>
                    {expandedWorkshop === w.id ? <ChevronUp size={18} className="text-slate-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
                  </button>

                  {expandedWorkshop === w.id && (
                    <div className="border-t border-slate-800 p-5 pt-4 bg-[#0B1120]/40">
                      <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5"><Car size={13} /> Autos escaneados</p>
                      {!workshopHistory[w.id] ? (
                        <p className="text-slate-600 text-xs">Cargando...</p>
                      ) : workshopHistory[w.id].length === 0 ? (
                        <p className="text-slate-600 text-xs">Este taller todavía no escaneó ningún auto.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {workshopHistory[w.id].map(v => (
                            <div key={v.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                              <span className="text-slate-300">{v.brand || 'Marca ?'} {v.model || ''} {v.model_year ? `(${v.model_year})` : ''} {v.vin ? <span className="text-slate-600 font-mono">· {v.vin}</span> : ''}</span>
                              <span className="text-slate-500">{v.sesiones} sesión(es) · {v.dtcs} DTC</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
