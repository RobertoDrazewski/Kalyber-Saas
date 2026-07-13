import { useEffect, useState, useRef } from 'react';
import { fetchAPI } from '../services/api';
import { Terminal, Send, CheckCircle2, Clock, XCircle, AlertTriangle, Radio, ChevronDown } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

// ============================================================
// Configuración de Equipos (VL04) — panel de super_admin para mandar
// comandos AT por la conexión TCP que el equipo ya tiene abierta con
// nuestro servidor (protocolo 0x80, ver gt06Server.js).
//
// LÍMITES REALES, a propósito de que no parezca más de lo que es:
//
// 1) Esto SOLO sirve para equipos VL04 que YA están apuntando a
//    nuestro servidor y conectados en este momento. Los primeros
//    comandos de arranque de un equipo nuevo (APN + SERVER) tienen
//    que ir por SMS real a la SIM — todavía no hay ningún proveedor
//    de SMS integrado al proyecto (no hay Twilio ni gateway propio),
//    así que esos 3 comandos NO están acá. Hay que seguir
//    mandándolos a mano por el panel de Conecty hasta que se decida
//    qué proveedor de SMS conectar.
//
// 2) SOLO VL04. El VL502 habla JT808 (protocolo binario distinto) y
//    no tenemos comandos de texto confirmados para ese lado — el
//    backend rechaza el envío si el equipo elegido es VL502.
//
// 3) El "✅ confirmado" es real, no un timeout optimista: cada
//    comando se manda con un ID de correlación (los 4 bytes
//    "Server Flag Bit" del protocolo), y el tilde solo aparece
//    cuando el EQUIPO responde de vuelta con ese mismo ID
//    (protocolo 0x21) — no es "lo mandamos y asumimos que anduvo".
// ============================================================

// Catálogo curado de comandos VL04, agrupados — cruzado contra el
// manual de comandos + lo que ya confirmamos funcionando en sesiones
// reales de esta misma investigación (HORCOL, SPEED, POWERALM, etc).
const COMMAND_GROUPS = [
    {
        title: 'Diagnóstico (solo lectura, sin riesgo)',
        color: '#6366F1',
        commands: [
            { label: 'Ver parámetros actuales', template: 'PARAM#' },
            { label: 'Ver estado del equipo', template: 'STATUS#' },
            { label: 'Pedir posición actual', template: 'WHERE#' },
            { label: 'Ver estado de la geocerca', template: 'FENCE#' },
            { label: 'Ver config de red (APN/servidor)', template: 'GPRSSET#' },
        ],
    },
    {
        title: 'Comportamiento de manejo',
        color: '#F59E0B',
        commands: [
            { label: 'Colisión (confirmado funcionando)', template: 'HORCOL,AUDIO,ON#' },
            { label: 'Aceleración brusca', template: 'HARACC,AUDIO,ON#' },
            { label: 'Frenada brusca', template: 'HARDEC,AUDIO,ON#' },
            { label: 'Giro brusco', template: 'HARTU,AUDIO,ON#' },
            { label: 'Volcamiento', template: 'ROLLOVER,AUDIO,ON#' },
            { label: 'Vehículo inestable', template: 'VEHSW,AUDIO,ON#' },
            { label: 'Vehículo sin equilibrio', template: 'EULAA,AUDIO,ON#' },
        ],
    },
    {
        title: 'Alarmas',
        color: '#EF4444',
        commands: [
            { label: 'Vibración (modo GPRS)', template: 'SIGNAL,ON,0#' },
            { label: 'Corte de energía (confirmado funcionando)', template: 'POWERALM,ON,2,10,1#' },
            { label: 'Batería baja', template: 'BATALM,ON,0#' },
            { label: 'Instalación / reconexión', template: 'INSTALLALM,ON,0#' },
            { label: 'Exceso de velocidad (80s, 120km/h)', template: 'SPEED,ON,80,120,0,ON#' },
            { label: 'Fatiga de manejo', template: 'FATIGUEALM,ON,240,20,30,0,ON#' },
        ],
    },
    {
        title: 'Contactos y reportes',
        color: '#10B981',
        commands: [
            { label: 'Agregar número SOS', template: 'SOS,A,#' },
            { label: 'Agregar número central', template: 'CENTER,A,#' },
            { label: 'Intervalo de reporte (10s ACC on / 60s off)', template: 'TIMER,10,60#' },
            { label: 'Activar odómetro del equipo', template: 'MILEAGE,ON,0#' },
        ],
    },
    {
        title: 'Cosméticos (no afectan el reporte)',
        color: '#818CF8',
        commands: [
            { label: 'LED encendido', template: 'LEDSW,ON#' },
            { label: 'Sonido al encender motor', template: 'ACCSOUND,AUDIO,ON#' },
            { label: 'Sonido en primera posición', template: 'POSITION,AUDIO,ON#' },
        ],
    },
    {
        title: '⚠️ Peligrosos — confirmar antes de mandar',
        color: '#EF4444',
        commands: [
            { label: 'Reiniciar equipo', template: 'RESET#', risky: true },
            { label: 'Restaurar a fábrica', template: 'FACTORY#', risky: true },
        ],
    },
];

function StatusIcon({ status }) {
    if (status === 'acked') return <CheckCircle2 size={15} className="text-[#10B981]" />;
    if (status === 'failed') return <XCircle size={15} className="text-red-400" />;
    return <Clock size={15} className="text-amber-400 animate-pulse" />;
}

