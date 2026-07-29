import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI, API_URL } from '../services/api';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import {
  Car, Wifi, WifiOff, Activity, Camera, Plus, X, Copy, CheckCircle2,
  AlertTriangle, ShieldAlert, Loader2, ChevronRight, RadioTower,
  Wrench, ThumbsUp, ThumbsDown, Play, Square, Clock, History,
  LogOut, Home, ChevronDown, ChevronUp, BarChart3, Download,
  Search, TrendingUp, ScanLine, Eraser, ShieldCheck, RefreshCw,
  Radio, XCircle, Info,
} from 'lucide-react';

// ============================================================
// [NUEVO 28/07/2026] "Versión PRO" — todo lo que el hardware del
// Kalyber Scanner ya sabe hacer, reflejado acá:
//   - Protocolo con el que se detectó cada DTC (OBD-II / J1939 /
//     J1708), mismo color que usa el LED del equipo — así el
//     mecánico asocia de un vistazo lo que ve en pantalla con lo
//     que ve en el equipo físico.
//   - Estado en vivo del equipo (WiFi, protocolo leyendo ahora,
//     "hace Xs" del último frame) — sin tener que mirar el OLED.
//   - Borrado de fallas (Mode $04) desde acá, con el flujo completo:
//     reparar → re-escanear (automático, cada 4s) → si no vuelve,
//     borrar → confirmación real de la ECU (no un "listo" fake).
//
// [PENDIENTE — LADO BACKEND] Estos 3 endpoints/campos nuevos hacen
// falta del lado Express para que esto funcione de punta a punta —
// el firmware YA está listo para el paso 3 (ver backend_client.h
// del proyecto KalyberScanner-TallerMini):
//
//   1. GET /scanner/sessions/:id/live  → agregar al JSON que ya
//      devuelve, un objeto "device":
//        { online: true, activeProtocol: "OBD-II", wifiConnected: true,
//          lastFrameAt: "2026-07-28T19:04:00Z" }
//      Sale del último heartbeat/lectura de ESE device_id.
//
//   2. Cada DTC en "dtcs" necesita 4 campos nuevos (columnas en
//      dtc_readings, o derivados):
//        protocol: "OBD-II" | "J1939" | "J1708" | null
//        is_generic: true | false   (código genérico SAE vs. de fabricante)
//        clear_status: "none" | "pending" | "success" | "failed"
//        clear_detail: string | null  (motivo si failed — el NRC
//          traducido que ya arma nrcDescription() en el firmware)
//        cleared_at: timestamp | null
//
//   3. POST /scanner/dtc/:dtcId/clear-request → el mecánico aprieta
//      "Borrar falla" acá. El backend deja pendiente el pedido
//      para el device correspondiente (ver GET /clear-requests que
//      el equipo consulta cada 5s) y devuelve { ok: true }. El
//      resultado real (success/failed) llega después, vía
//      POST /clear-result del propio equipo — este componente lo ve
//      reflejado en el próximo poll de /live (clear_status).
//
// Mientras esos 3 puntos no estén, el botón "Borrar falla" queda
// visible pero el pedido no llega a ningún lado — fetchAPI va a
// tirar 404 y el catch de abajo lo muestra como error legible, sin
// romper el resto de la vista.
// ============================================================

