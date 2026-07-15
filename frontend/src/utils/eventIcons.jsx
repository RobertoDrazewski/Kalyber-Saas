// ============================================================
// [NUEVO 14/07/2026] Mapeo de ícono + color por tipo de evento/alarma,
// para no repetir la misma lógica en TabTelemetria y TabHistorico (el
// cliente pidió íconos para el contacto ON/OFF y para cada evento o
// alarma en las tablas que él ve).
//
// Clasificamos por palabras clave en label/description, no por
// alarm_id numérico — igual que ya hacía severityColor() en
// TabTelemetria.jsx, porque el VL04 (GT06) y el VL502 (JT808) usan
// dos tablas de códigos distintas que comparten el mismo número para
// cosas diferentes. Los labels y descriptions ya vienen en texto
// plano desde el backend (ALARM_IDS / ALARM_CODES), así que matchear
// por palabra clave no colisiona entre las dos fuentes.
// ============================================================
import {
  AlertOctagon, Gauge, CornerDownRight, MapPinOff, MapPin, LogIn, LogOut,
  BatteryWarning, Unplug, ShieldAlert, DoorOpen, Fuel, Siren, Zap, X,
  Wind, RadioTower, HelpCircle, PlugZap, WifiOff,
} from 'lucide-react';

const RULES = [
  // [NUEVO 14/07/2026] Contacto ON/OFF como evento puntual — antes
  // caía al ícono por defecto (triángulo de alerta), que asusta sin
  // motivo para algo tan normal como prender el motor. Van ANTES que
  // la regla de colisión/etc a propósito, para no pisarlos por
  // coincidencia de palabras en la descripción.
  { keys: ['acc_on', 'contacto encendido'], Icon: Zap, cls: 'text-[#10B981]' },
  { keys: ['acc_off', 'contacto apagado'], Icon: X, cls: 'text-slate-400' },
  // [NUEVO 14/07/2026] Conexión del equipo perdida/restablecida — VL502
  // (ver gt06Server.js, detección propia por TCP, no depende del
  // equipo). "Reconectado" tiene que ir ANTES que "desconectado" en la
  // lista de reglas de abajo porque si no, "se reconectó después de
  // estar desconectado" matchearía la palabra "desconectado" primero.
  { keys: ['reconect', 'conexión restablecida'], Icon: PlugZap, cls: 'text-[#10B981]' },
  { keys: ['conexión perdida', 'se desconectó', 'sin conexión'], Icon: WifiOff, cls: 'text-red-400' },
  { keys: ['collision', 'colisi'], Icon: AlertOctagon, cls: 'text-red-400' },
  { keys: ['vuelco', 'rollover'], Icon: AlertOctagon, cls: 'text-red-400' },
  { keys: ['sos', 'emergencia'], Icon: Siren, cls: 'text-red-400' },
  { keys: ['sali', 'exit', 'geocerca sali'], Icon: LogOut, cls: 'text-amber-400' },
  { keys: ['entr', 'enter'], Icon: LogIn, cls: 'text-amber-400' },
  { keys: ['geocerca', 'fence'], Icon: MapPin, cls: 'text-amber-400' },
  { keys: ['frenada brusca', 'harsh_braking', 'hardec'], Icon: Gauge, cls: 'text-amber-400' },
  { keys: ['giro brusco', 'harsh_turn', 'hartu'], Icon: CornerDownRight, cls: 'text-amber-400' },
  { keys: ['aceleraci', 'harsh_accel', 'haracc'], Icon: Gauge, cls: 'text-amber-400' },
  { keys: ['exceso de velocidad', 'overspeed'], Icon: Gauge, cls: 'text-red-400' },
  { keys: ['corte de energ', 'power_cut', 'power alarm'], Icon: Unplug, cls: 'text-amber-400' },
  { keys: ['bateria', 'batería', 'battery', 'low battery', 'batalm'], Icon: BatteryWarning, cls: 'text-amber-400' },
  { keys: ['desconectado', 'unplugged', 'tamper', 'sabotaje'], Icon: Unplug, cls: 'text-red-400' },
  { keys: ['remolque', 'tow'], Icon: AlertOctagon, cls: 'text-amber-400' },
  { keys: ['robo de combustible', 'theft', 'robo'], Icon: Fuel, cls: 'text-red-400' },
  { keys: ['puerta', 'baúl', 'baul', 'door'], Icon: DoorOpen, cls: 'text-amber-400' },
  { keys: ['fatiga', 'fatigue'], Icon: HelpCircle, cls: 'text-amber-400' },
  { keys: ['vibrat', 'vibración', 'signal'], Icon: RadioTower, cls: 'text-slate-400' },
  { keys: ['viento', 'wind'], Icon: Wind, cls: 'text-slate-400' },
  { keys: ['gps', 'sin señal', 'sin gps'], Icon: MapPinOff, cls: 'text-slate-400' },
  { keys: ['falla', 'fault', 'dtc', 'trouble'], Icon: ShieldAlert, cls: 'text-red-400' },
];

export function getEventIcon(alarm) {
  const text = `${alarm?.label || ''} ${alarm?.description || alarm?.desc || ''}`.toLowerCase();
  const rule = RULES.find(r => r.keys.some(k => text.includes(k)));
  return rule ? { Icon: rule.Icon, cls: rule.cls } : { Icon: AlertOctagon, cls: 'text-slate-400' };
}

// Ícono de contacto (ACC) ON/OFF — mismo criterio visual en todos
// lados: rayo verde = motor encendido, X gris = apagado, "?" si el
// equipo todavía no mandó el dato (no es lo mismo que "apagado").
export function AccIcon({ accOn, size = 14 }) {
  if (accOn === null || accOn === undefined) {
    return <HelpCircle size={size} className="text-slate-600" />;
  }
  return accOn
    ? <Zap size={size} className="text-[#10B981]" />
    : <X size={size} className="text-slate-500" />;
}
