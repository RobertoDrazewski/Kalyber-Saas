import { useEffect, useState, useRef } from 'react';
import { fetchAPI } from '../services/api';
import { Terminal, Send, CheckCircle2, Clock, XCircle, AlertTriangle, Radio, ChevronDown, Settings2, RefreshCw } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

// ============================================================
// Configuración de Equipos — panel de super_admin para mandar
// comandos/parámetros a los equipos por la conexión TCP que ya
// tienen abierta con nuestro servidor.
//
// [ACTUALIZADO 14/07/2026] Ahora soporta los DOS modelos, cada uno
// por su protocolo real:
//   - VL04 (GT06): comandos de texto tipo AT (protocolo 0x80),
//     confirmado funcionando contra tráfico real.
//   - VL502 (JT808): dos canales separados —
//       · Parámetros estructurados (0x8103, "Set Terminal
//         Parameters") para intervalo de reporte por TIEMPO y por
//         DISTANCIA, heartbeat, etc. Esto SÍ es el mensaje correcto
//         del estándar, pero todavía sin confirmar contra una prueba
//         real (falta ver que el equipo aplique el cambio de verdad).
//       · Terminal de texto libre (0x8300) — casi seguro NO configura
//         nada real (es para mostrar texto en pantalla), se deja como
//         canal de diagnóstico nomás, con la advertencia bien visible.
//
// LÍMITES QUE SIGUEN VIGENTES:
// 1) Los 3 comandos de arranque de un equipo NUEVO (APN + SERVER)
//    siguen sin poder mandarse desde acá — necesitan SMS real a la
//    SIM, y no hay proveedor de SMS conectado al proyecto todavía.
// 2) "Habilitar códigos de falla" en VL502: no encontramos ningún
//    comando de habilitación separado — el reporte de DTC (0x0900
//    subtipo 0x02) parece ser automático cuando el vehículo tiene
//    fallas activas, no algo que se prenda/apague por comando.
// ============================================================