// Mismos colores que usa el LED del equipo para cada protocolo —
// consistencia entre lo que el mecánico ve en pantalla y en el LED.
const PROTOCOL_STYLE = {
  'OBD-II': { label: 'OBD-II', dot: 'bg-cyan-400', text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  'J1939':  { label: 'J1939',  dot: 'bg-violet-400', text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  'J1708':  { label: 'J1708',  dot: 'bg-orange-400', text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
};

function ProtocolBadge({ protocol }) {
  const style = PROTOCOL_STYLE[protocol];
  if (!style) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

// "hace Xs" / "hace Xm" a partir de un timestamp ISO — usado en el
// panel de estado del equipo y en el detalle de cada DTC.
function haceTiempo(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'ahora';
  const s = Math.floor(diffMs / 1000);
  if (s < 5) return 'ahora';
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  return `hace ${h}h`;
}

// ============================================================
// [NUEVO 29/07/2026] Relojes de datos en vivo (Mode $01).
//
// El backend manda liveData como { "0C": {value, unit, recordedAt}, ... }
// — la clave es el PID en hex, mismo código que ya conoce el firmware
// (ver live_data_engine.cpp). Acá se traduce a algo legible, con un
// máximo razonable por PID para dibujar la barra de progreso.
//
// [PENDIENTE — LADO FIRMWARE/EQUIPO] Esto solo muestra algo si el
// equipo está mandando datos en vivo — eso pasa solo (sin tocar nada)
// apenas esta pestaña está abierta, gracias al polling que ya hace
// GET /live cada 4s (el backend le avisa al equipo). Si el equipo
// tiene un firmware viejo (sin esto todavía), o el auto está apagado,
// el panel simplemente no tiene nada que mostrar — no es un error.
// ============================================================
const PID_META = {
  '0C': { label: 'RPM', unit: 'rpm', max: 6500 },
  '05': { label: 'Temp. motor', unit: '°C', max: 120 },
  '0D': { label: 'Velocidad', unit: 'km/h', max: 200 },
  '11': { label: 'Acelerador', unit: '%', max: 100 },
  '04': { label: 'Carga motor', unit: '%', max: 100 },
};

function LiveGauges({ liveData }) {
  const pids = Object.keys(PID_META);
  const tieneAlgo = pids.some(pid => liveData?.[pid]);

  if (!tieneAlgo) {
    return (
      <div className="bg-[#1E293B]/40 rounded-xl border border-dashed border-slate-700 px-3 py-3 text-center">
        <Activity size={16} className="mx-auto mb-1 text-slate-600" />
        <p className="text-slate-500 text-xs">Esperando datos en vivo (RPM, temperatura, velocidad)...</p>
        <p className="text-slate-600 text-[10px] mt-0.5">Aparecen solos apenas el equipo los detecte, con el motor en marcha.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {pids.map(pid => {
        const meta = PID_META[pid];
        const reading = liveData?.[pid];
        const tieneValor = reading && reading.value !== null && reading.value !== undefined;
        const stale = reading?.recordedAt && (Date.now() - new Date(reading.recordedAt).getTime() > 6000);
        const pct = tieneValor ? Math.max(0, Math.min(100, (reading.value / meta.max) * 100)) : 0;

        return (
          <div key={pid} className={`bg-[#1E293B]/60 rounded-xl border p-2.5 ${stale ? 'border-slate-800 opacity-50' : 'border-slate-700'}`}>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{meta.label}</p>
            <p className="text-white font-bold text-lg leading-tight">
              {tieneValor ? Math.round(reading.value) : '—'}
              <span className="text-slate-500 text-xs font-normal ml-1">{meta.unit}</span>
            </p>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
              <div className="h-full bg-cyan-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  // [NUEVO 28/07/2026] Antes esta pestaña arrancaba SIEMPRE directo en
  // el wizard de pareo (paso 1) — no había forma de ver "¿mi scanner
  // ya pareado sigue online?" sin arrancar a parear uno nuevo. El
  // estado del equipo solo aparecía en "En vivo", y encima solo si
  // había MÁS DE UN equipo (el <select> ahí abajo tiene ese if). Con
  // un solo scanner — el caso más común — no se veía en ningún lado.
  //
  // Ahora: si ya hay equipos pareados, esta pestaña arranca mostrando
  // ESO (lista con 🟢/⚪ y "hace Xm"), y el wizard queda atrás de un
  // botón explícito "+ Parear otro equipo". Si es la primera vez (0
  // equipos), va directo al wizard como antes — no hay nada que listar.
  const [mode, setMode] = useState('loading'); // 'loading' | 'list' | 'wizard'
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollDevicesRef = useRef(null);

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
  const [scanning, setScanning] = useState(false); // muestra el modal de cámara para escanear el barcode
  const pollRef = useRef(null);

  const loadDevices = (manual = false) => {
    if (manual) setRefreshing(true);
    return fetchAPI('/scanner/devices')
      .then(rows => setDevices(Array.isArray(rows) ? rows : []))
      .catch(() => {})
      .finally(() => {
        setLoadingDevices(false);
        if (manual) setRefreshing(false);
      });
  };

  // Primera carga: decide si arrancar en la lista o directo en el wizard.
  useEffect(() => {
    loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === 'loading' && !loadingDevices) {
      setMode(devices.length > 0 ? 'list' : 'wizard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingDevices]);

  // Mientras se está mirando la lista, se refresca sola cada 8s — así
  // el mecánico ve pasar el equipo de ⚪ a 🟢 sin tener que salir y
  // volver a entrar a la pestaña.
  useEffect(() => {
    if (mode !== 'list') return;
    pollDevicesRef.current = setInterval(() => loadDevices(), 8000);
    return () => clearInterval(pollDevicesRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const startWizard = () => {
    setStep(1);
    setDeviceUid(''); setLabel(''); setToken(''); setDeviceId(null); setPaired(false); setError('');
    setMode('wizard');
  };

  const backToList = () => {
    setMode('list');
    loadDevices();
  };

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
    if (mode !== 'wizard' || step !== 3 || !deviceId) return;
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
  }, [mode, step, deviceId]);

  // ---- Vista LISTA — "Tus equipos", el estado que faltaba ----
  if (mode === 'loading') {
    return <p className="text-slate-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando...</p>;
  }

  if (mode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold">Tus equipos</h2>
          <button onClick={() => loadDevices(true)} title="Actualizar ahora" className="text-slate-400">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="space-y-2">
          {devices.map(d => (
            <div key={d.id} className="bg-[#1E293B]/60 rounded-xl border border-slate-700 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{d.label || d.device_uid}</p>
                <p className="text-slate-500 text-xs font-mono truncate">{d.device_uid}</p>
              </div>
              <div className="text-right shrink-0">
                {d.online ? (
                  <span className="inline-flex items-center gap-1.5 text-[#10B981] text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" /> En línea
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-slate-600" /> Sin conexión
                  </span>
                )}
                {d.last_seen_at && (
                  <p className="text-[10px] text-slate-600 mt-0.5">Visto {haceTiempo(d.last_seen_at)}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={startWizard}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm active:scale-95 transition-transform"
        >
          <Plus size={18} /> Parear otro equipo
        </button>
      </div>
    );
  }

  // ---- Vista WIZARD — pareo de un equipo nuevo (o el primero) ----
  return (
    <div className="space-y-5">
      {devices.length > 0 && (
        <button onClick={backToList} className="text-slate-400 text-xs font-semibold flex items-center gap-1">
          <ChevronRight size={13} className="rotate-180" /> Volver a tus equipos
        </button>
      )}
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
            <div className="flex gap-2">
              <input
                value={deviceUid}
                onChange={e => setDeviceUid(e.target.value.trim())}
                placeholder="Ej: KAL-SCAN-0001"
                className="flex-1 bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-3 text-white text-sm font-mono"
                required
              />
              {/* [NUEVO 19/07/2026] Reusa el MISMO BarcodeScannerModal que
                  ya se usa para el ICC del chip M2M — el mecánico saca
                  foto al barcode de la tapa del scanner en vez de tipear
                  el código a mano. */}
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="shrink-0 px-4 rounded-lg bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/40 flex items-center justify-center"
                title="Escanear con la cámara"
              >
                <ScanLine size={20} />
              </button>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">Escribilo, o tocá el botón para escanear el código de barras de la tapa con la cámara.</p>
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
              <button onClick={backToList} className="w-full mt-2 py-3.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm">
                Ver mis equipos
              </button>
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
          <button onClick={startWizard} className="text-[#6366F1] text-sm font-semibold mt-4">
            Parear otro equipo
          </button>
        </div>
      )}

      {/* Modal de cámara para escanear el barcode de la tapa del scanner */}
      {scanning && (
        <BarcodeScannerModal
          title="Escaneá el código de la tapa del scanner"
          errorHint="No se pudo abrir la cámara. Revisá los permisos, o escribí el código del equipo a mano."
          onScan={(code) => { setDeviceUid(code.trim()); setScanning(false); }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// PESTAÑA 3 — Diagnóstico en vivo: elegir auto → arrancar sesión →
// ver DTC en vivo → confirmar/corregir cada uno
// ============================================================
function TabDiagnosticoVivo() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [session, setSession] = useState(null);
  // [PRO 28/07/2026] "device" es el estado en vivo del equipo (WiFi,
  // protocolo que está leyendo AHORA, último frame) — ver contrato
  // nuevo del endpoint /live al principio del archivo.
  const [live, setLive] = useState({ dtcs: [], device: null, liveData: {} });
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  // [NUEVO 29/07/2026] Combobox: buscador predictivo por patente + ver
  // el listado completo con un clic. Se trae la lista completa UNA vez
  // (mismo endpoint que antes tenía el <select> viejo) y se filtra del
  // lado del cliente por prefijo — sin pegarle al backend en cada
  // letra. Cuando el auto se selecciona (de la lista o tipeando exacto),
  // se enriquece con el historial (última sesión) vía el lookup exacto
  // que ya existía, para la tarjeta verde de "auto encontrado".
  const [allVehicles, setAllVehicles] = useState([]);
  const [plateQuery, setPlateQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [lookupResult, setLookupResult] = useState(null); // null = nada buscado todavía | 'not_found' | { id, brand, model, ... }
  const [checkingPlate, setCheckingPlate] = useState(false);
  const lookupTimer = useRef(null);

  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickForm, setQuickForm] = useState({ brand: '', model: '', customer_label: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAPI('/scanner/devices').then(rows => {
      const list = Array.isArray(rows) ? rows : [];
      setDevices(list);
      if (list.length === 1) setSelectedDevice(list[0].id);
    }).catch(() => {});
    fetchAPI('/scanner/vehicles').then(rows => setAllVehicles(Array.isArray(rows) ? rows : [])).catch(() => {});
  }, []);

  // Sugerencias predictivas — por prefijo, sin pegarle al backend.
  const suggestions = plateQuery.trim().length === 0
    ? allVehicles.slice(0, 50)
    : allVehicles.filter(v => (v.plate_text || '').toUpperCase().startsWith(plateQuery.trim().toUpperCase())).slice(0, 50);

  const selectPlate = (plate) => {
    setPlateQuery(plate);
    setDropdownOpen(false);
  };

  // Búsqueda EXACTA con debounce, para traer el historial (última
  // sesión) — solo dispara cuando lo tipeado matchea una patente
  // completa, no en cada letra mientras se filtra la lista.
  useEffect(() => {
    clearTimeout(lookupTimer.current);
    setLookupResult(null);
    setShowQuickCreate(false);
    setError('');
    if (plateQuery.trim().length < 3) return;
    setCheckingPlate(true);
    lookupTimer.current = setTimeout(() => {
      fetchAPI(`/scanner/vehicles/lookup?plate=${encodeURIComponent(plateQuery.trim())}`)
        .then(res => setLookupResult(res || 'not_found'))
        .catch(() => setLookupResult('not_found'))
        .finally(() => setCheckingPlate(false));
    }, 500);
    return () => clearTimeout(lookupTimer.current);
  }, [plateQuery]);

  const loadLive = (manual = false) => {
    if (!session) return Promise.resolve();
    if (manual) setRefreshing(true);
    return fetchAPI(`/scanner/sessions/${session.session_id}/live`)
      .then(data => setLive({
        dtcs: Array.isArray(data?.dtcs) ? data.dtcs : [],
        frames: Array.isArray(data?.frames) ? data.frames : [],
        device: data?.device || null,
        liveData: data?.liveData || {},
      }))
      .catch(() => {})
      .finally(() => { if (manual) setRefreshing(false); });
  };

  useEffect(() => {
    if (!session) return;
    loadLive();
    pollRef.current = setInterval(() => loadLive(), 4000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleStart = async (vehicleId) => {
    if (!vehicleId || !selectedDevice) return;
    setStarting(true);
    setError('');
    try {
      const res = await fetchAPI('/scanner/sessions', {
        method: 'POST',
        body: JSON.stringify({ scan_vehicle_id: vehicleId, scanner_device_id: selectedDevice }),
      });
      setSession(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  // [NUEVO 29/07/2026] Alta rápida — la patente no existía, el
  // mecánico completa lo mínimo (marca/modelo/cliente, opcionales) y
  // arranca la sesión en el mismo paso, sin ir y volver a "Autos".
  // Foto de patente y VIN quedan afuera a propósito acá — se pueden
  // completar después desde "Autos" si hace falta, no vale la pena
  // trabarlo con la cámara en este flujo rápido.
  const handleQuickCreate = async () => {
    if (!plateQuery.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetchAPI('/scanner/vehicles', {
        method: 'POST',
        body: JSON.stringify({ plate_text: plateQuery.trim().toUpperCase(), ...quickForm }),
      });
      await handleStart(res.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEnd = async () => {
    await fetchAPI(`/scanner/sessions/${session.session_id}/end`, { method: 'POST' }).catch(() => {});
    setSession(null);
    setLive({ dtcs: [], device: null, liveData: {} });
    setPlateQuery('');
    setLookupResult(null);
  };

  const handleConfirm = async (dtcId, confirmed, correction) => {
    await fetchAPI(`/scanner/dtc/${dtcId}/confirm`, { method: 'PATCH', body: JSON.stringify({ confirmed, correction }) });
    setLive(prev => ({ ...prev, dtcs: prev.dtcs.map(d => d.id === dtcId ? { ...d, confirmed_by_mechanic: confirmed ? 1 : 0, mechanic_correction: correction || null } : d) }));
  };

  // [NUEVO 28/07/2026] El mecánico pide borrar una falla puntual.
  // Optimista: marcamos "pending" al toque (el equipo puede tardar
  // hasta ~7s en verlo por el polling propio + el Mode $04), y el
  // resultado real llega solo, en el próximo loadLive() — no hace
  // falta que el mecánico se quede mirando la pantalla.
  const handleClearRequest = async (dtcId) => {
    setLive(prev => ({ ...prev, dtcs: prev.dtcs.map(d => d.id === dtcId ? { ...d, clear_status: 'pending' } : d) }));
    try {
      await fetchAPI(`/scanner/dtc/${dtcId}/clear-request`, { method: 'POST' });
    } catch (err) {
      setLive(prev => ({ ...prev, dtcs: prev.dtcs.map(d => d.id === dtcId ? { ...d, clear_status: 'failed', clear_detail: err.message } : d) }));
      return;
    }
    // Empujamos un par de polls más seguidos (cada 2s, 4 veces) para
    // que la confirmación llegue rápido a la pantalla en vez de
    // esperar hasta 4s del intervalo normal.
    let tries = 0;
    const fast = setInterval(() => {
      tries++;
      loadLive();
      if (tries >= 4) clearInterval(fast);
    }, 2000);
  };

  if (!session) {
    const encontrado = lookupResult && lookupResult !== 'not_found';
    return (
      <div className="space-y-4">
        <h2 className="text-white font-bold">Empezar diagnóstico</h2>
        <p className="text-slate-500 text-sm">Escribí la patente, o tocá el campo para ver todos los autos ya cargados.</p>

        <div className="relative">
          <label className="text-xs text-slate-400 mb-1 block">Patente</label>
          <input
            value={plateQuery}
            onChange={e => { setPlateQuery(e.target.value.toUpperCase()); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            placeholder="AB123CD"
            className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-3 text-white text-sm font-mono"
            autoFocus
          />

          {/* [NUEVO 29/07/2026] Dropdown predictivo — muestra TODOS los
              autos al tocar el campo vacío, y filtra por prefijo a
              medida que se escribe. onMouseDown con preventDefault en
              el contenedor evita que el input pierda el foco (blur)
              antes de que el clic en una opción llegue a registrarse. */}
          {dropdownOpen && suggestions.length > 0 && (
            <div
              onMouseDown={e => e.preventDefault()}
              className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-[#1E293B] border border-slate-700 rounded-lg shadow-xl"
            >
              {suggestions.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => selectPlate(v.plate_text)}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-700/50 border-b border-slate-800 last:border-0 flex items-center justify-between gap-2"
                >
                  <span className="text-white text-sm font-mono font-bold">{v.plate_text}</span>
                  <span className="text-slate-500 text-xs truncate">{v.brand} {v.model}</span>
                </button>
              ))}
            </div>
          )}
          {dropdownOpen && plateQuery.trim().length > 0 && suggestions.length === 0 && (
            <div
              onMouseDown={e => e.preventDefault()}
              className="absolute z-10 mt-1 w-full bg-[#1E293B] border border-slate-700 rounded-lg shadow-xl px-3 py-2.5"
            >
              <p className="text-slate-500 text-xs">Ningún auto cargado empieza con "{plateQuery.trim()}"</p>
            </div>
          )}
        </div>

        {checkingPlate && (
          <p className="text-[11px] text-slate-500 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Buscando...</p>
        )}

        {encontrado && (
          <div className="p-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30">
            <p className="text-[#10B981] text-xs font-semibold flex items-center gap-1.5"><CheckCircle2 size={13} /> Auto encontrado — vuelve a tu taller</p>
            <p className="text-white text-sm font-bold mt-1">{lookupResult.brand || 'Marca ?'} {lookupResult.model || ''} {lookupResult.model_year ? `(${lookupResult.model_year})` : ''}</p>
            {lookupResult.last_session ? (
              <p className="text-slate-500 text-[11px] mt-0.5">
                Última vez: {new Date(lookupResult.last_session.started_at).toLocaleDateString('es-AR')} · {lookupResult.last_session.dtc_count} DTC(s) detectado(s)
              </p>
            ) : (
              <p className="text-slate-500 text-[11px] mt-0.5">Sin sesiones previas registradas.</p>
            )}
          </div>
        )}

        {lookupResult === 'not_found' && !showQuickCreate && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-amber-400 text-xs font-semibold flex items-center gap-1.5"><AlertTriangle size={13} /> No encontramos ningún auto con esa patente</p>
            <button
              type="button"
              onClick={() => setShowQuickCreate(true)}
              className="mt-2 w-full py-2 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold"
            >
              Cargar este auto ahora
            </button>
          </div>
        )}

        {showQuickCreate && (
          <div className="space-y-2.5 p-3 rounded-lg bg-[#1E293B]/60 border border-slate-700">
            <p className="text-white text-xs font-semibold">Alta rápida — patente {plateQuery}</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={quickForm.brand}
                onChange={e => setQuickForm({ ...quickForm, brand: e.target.value })}
                placeholder="Marca"
                className="bg-[#0B1120] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs"
              />
              <input
                value={quickForm.model}
                onChange={e => setQuickForm({ ...quickForm, model: e.target.value })}
                placeholder="Modelo"
                className="bg-[#0B1120] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs"
              />
            </div>
            <input
              value={quickForm.customer_label}
              onChange={e => setQuickForm({ ...quickForm, customer_label: e.target.value })}
              placeholder="Cliente (opcional)"
              className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs"
            />
            <p className="text-[10px] text-slate-500">Foto de patente, VIN y año se pueden completar después desde "Autos".</p>
          </div>
        )}

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

        {showQuickCreate ? (
          <button
            onClick={handleQuickCreate}
            disabled={!selectedDevice || creating}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm disabled:opacity-50"
          >
            <Play size={16} /> {creating ? 'Creando...' : 'Crear y empezar diagnóstico'}
          </button>
        ) : (
          <button
            onClick={() => handleStart(lookupResult?.id)}
            disabled={!encontrado || !selectedDevice || starting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#10B981] text-[#0B1120] font-bold text-sm disabled:opacity-50"
          >
            <Play size={16} /> {starting ? 'Iniciando...' : 'Iniciar diagnóstico'}
          </button>
        )}
      </div>
    );
  }

  const deviceOnline = live.device?.online ?? true; // si el backend todavía no manda "device", no bloqueamos el borrado por las dudas

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
          <h2 className="text-white font-bold">Diagnóstico en curso</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => loadLive(true)} title="Actualizar ahora" className="text-slate-400">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleEnd} className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
            <Square size={13} /> Finalizar
          </button>
        </div>
      </div>

      {/* [NUEVO 28/07/2026] Estado en vivo del equipo — lo mismo que
          muestra el OLED, acá en la app. Si "device" todavía no viene
          del backend (falta implementarlo), esta tarjeta simplemente
          no se muestra — no rompe nada. */}
      {live.device && (
        <div className="bg-[#1E293B]/60 rounded-xl border border-slate-700 px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {live.device.wifiConnected ? <Wifi size={15} className="text-[#10B981] shrink-0" /> : <WifiOff size={15} className="text-red-400 shrink-0" />}
            <span className="text-xs text-slate-300 truncate">
              {live.device.wifiConnected ? 'Equipo conectado' : 'Equipo sin WiFi'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {live.device.activeProtocol && <ProtocolBadge protocol={live.device.activeProtocol} />}
            {live.device.lastFrameAt && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Radio size={10} /> {haceTiempo(live.device.lastFrameAt)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* [NUEVO 29/07/2026] Relojes de datos en vivo — RPM, temperatura,
          velocidad, acelerador, carga del motor. Se actualizan solos
          con el mismo polling de 4s que ya trae los DTC. */}
      <LiveGauges liveData={live.liveData} />

      {live.dtcs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <ShieldAlert size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin fallas detectadas todavía.</p>
          <p className="text-xs mt-1">Esta pantalla se actualiza sola apenas el equipo detecte algo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {live.dtcs.map(d => (
            <DtcCard key={d.id} dtc={d} onConfirm={handleConfirm} onClear={handleClearRequest} deviceOnline={deviceOnline} />
          ))}
        </div>
      )}
    </div>
  );
}

// [PRO 28/07/2026] Infiere el protocolo por la forma del código si el
// backend todavía no manda dtc.protocol explícito — así la badge
// aparece igual mientras se termina de cablear ese campo del lado
// del servidor. OBD-II genérico/fabricante = letra P/C/B/U + 4
// dígitos; J1939 se identifica por el prefijo SPN que ya arma
// j1939Engine en el firmware; J1708 no tiene traducción automática
// todavía (ver j1708_engine — es solo sniffer), así que ese prefijo
// no se infiere, tiene que venir del backend.
function inferProtocol(dtc) {
  if (dtc.protocol) return dtc.protocol;
  if (/^[PCBU]\d{4}$/i.test(dtc.decoded_code || '')) return 'OBD-II';
  if (/^SPN/i.test(dtc.decoded_code || '')) return 'J1939';
  return null;
}

function DtcCard({ dtc, onConfirm, onClear, deviceOnline = true }) {
  const [showCorrect, setShowCorrect] = useState(false);
  const [correction, setCorrection] = useState('');
  const [confirmClear, setConfirmClear] = useState(false); // modal de confirmación antes de borrar
  const reviewed = dtc.confirmed_by_mechanic !== null;
  const protocol = inferProtocol(dtc);

  // [NUEVO 28/07/2026] Solo P0xxx (genérico SAE) tiene traducción
  // garantizada — igual criterio que dtc_database.h en el firmware.
  // Si el backend no manda is_generic explícito, lo inferimos del
  // mismo patrón que usa el equipo: 2do carácter '0'.
  const isGeneric = dtc.is_generic ?? (dtc.decoded_code?.length >= 2 && dtc.decoded_code[1] === '0');

  const clearStatus = dtc.clear_status || 'none'; // 'none' | 'pending' | 'success' | 'failed'

  return (
    <div className={`rounded-xl border p-3 ${clearStatus === 'success' ? 'border-slate-800 bg-[#1E293B]/20 opacity-70' : reviewed ? 'border-slate-800 bg-[#1E293B]/30' : 'border-red-500/30 bg-red-500/5'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`font-mono font-bold text-sm ${clearStatus === 'success' ? 'text-slate-500 line-through decoration-slate-600' : 'text-red-300'}`}>{dtc.decoded_code}</p>
            {protocol && <ProtocolBadge protocol={protocol} />}
            {!isGeneric && (
              <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-700" title="Código específico del fabricante — confirmar manualmente">
                fabricante
              </span>
            )}
          </div>
          <p className="text-slate-300 text-xs mt-0.5">{dtc.description_guess || 'Código específico de fabricante — no traducido automáticamente todavía'}</p>
          <p className="text-slate-600 text-[10px] mt-1 flex items-center gap-1"><Clock size={9} /> {new Date(dtc.detected_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · fuente: {dtc.source || 'desconocida'}</p>
        </div>
        {!reviewed && clearStatus === 'none' && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onConfirm(dtc.id, true)} className="p-2 rounded-lg bg-[#10B981]/10 text-[#10B981]"><ThumbsUp size={14} /></button>
            <button onClick={() => setShowCorrect(true)} className="p-2 rounded-lg bg-red-500/10 text-red-400"><ThumbsDown size={14} /></button>
          </div>
        )}
        {reviewed && clearStatus === 'none' && (
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

      {/* [NUEVO 28/07/2026] Borrado de la falla (Mode $04) — solo
          disponible cuando hay un onClear (o sea, sesión en vivo con
          el auto conectado; en el histórico no se muestra, porque el
          auto ya no está en el elevador). */}
      {onClear && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80">
          {clearStatus === 'none' && (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={!deviceOnline}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800/60 text-slate-300 text-xs font-semibold border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Eraser size={13} /> {deviceOnline ? 'Borrar falla' : 'Equipo sin conexión'}
            </button>
          )}

          {clearStatus === 'pending' && (
            <div className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800/40 text-slate-400 text-xs font-semibold">
              <Loader2 size={13} className="animate-spin" /> Enviando a la ECU (Mode $04)...
            </div>
          )}

          {clearStatus === 'success' && (
            <div className="flex items-start gap-2 py-2 px-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30">
              <ShieldCheck size={14} className="text-[#10B981] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[#10B981] text-xs font-semibold">Falla borrada — MIL apagado</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Si vuelve a aparecer, la reparación no fue efectiva — es normal y esperado revisarla de nuevo.</p>
              </div>
            </div>
          )}

          {clearStatus === 'failed' && (
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 py-2 px-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-red-400 text-xs font-semibold">No se pudo borrar</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">{dtc.clear_detail || 'La ECU rechazó el pedido o no respondió.'}</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmClear(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800/60 text-slate-300 text-xs font-semibold border border-slate-700"
              >
                <RefreshCw size={12} /> Reintentar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación — explica qué hace realmente el
          borrado antes de mandarlo, para que no se use como "tapar"
          una falla que sigue presente. */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setConfirmClear(false)}>
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-slate-700 p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Eraser size={18} className="text-[#10B981]" />
              <h3 className="text-white font-bold text-sm">Borrar {dtc.decoded_code}</h3>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/40 rounded-lg p-2.5">
              <Info size={13} className="shrink-0 mt-0.5 text-slate-500" />
              <p>Esto apaga la luz del check y limpia el historial de la ECU — no repara nada. Si el problema real sigue presente, la falla va a volver a aparecer en el próximo manejo, y eso es lo esperado.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConfirmClear(false)} className="flex-1 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-semibold">
                Cancelar
              </button>
              <button
                onClick={() => { setConfirmClear(false); onClear(dtc.id); }}
                className="flex-1 py-2.5 rounded-lg bg-[#10B981] text-[#0B1120] text-sm font-bold"
              >
                Confirmar borrado
              </button>
            </div>
          </div>
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
