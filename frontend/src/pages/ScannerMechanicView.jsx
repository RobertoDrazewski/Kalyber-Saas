import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI, API_URL } from '../services/api';
import {
  Car, Wifi, Activity, Camera, Plus, X, Copy, CheckCircle2,
  AlertTriangle, ShieldAlert, Loader2, ChevronRight, RadioTower,
  Wrench, ThumbsUp, ThumbsDown, Play, Square, Clock, History,
  LogOut, Home, ChevronDown, ChevronUp, BarChart3, Download,
  Search, TrendingUp,
} from 'lucide-react';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// Vista del mecánico — pensada para usarse desde el celular, parada
// al lado del auto. Login: la misma cuenta que ya usan (rol 'admin'),
// no hace falta nada nuevo ahí. Tres pestañas simples, siempre a mano
// abajo de la pantalla (como el resto de la app en mobile).
// ============================================================
export default function ScannerMechanicView() {
  const [tab, setTab] = useState('autos'); // 'autos' | 'parear' | 'vivo' | 'historico' | 'stats'
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('kyber_token');
    localStorage.removeItem('kyber_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col">
      <div className="px-4 pt-5 pb-3 flex items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <RadioTower className="text-[#10B981] shrink-0" size={22} />
          <h1 className="text-lg font-bold text-white truncate">Kalyber Scanner</h1>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => navigate('/')}
            title="Volver a la web"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E293B] transition-colors"
          >
            <Home size={18} />
          </button>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 px-4 pt-4">
        {tab === 'autos' && <TabAutos />}
        {tab === 'parear' && <TabParear />}
        {tab === 'vivo' && <TabDiagnosticoVivo />}
        {tab === 'historico' && <TabHistoricoVehiculos />}
        {tab === 'stats' && <TabEstadisticas />}
      </div>

      {/* Nav inferior fija — igual criterio que BottomNav del resto de la app */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#050B14] border-t border-slate-800 flex items-stretch z-40">
        <NavBtn icon={Car} label="Autos" active={tab === 'autos'} onClick={() => setTab('autos')} />
        <NavBtn icon={Wifi} label="Parear" active={tab === 'parear'} onClick={() => setTab('parear')} />
        <NavBtn icon={Activity} label="En vivo" active={tab === 'vivo'} onClick={() => setTab('vivo')} />
        <NavBtn icon={History} label="Histórico" active={tab === 'historico'} onClick={() => setTab('historico')} />
        <NavBtn icon={BarChart3} label="Stats" active={tab === 'stats'} onClick={() => setTab('stats')} />
      </div>
    </div>
  );
}

function NavBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1 ${active ? 'text-[#10B981]' : 'text-slate-500'}`}>
      <Icon size={20} />
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

// ============================================================
// PESTAÑA 1 — Autos: alta con foto de patente + lista con historial
// ============================================================
function TabAutos() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    // [FIX 17/07/2026] Blindaje encontrado en testing: si el backend
    // devolviera algo que no sea un array (error de red, sesión
    // vencida, etc.), .map() explota y — como esta app no tiene
    // ErrorBoundary — tira abajo TODA la vista, no solo esta pestaña.
    fetchAPI('/scanner/vehicles')
      .then(rows => setVehicles(Array.isArray(rows) ? rows : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (showForm) return <NuevoAutoForm onDone={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />;

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm active:scale-95 transition-transform"
      >
        <Plus size={18} /> Nuevo auto a escanear
      </button>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <p className="text-slate-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando...</p>}

      {!loading && vehicles.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Car size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Todavía no cargaste ningún auto.</p>
        </div>
      )}

      <div className="space-y-2">
        {vehicles.map(v => (
          <div key={v.id} className="bg-[#1E293B]/60 rounded-xl border border-slate-700 p-3 flex items-center gap-3">
            {v.plate_photo_url ? (
              <img src={v.plate_photo_url} className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center shrink-0"><Car size={20} className="text-slate-600" /></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm truncate">{v.brand || 'Marca ?'} {v.model || ''} {v.model_year ? `(${v.model_year})` : ''}</p>
              <p className="text-slate-500 text-xs truncate">{v.customer_label || v.vin || 'Sin datos de cliente'}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-slate-400">{v.sesiones ?? v.total_sesiones ?? 0} sesión(es)</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevoAutoForm({ onDone, onCancel }) {
  const [form, setForm] = useState({ brand: '', model: '', model_year: '', vin: '', plate_text: '', customer_label: '' });
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // [NUEVO 19/07/2026] "Este auto ya estuvo acá" — mientras el
  // mecánico tipea la patente, buscamos en segundo plano (con
  // debounce, para no pegarle al backend en cada letra) si ya existe
  // un auto con esa patente en este taller. Si lo encuentra, se lo
  // avisamos ANTES de que cargue un duplicado sin darse cuenta.
  const [existingMatch, setExistingMatch] = useState(null);
  const [checkingPlate, setCheckingPlate] = useState(false);
  const lookupTimer = useRef(null);

  useEffect(() => {
    clearTimeout(lookupTimer.current);
    setExistingMatch(null);
    if (form.plate_text.length < 4) return;
    setCheckingPlate(true);
    lookupTimer.current = setTimeout(() => {
      fetchAPI(`/scanner/vehicles/lookup?plate=${encodeURIComponent(form.plate_text)}`)
        .then(res => setExistingMatch(res))
        .catch(() => setExistingMatch(null))
        .finally(() => setCheckingPlate(false));
    }, 500);
    return () => clearTimeout(lookupTimer.current);
  }, [form.plate_text]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(await fileToBase64(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.plate_text) { setError('La patente es obligatoria — es lo que el equipo usa para identificar el auto al escanear.'); return; }
    setSaving(true);
    setError('');
    try {
      await fetchAPI('/scanner/vehicles', { method: 'POST', body: JSON.stringify({ ...form, plate_photo_url: photo }) });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold">Nuevo auto</h2>
        <button type="button" onClick={onCancel} className="text-slate-400"><X size={20} /></button>
      </div>

      {/* Foto de patente — botón grande, cámara directa en mobile */}
      <label className="block">
        <div className="w-full aspect-video rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-2 bg-[#1E293B]/40 overflow-hidden">
          {photo ? (
            <img src={photo} className="w-full h-full object-cover" />
          ) : (
            <>
              <Camera size={28} className="text-slate-500" />
              <span className="text-slate-500 text-sm">Sacar foto de la patente</span>
            </>
          )}
        </div>
        <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
      </label>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">Patente *</label>
        <input
          value={form.plate_text}
          onChange={e => setForm({ ...form, plate_text: e.target.value.toUpperCase() })}
          placeholder="AB123CD"
          className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono"
          required
        />
        <p className="text-[11px] text-slate-500 mt-1">Es lo que el scanner va a usar para identificar este auto — escribila igual a como está en la chapa.</p>

        {/* [NUEVO 19/07/2026] Aviso de "este auto ya estuvo acá" */}
        {checkingPlate && <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Buscando si ya lo tenés cargado...</p>}
        {existingMatch && (
          <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-amber-400 text-xs font-semibold flex items-center gap-1.5"><AlertTriangle size={13} /> Este auto ya estuvo en tu taller</p>
            <p className="text-slate-300 text-xs mt-1">{existingMatch.brand || 'Marca ?'} {existingMatch.model || ''} — {existingMatch.total_sesiones} sesión(es) previa(s)</p>
            {existingMatch.last_session && (
              <p className="text-slate-500 text-[11px] mt-0.5">
                Última vez: {new Date(existingMatch.last_session.started_at).toLocaleDateString('es-AR')} · {existingMatch.last_session.dtc_count} DTC detectado(s)
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-1.5">Si seguís cargando, se va a crear un registro NUEVO — mejor usar el que ya existe para no partir el historial en dos.</p>
            <button
              type="button"
              onClick={() => onDone(existingMatch.id)}
              className="mt-2 w-full py-2 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold"
            >
              Usar este auto existente (recomendado)
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Marca</label>
          <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Modelo</label>
          <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Año</label>
          <input type="number" value={form.model_year} onChange={e => setForm({ ...form, model_year: e.target.value })} className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">VIN (si lo tenés)</label>
          <input value={form.vin} onChange={e => setForm({ ...form, vin: e.target.value.toUpperCase() })} className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono" maxLength={17} />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">Cliente (opcional, para tu propio registro)</label>
        <input value={form.customer_label} onChange={e => setForm({ ...form, customer_label: e.target.value })} placeholder="Nombre o alias del cliente" className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm" />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm disabled:opacity-50">
        {saving ? 'Guardando...' : 'Guardar auto'}
      </button>
    </form>
  );
}

// ============================================================
// PESTAÑA 2 — Parear equipo: wizard de 3 pasos para el WiFi del ESP32
// ============================================================
function TabParear() {
  const [step, setStep] = useState(1);
  const [deviceUid, setDeviceUid] = useState('');
  const [deviceId, setDeviceId] = useState(null);
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [paired, setPaired] = useState(false);
  const pollRef = useRef(null);

  const handleClaim = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetchAPI('/scanner/devices/claim', { method: 'POST', body: JSON.stringify({ device_uid: deviceUid, label }) });
      setToken(res.device_token);
      setDeviceId(res.id);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // [NUEVO] Paso 3 — confirmamos que el equipo YA se conectó de verdad,
  // en vez de dejar al mecánico adivinando si quedó bien. Chequea cada
  // 4s si ESTE device_id puntual ya mandó un "estoy vivo" reciente
  // (last_seen_at actualizado, ver requireDeviceToken en el backend).
  useEffect(() => {
    if (step !== 3 || !deviceId) return;
    setChecking(true);
    const check = () => {
      fetchAPI('/scanner/devices').then(rows => {
        const mine = (Array.isArray(rows) ? rows : []).find(d => d.id === deviceId);
        if (mine?.online) { setPaired(true); setChecking(false); clearInterval(pollRef.current); }
      }).catch(() => {});
    };
    check();
    pollRef.current = setInterval(check, 4000);
    return () => clearInterval(pollRef.current);
  }, [step, deviceId]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {[1, 2, 3].map(n => (
          <div key={n} className={`flex-1 h-1.5 rounded-full ${step >= n ? 'bg-[#10B981]' : 'bg-slate-800'}`} />
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={handleClaim} className="space-y-4">
          <div>
            <h2 className="text-white font-bold mb-1">Paso 1 — Identificar el equipo</h2>
            <p className="text-slate-500 text-sm">El código está impreso en una etiqueta pegada en la caja del scanner.</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Código del equipo</label>
            <input
              value={deviceUid}
              onChange={e => setDeviceUid(e.target.value.trim())}
              placeholder="Ej: 868935060187604"
              className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-3 text-white text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Nombre para este equipo (opcional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Scanner mostrador" className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-3 text-white text-sm" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm disabled:opacity-50">
            {saving ? 'Generando...' : 'Continuar'}
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-white font-bold mb-1">Paso 2 — Conectar el equipo a tu WiFi</h2>
            <p className="text-slate-500 text-sm">Copiá este código, después conectá el equipo.</p>
          </div>

          <div className="bg-[#1E293B] rounded-xl border border-slate-700 p-4">
            <p className="text-[11px] text-slate-500 mb-1">Código de este equipo (pegalo en el campo "Token" del portal del scanner)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[#10B981] text-xs font-mono break-all">{token}</code>
              <button onClick={copyToken} className="shrink-0 p-2 rounded-lg bg-slate-800 text-slate-300">
                {copied ? <CheckCircle2 size={16} className="text-[#10B981]" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-amber-400 text-[11px] mt-2 flex items-center gap-1"><AlertTriangle size={11} /> No se vuelve a mostrar — si lo perdés, repetís el Paso 1.</p>
          </div>

          <ol className="space-y-3 text-sm text-slate-300">
            <li className="flex gap-3"><span className="shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-xs font-bold flex items-center justify-center">1</span> Prendé el scanner. La luz va a parpadear azul (modo pareo).</li>
            <li className="flex gap-3"><span className="shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-xs font-bold flex items-center justify-center">2</span> En este celular, andá a Ajustes → WiFi y conectate a la red <strong className="text-white">"Kalyber-Scanner-XXXX"</strong>.</li>
            <li className="flex gap-3"><span className="shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-xs font-bold flex items-center justify-center">3</span> Se va a abrir solo un portal (si no, tocá el aviso de "red sin internet" o abrí <code className="text-[#10B981]">192.168.4.1</code> en el navegador).</li>
            <li className="flex gap-3"><span className="shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-xs font-bold flex items-center justify-center">4</span> Ahí elegís el WiFi real del taller, ponés su contraseña, y pegás el código de arriba en "Token".</li>
            <li className="flex gap-3"><span className="shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-xs font-bold flex items-center justify-center">5</span> Guardá — el equipo se reinicia solo y se conecta.</li>
          </ol>

          <button onClick={() => setStep(3)} className="w-full py-3.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm">
            Ya lo conecté →
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-8 space-y-3">
          {paired ? (
            <>
              <CheckCircle2 size={40} className="mx-auto text-[#10B981]" />
              <h2 className="text-white font-bold">¡Conectado!</h2>
              <p className="text-slate-400 text-sm px-4">El equipo ya está en línea y listo para escanear.</p>
            </>
          ) : (
            <>
              <Loader2 size={40} className="mx-auto text-amber-400 animate-spin" />
              <h2 className="text-white font-bold">Esperando al equipo...</h2>
              <p className="text-slate-400 text-sm px-4">
                Todavía no vimos que se conecte. Si tarda más de 1-2 minutos, revisá el WiFi/token ingresados en el portal del equipo — la luz debería pasar de azul parpadeante a verde fija.
              </p>
            </>
          )}
          <button onClick={() => { setStep(1); setDeviceUid(''); setLabel(''); setToken(''); setDeviceId(null); setPaired(false); }} className="text-[#6366F1] text-sm font-semibold mt-4">
            Parear otro equipo
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PESTAÑA 3 — Diagnóstico en vivo: elegir auto → arrancar sesión →
// ver DTC en vivo → confirmar/corregir cada uno
// ============================================================
function TabDiagnosticoVivo() {
  const [vehicles, setVehicles] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [session, setSession] = useState(null);
  const [live, setLive] = useState({ dtcs: [] });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    fetchAPI('/scanner/vehicles').then(rows => setVehicles(Array.isArray(rows) ? rows : [])).catch(() => {});
    fetchAPI('/scanner/devices').then(rows => {
      const list = Array.isArray(rows) ? rows : [];
      setDevices(list);
      if (list.length === 1) setSelectedDevice(list[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    const load = () => fetchAPI(`/scanner/sessions/${session.session_id}/live`)
      .then(data => setLive({ dtcs: Array.isArray(data?.dtcs) ? data.dtcs : [], frames: Array.isArray(data?.frames) ? data.frames : [] }))
      .catch(() => {});
    load();
    pollRef.current = setInterval(load, 4000);
    return () => clearInterval(pollRef.current);
  }, [session]);

  const handleStart = async () => {
    if (!selectedVehicle || !selectedDevice) return;
    setStarting(true);
    setError('');
    try {
      const res = await fetchAPI('/scanner/sessions', {
        method: 'POST',
        body: JSON.stringify({ scan_vehicle_id: selectedVehicle, scanner_device_id: selectedDevice }),
      });
      setSession(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    await fetchAPI(`/scanner/sessions/${session.session_id}/end`, { method: 'POST' }).catch(() => {});
    setSession(null);
    setLive({ dtcs: [] });
  };

  const handleConfirm = async (dtcId, confirmed, correction) => {
    await fetchAPI(`/scanner/dtc/${dtcId}/confirm`, { method: 'PATCH', body: JSON.stringify({ confirmed, correction }) });
    setLive(prev => ({ ...prev, dtcs: prev.dtcs.map(d => d.id === dtcId ? { ...d, confirmed_by_mechanic: confirmed ? 1 : 0, mechanic_correction: correction || null } : d) }));
  };

  if (!session) {
    return (
      <div className="space-y-4">
        <h2 className="text-white font-bold">Empezar diagnóstico</h2>
        <p className="text-slate-500 text-sm">Elegí el auto — el equipo tiene que estar conectado y apuntando a él.</p>
        <select
          value={selectedVehicle}
          onChange={e => setSelectedVehicle(e.target.value)}
          className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-3 text-white text-sm"
        >
          <option value="">Seleccioná un auto...</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.plate_text} — {v.brand} {v.model}</option>
          ))}
        </select>

        {devices.length > 1 && (
          <select
            value={selectedDevice}
            onChange={e => setSelectedDevice(e.target.value)}
            className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-3 text-white text-sm"
          >
            <option value="">Seleccioná el equipo...</option>
            {devices.map(d => (
              <option key={d.id} value={d.id}>{d.label || d.device_uid} {d.online ? '🟢' : '⚪'}</option>
            ))}
          </select>
        )}
        {devices.length === 0 && (
          <p className="text-amber-400 text-xs">No tenés ningún equipo pareado — andá a "Parear equipo" primero.</p>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleStart}
          disabled={!selectedVehicle || !selectedDevice || starting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm disabled:opacity-50"
        >
          <Play size={16} /> {starting ? 'Iniciando...' : 'Iniciar diagnóstico'}
        </button>
        <p className="text-[11px] text-slate-600 text-center">Si no ves tu auto acá, primero cargalo en la pestaña "Autos".</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
          <h2 className="text-white font-bold">Diagnóstico en curso</h2>
        </div>
        <button onClick={handleEnd} className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
          <Square size={13} /> Finalizar
        </button>
      </div>

      {live.dtcs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <ShieldAlert size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin fallas detectadas todavía.</p>
          <p className="text-xs mt-1">Esta pantalla se actualiza sola apenas el equipo detecte algo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {live.dtcs.map(d => <DtcCard key={d.id} dtc={d} onConfirm={handleConfirm} />)}
        </div>
      )}
    </div>
  );
}

function DtcCard({ dtc, onConfirm }) {
  const [showCorrect, setShowCorrect] = useState(false);
  const [correction, setCorrection] = useState('');
  const reviewed = dtc.confirmed_by_mechanic !== null;

  return (
    <div className={`rounded-xl border p-3 ${reviewed ? 'border-slate-800 bg-[#1E293B]/30' : 'border-red-500/30 bg-red-500/5'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-red-300 font-bold text-sm">{dtc.decoded_code}</p>
          <p className="text-slate-300 text-xs mt-0.5">{dtc.description_guess || 'Sin descripción'}</p>
          <p className="text-slate-600 text-[10px] mt-1 flex items-center gap-1"><Clock size={9} /> {new Date(dtc.detected_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · fuente: {dtc.source || 'desconocida'}</p>
        </div>
        {!reviewed && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onConfirm(dtc.id, true)} className="p-2 rounded-lg bg-[#10B981]/10 text-[#10B981]"><ThumbsUp size={14} /></button>
            <button onClick={() => setShowCorrect(true)} className="p-2 rounded-lg bg-red-500/10 text-red-400"><ThumbsDown size={14} /></button>
          </div>
        )}
        {reviewed && (
          <span className={`text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ${dtc.confirmed_by_mechanic ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-amber-500/15 text-amber-400'}`}>
            {dtc.confirmed_by_mechanic ? 'Confirmado' : 'Corregido'}
          </span>
        )}
      </div>

      {reviewed && !dtc.confirmed_by_mechanic && dtc.mechanic_correction && (
        <p className="text-amber-400 text-xs mt-2 flex items-center gap-1.5"><Wrench size={11} /> Falla real: {dtc.mechanic_correction}</p>
      )}

      {showCorrect && (
        <div className="mt-2 flex gap-2">
          <input
            value={correction}
            onChange={e => setCorrection(e.target.value)}
            placeholder="¿Cuál era la falla real?"
            className="flex-1 bg-[#0B1120] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
          />
          <button
            onClick={() => { onConfirm(dtc.id, false, correction); setShowCorrect(false); }}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PESTAÑA 4 — Histórico: todos los autos leídos por este taller,
// con sus sesiones y los DTCs de cada una, expandible.
// ============================================================
function TabHistoricoVehiculos() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState({}); // { [vehicleId]: { vehicle, sessions } }

  useEffect(() => {
    fetchAPI('/scanner/vehicles')
      .then(rows => setVehicles(Array.isArray(rows) ? rows : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!detail[id]) {
      try {
        const data = await fetchAPI(`/scanner/vehicles/${id}/history`);
        setDetail(prev => ({ ...prev, [id]: data }));
      } catch {
        setDetail(prev => ({ ...prev, [id]: { sessions: [] } }));
      }
    }
  };

  // Mismo mecanismo que en "En vivo" — acá también sirve confirmar/
  // corregir un DTC de una sesión pasada, no solo de la que está
  // corriendo ahora mismo.
  const handleConfirm = async (vehicleId, dtcId, confirmed, correction) => {
    await fetchAPI(`/scanner/dtc/${dtcId}/confirm`, { method: 'PATCH', body: JSON.stringify({ confirmed, correction }) });
    setDetail(prev => {
      const d = prev[vehicleId];
      if (!d) return prev;
      const sessions = d.sessions.map(s => ({
        ...s,
        dtcs: s.dtcs.map(dtc => dtc.id === dtcId ? { ...dtc, confirmed_by_mechanic: confirmed ? 1 : 0, mechanic_correction: correction || null } : dtc),
      }));
      return { ...prev, [vehicleId]: { ...d, sessions } };
    });
  };

  // [NUEVO 19/07/2026] Descarga del reporte PDF — no puede usar
  // fetchAPI (esa devuelve JSON) porque acá la respuesta es binaria.
  // Se pide como blob, con el mismo token de auth, y se dispara la
  // descarga en el navegador manualmente.
  const downloadReport = async (vehicleId, plate) => {
    try {
      const token = localStorage.getItem('kyber_token');
      const res = await fetch(`${API_URL}/scanner/vehicles/${vehicleId}/report.pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo generar el reporte');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagnostico-${plate || vehicleId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo descargar el reporte: ' + err.message);
    }
  };

  if (loading) return <p className="text-slate-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando...</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <History size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Todavía no hay ningún auto leído.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-white font-bold mb-1">Histórico de vehículos leídos</h2>
      {vehicles.map(v => {
        const d = detail[v.id];
        return (
          <div key={v.id} className="bg-[#1E293B]/60 rounded-xl border border-slate-700 overflow-hidden">
            <button onClick={() => toggle(v.id)} className="w-full flex items-center justify-between p-3 text-left">
              <div className="flex items-center gap-3 min-w-0">
                {v.plate_photo_url ? (
                  <img src={v.plate_photo_url} className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center shrink-0"><Car size={18} className="text-slate-600" /></div>
                )}
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate">{v.brand || 'Marca ?'} {v.model || ''} {v.model_year ? `(${v.model_year})` : ''}</p>
                  <p className="text-slate-500 text-xs truncate font-mono">{v.plate_text} {v.customer_label ? `· ${v.customer_label}` : ''}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{v.total_sesiones ?? 0} sesión(es) · {v.total_dtcs ?? 0} DTC(s)</p>
                </div>
              </div>
              {expandedId === v.id ? <ChevronUp size={18} className="text-slate-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
            </button>

            {expandedId === v.id && (
              <div className="border-t border-slate-800 p-3 pt-3 bg-[#0B1120]/40 space-y-3">
                {/* [NUEVO 19/07/2026] Reporte PDF para entregarle al cliente del taller */}
                <button
                  onClick={() => downloadReport(v.id, v.plate_text)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#6366F1]/10 text-[#818CF8] text-xs font-semibold border border-[#6366F1]/30"
                >
                  <Download size={13} /> Descargar reporte para el cliente (PDF)
                </button>

                {!d ? (
                  <p className="text-slate-600 text-xs flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Cargando...</p>
                ) : d.sessions.length === 0 ? (
                  <p className="text-slate-600 text-xs">Sin sesiones registradas para este auto.</p>
                ) : (
                  d.sessions.map(s => (
                    <div key={s.id} className="pl-3 border-l-2 border-slate-800">
                      <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                        <Clock size={11} />
                        {new Date(s.started_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${s.status === 'en_curso' ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-slate-700/40 text-slate-400'}`}>
                          {s.status === 'en_curso' ? 'En curso' : 'Finalizada'}
                        </span>
                      </p>
                      {s.dtcs.length === 0 ? (
                        <p className="text-slate-600 text-xs pl-1">Sin fallas detectadas en esta sesión.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {s.dtcs.map(dtc => <DtcCard key={dtc.id} dtc={dtc} onConfirm={(dtcId, confirmed, correction) => handleConfirm(v.id, dtcId, confirmed, correction)} />)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// PESTAÑA 5 — Estadísticas propias del taller: qué marcas y qué
// fallas se repiten más, para que el mecánico sepa qué repuestos
// conviene tener a mano. Es el "plus" que justifica pagar la
// suscripción más allá de solo conectar y diagnosticar.
// ============================================================
function TabEstadisticas() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAPI('/scanner/stats')
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando...</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!stats || stats.total_autos === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <BarChart3 size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Todavía no hay suficientes datos — escaneá algunos autos y volvé por acá.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-white font-bold flex items-center gap-2"><TrendingUp size={18} className="text-[#6366F1]" /> Estadísticas de tu taller</h2>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#1E293B]/60 rounded-xl border border-slate-700 p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.total_autos}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Autos totales</p>
        </div>
        <div className="bg-[#1E293B]/60 rounded-xl border border-slate-700 p-3 text-center">
          <p className="text-2xl font-bold text-[#10B981]">{stats.autos_ultimo_mes}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Últimos 30 días</p>
        </div>
        <div className="bg-[#1E293B]/60 rounded-xl border border-slate-700 p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.total_dtcs}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">DTC detectados</p>
        </div>
      </div>

      {stats.topDtcs?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Fallas más comunes en tu taller</p>
          <p className="text-[11px] text-slate-600 mb-2">Para saber qué repuestos conviene tener a mano.</p>
          <div className="space-y-1.5">
            {stats.topDtcs.map((d, i) => (
              <div key={d.decoded_code} className="flex items-center justify-between bg-[#1E293B]/60 rounded-lg border border-slate-800 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-red-300 font-mono font-bold text-sm">{d.decoded_code}</p>
                  <p className="text-slate-400 text-[11px] truncate">{d.description_guess || 'Sin descripción'}</p>
                </div>
                <span className="text-white font-bold text-sm shrink-0 ml-2">{d.cantidad}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.topBrands?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Marcas que más pasan por tu taller</p>
          <div className="space-y-1.5">
            {stats.topBrands.map(b => {
              const pct = Math.round((b.cantidad / stats.total_autos) * 100);
              return (
                <div key={b.brand}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{b.brand}</span>
                    <span className="text-slate-500">{b.cantidad} auto(s)</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#6366F1] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