const COMMAND_GROUPS_VL04 = [
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

const COMMAND_GROUPS_VL502_TEXT = [
    {
        title: '⚠️ Texto libre (0x8300) — probablemente no configura nada real',
        color: '#94A3B8',
        commands: [
            { label: 'Probar eco de texto', template: 'TEST' },
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

function ParamsPanelVL502({ imei, onSent }) {
    const [reportIntervalSec, setReportIntervalSec] = useState('');
    const [reportDistanceM, setReportDistanceM] = useState('');
    const [heartbeatIntervalSec, setHeartbeatIntervalSec] = useState('');
    const [sleepIntervalSec, setSleepIntervalSec] = useState('');
    const [alarmIntervalSec, setAlarmIntervalSec] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    async function send() {
        const params = {};
        if (reportIntervalSec !== '') params.reportIntervalSec = Number(reportIntervalSec);
        if (reportDistanceM !== '') params.reportDistanceM = Number(reportDistanceM);
        if (heartbeatIntervalSec !== '') params.heartbeatIntervalSec = Number(heartbeatIntervalSec);
        if (sleepIntervalSec !== '') params.sleepIntervalSec = Number(sleepIntervalSec);
        if (alarmIntervalSec !== '') params.alarmIntervalSec = Number(alarmIntervalSec);

        if (Object.keys(params).length === 0) {
            setError('Completá al menos un campo antes de enviar');
            return;
        }
        setSending(true);
        setError('');
        setNotice('');
        try {
            const res = await fetchAPI(`/devices/${imei}/params`, {
                method: 'POST',
                body: JSON.stringify(params),
            });
            setNotice(res.message);
            onSent();
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    }

    const inputCls = "w-full bg-[#0B1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600";

    return (
        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-5 space-y-4">
            <p className="text-sm font-semibold text-white flex items-center gap-2"><Settings2 size={15} className="text-[#6366F1]" /> Parámetros de reporte (JT808 0x8103)</p>
            <p className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                Sin confirmar contra una prueba real todavía — el equipo puede contestar "éxito" sin que el intervalo cambie de verdad. Confirmá mirando la frecuencia real de los reportes después de mandarlo.
            </p>

            <ErrorBanner message={error} />
            {notice && <div className="bg-[#6366F1]/10 border border-[#6366F1]/40 text-[#818CF8] p-2.5 rounded-lg text-xs">{notice}</div>}

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Reporte por TIEMPO (segundos)</label>
                    <input type="number" min="1" value={reportIntervalSec} onChange={e => setReportIntervalSec(e.target.value)} placeholder="Ej: 30" className={inputCls} />
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Reporte por DISTANCIA (metros)</label>
                    <input type="number" min="1" value={reportDistanceM} onChange={e => setReportDistanceM(e.target.value)} placeholder="Ej: 200" className={inputCls} />
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Intervalo de heartbeat (seg)</label>
                    <input type="number" min="1" value={heartbeatIntervalSec} onChange={e => setHeartbeatIntervalSec(e.target.value)} placeholder="Ej: 60" className={inputCls} />
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Reporte en modo sueño (seg)</label>
                    <input type="number" min="1" value={sleepIntervalSec} onChange={e => setSleepIntervalSec(e.target.value)} placeholder="Ej: 3600" className={inputCls} />
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Reporte durante alarma urgente (seg)</label>
                    <input type="number" min="1" value={alarmIntervalSec} onChange={e => setAlarmIntervalSec(e.target.value)} placeholder="Ej: 4" className={inputCls} />
                </div>
            </div>

            <button
                onClick={send}
                disabled={sending}
                className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-bold py-2.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
                <Send size={15} /> {sending ? 'Enviando...' : 'Enviar configuración'}
            </button>
        </div>
    );
}

export default function TabComandos() {
    const [devices, setDevices] = useState([]);
    const [devicesError, setDevicesError] = useState('');
    const [selectedImei, setSelectedImei] = useState('');
    const [terminalText, setTerminalText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [log, setLog] = useState([]);
    const [logError, setLogError] = useState('');
    const [confirmRisky, setConfirmRisky] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        fetchAPI('/devices').then(rows => {
            const paired = rows.filter(d => d.status === 'paired');
            setDevices(paired);
            if (!selectedImei && paired.length > 0) setSelectedImei(paired[0].imei);
        }).catch(err => setDevicesError(err.message));
    }, []);

    const loadLog = () => {
        if (!selectedImei) { setLog([]); return; }
        fetchAPI(`/devices/${selectedImei}/commands?limit=30`)
            .then(rows => { setLog(rows); setLogError(''); })
            .catch(err => setLogError(err.message));
    };
    useEffect(() => {
        loadLog();
        const interval = setInterval(loadLog, 4000);
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
            loadLog();
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
    const isVL502 = selectedDevice?.model === 'VL502';
    const commandGroups = isVL502 ? COMMAND_GROUPS_VL502_TEXT : COMMAND_GROUPS_VL04;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Terminal className="text-[#6366F1]" /> Configuración de Equipos
            </h2>
            <p className="text-slate-500 text-sm -mt-4">
                Manda comandos/parámetros por la conexión TCP activa del equipo — VL04 y VL502, cada uno con su protocolo real.
                El equipo tiene que estar encendido y conectado ahora mismo para recibirlo.
            </p>

            <ErrorBanner message={devicesError} />
            <ErrorBanner message={error} />
            {notice && (
                <div className="bg-[#6366F1]/10 border border-[#6366F1]/40 text-[#818CF8] p-3 rounded-xl text-sm">{notice}</div>
            )}

            <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-5">
                <label className="text-xs text-slate-500 uppercase tracking-wide font-semibold block mb-2">Equipo</label>
                <div className="relative">
                    <select
                        value={selectedImei}
                        onChange={e => setSelectedImei(e.target.value)}
                        className="w-full appearance-none bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm pr-10"
                    >
                        {devices.length === 0 && <option value="">Sin equipos pareados</option>}
                        {devices.map(d => (
                            <option key={d.imei} value={d.imei}>
                                [{d.model}] {d.imei} {d.vehicle_plate ? `— ${d.vehicle_plate}` : ''} {d.owner_company ? `(${d.owner_company})` : ''}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
                {selectedDevice && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                        <Radio size={12} /> <span className={`font-bold ${isVL502 ? 'text-[#818CF8]' : 'text-[#10B981]'}`}>{selectedDevice.model}</span> · {selectedDevice.vehicle_plate || 'Sin vehículo asignado'} · {selectedDevice.owner_company || selectedDevice.owner_name || 'Sin cliente asignado'}
                    </p>
                )}
            </div>

            {isVL502 && selectedImei && (
                <ParamsPanelVL502 imei={selectedImei} onSent={loadLog} />
            )}

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-5 space-y-5">
                    <p className="text-sm font-semibold text-white">
                        {isVL502 ? 'Texto libre (diagnóstico)' : 'Comandos frecuentes'}
                    </p>
                    {commandGroups.map(group => (
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
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-white">Historial reciente</p>
                            <button onClick={loadLog} className="text-slate-500 hover:text-white" title="Actualizar ahora">
                                <RefreshCw size={14} />
                            </button>
                        </div>
                        <ErrorBanner message={logError} />
                        {!logError && log.length === 0 ? (
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