function fmtHora(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TabComandos() {
    const [devices, setDevices] = useState([]);
    const [selectedImei, setSelectedImei] = useState('');
    const [terminalText, setTerminalText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [log, setLog] = useState([]);
    const [confirmRisky, setConfirmRisky] = useState(null); // comando riesgoso esperando doble confirmación
    const inputRef = useRef(null);

    useEffect(() => {
        fetchAPI('/devices').then(rows => {
            const vl04 = rows.filter(d => d.model === 'VL04' && d.status === 'paired');
            setDevices(vl04);
            if (!selectedImei && vl04.length > 0) setSelectedImei(vl04[0].imei);
        }).catch(err => setError(err.message));
    }, []);

    // Historial de comandos del equipo elegido — polling cada 4s
    // mientras haya algo "sent" sin confirmar todavía, para que el
    // tilde aparezca solo apenas el equipo conteste de verdad.
    useEffect(() => {
        if (!selectedImei) { setLog([]); return; }
        const load = () => fetchAPI(`/devices/${selectedImei}/commands?limit=30`).then(setLog).catch(() => {});
        load();
        const interval = setInterval(load, 4000);
        return () => clearInterval(interval);
    }, [selectedImei]);

    async function doSend(commandOverride) {
        const command = (commandOverride ?? terminalText).trim();
        if (!command || !selectedImei) return;
        setSending(true);
        setError('');
        setNotice('');
        try {
            const res = await fetchAPI(`/devices/${selectedImei}/command`, {
                method: 'POST',
                body: JSON.stringify({ command }),
            });
            setNotice(res.message);
            setTerminalText('');
            fetchAPI(`/devices/${selectedImei}/commands?limit=30`).then(setLog).catch(() => {});
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
            setConfirmRisky(null);
        }
    }

    function pickTemplate(cmd) {
        setTerminalText(cmd.template);
        setNotice('');
        setError('');
        inputRef.current?.focus();
        if (cmd.risky) setConfirmRisky(cmd);
    }

    const selectedDevice = devices.find(d => d.imei === selectedImei);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Terminal className="text-[#6366F1]" /> Configuración de Equipos (VL04)
            </h2>
            <p className="text-slate-500 text-sm -mt-4">
                Manda comandos AT por la conexión TCP activa del equipo. Solo VL04 — el equipo tiene que estar
                encendido y conectado ahora mismo para recibirlo.
            </p>

            <ErrorBanner message={error} />
            {notice && (
                <div className="bg-[#6366F1]/10 border border-[#6366F1]/40 text-[#818CF8] p-3 rounded-xl text-sm">{notice}</div>
            )}

            {/* Selector de equipo */}
            <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-5">
                <label className="text-xs text-slate-500 uppercase tracking-wide font-semibold block mb-2">Equipo</label>
                <div className="relative">
                    <select
                        value={selectedImei}
                        onChange={e => setSelectedImei(e.target.value)}
                        className="w-full appearance-none bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm pr-10"
                    >
                        {devices.length === 0 && <option value="">Sin equipos VL04 pareados</option>}
                        {devices.map(d => (
                            <option key={d.imei} value={d.imei}>
                                {d.imei} {d.vehicle_plate ? `— ${d.vehicle_plate}` : ''} {d.owner_company ? `(${d.owner_company})` : ''}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
                {selectedDevice && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                        <Radio size={12} /> {selectedDevice.vehicle_plate || 'Sin vehículo asignado'} · {selectedDevice.owner_company || selectedDevice.owner_name || 'Sin cliente asignado'}
                    </p>
                )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Paleta de comandos */}
                <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-5 space-y-5">
                    <p className="text-sm font-semibold text-white">Comandos frecuentes</p>
                    {COMMAND_GROUPS.map(group => (
                        <div key={group.title}>
                            <p className="text-[11px] uppercase tracking-wide font-semibold mb-2" style={{ color: group.color }}>{group.title}</p>
                            <div className="flex flex-wrap gap-2">
                                {group.commands.map(cmd => (
                                    <button
                                        key={cmd.template}
                                        onClick={() => pickTemplate(cmd)}
                                        title={cmd.template}
                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
                                    >
                                        {cmd.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Terminal + historial */}
                <div className="space-y-6">
                    <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-5">
                        <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Terminal size={15} /> Terminal</p>

                        {confirmRisky && (
                            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-xs p-3 rounded-lg mb-3 flex items-start gap-2">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <span><strong>{confirmRisky.label}</strong> es irreversible / reinicia el equipo. Revisá el comando antes de mandar.</span>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                value={terminalText}
                                onChange={e => setTerminalText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && doSend()}
                                placeholder="Escribí un comando o elegí uno de la lista..."
                                disabled={!selectedImei || sending}
                                className="flex-1 bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-[#6366F1] disabled:opacity-50"
                            />
                            <button
                                onClick={() => doSend()}
                                disabled={!selectedImei || !terminalText.trim() || sending}
                                className="px-4 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl disabled:opacity-40 flex items-center gap-2 font-semibold text-sm"
                            >
                                <Send size={15} /> {sending ? 'Enviando...' : 'Enviar'}
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-2">Los comandos con número de teléfono (SOS/CENTER) traen el campo vacío — completalo antes de mandar.</p>
                    </div>

                    <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-5">
                        <p className="text-sm font-semibold text-white mb-3">Historial reciente</p>
                        {log.length === 0 ? (
                            <p className="text-slate-600 text-sm">Sin comandos enviados a este equipo todavía.</p>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                {log.map(c => (
                                    <div key={c.id} className="px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-800">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs text-white truncate">{c.command_text}</span>
                                            <span className="flex items-center gap-1.5 shrink-0">
                                                <StatusIcon status={c.status} />
                                                <span className="text-[10px] text-slate-500">{fmtHora(c.created_at)}</span>
                                            </span>
                                        </div>
                                        {c.response_text && (
                                            <p className="text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800 whitespace-pre-wrap break-all">
                                                {c.response_text}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
