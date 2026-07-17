import { Activity, MapPin, History, Wrench, Users, Navigation, Car, CalendarDays, Radio, UserCog, Receipt, Cpu, ClipboardCheck, Key, Terminal } from 'lucide-react';

// Lista ÚNICA de herramientas del panel — la usan Sidebar (web) Y
// BottomNav (mobile), así nunca más se desincronizan entre las dos
// vistas cuando se agrega una tab nueva.
//
// visibleFor: si no está, el tab se ve para cualquier rol logueado en
// /dashboard (super_admin o admin — los choferes ni siquiera entran
// acá, tienen su propia vista en /driver).
export const menuItems = [
  { id: 'telemetria', label: 'Telemetría', icon: Activity },
  { id: 'posicion', label: 'Mapa en Vivo', icon: MapPin },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'mantenimiento', label: 'IA Mantenimiento', icon: Wrench },
  { id: 'mantenimientoRealizado', label: 'Mantenimiento Realizado', icon: ClipboardCheck },
  { id: 'conductores', label: 'Conductores', icon: Users },
  { id: 'viajes', label: 'KPIs Viajes', icon: Navigation },
  { id: 'flota', label: 'Gestión de Flota', icon: Car },
  { id: 'equipos', label: 'Equipos GPS', icon: Radio },
  { id: 'usuarios', label: 'Usuarios', icon: UserCog },
  { id: 'apikeys', label: 'API Keys', icon: Key },
  { id: 'diagnostico', label: 'Diagnóstico de Equipos', icon: Cpu, visibleFor: ['super_admin'] },
  { id: 'comandos', label: 'Configuración de Equipos', icon: Terminal, visibleFor: ['super_admin'] },
  { id: 'facturador', label: 'Facturador', icon: Receipt, visibleFor: ['super_admin'] },
];

export const roleLabel = { super_admin: 'Super Admin', admin: 'Admin de flota', driver: 'Chofer', taller: 'Taller (Kalyber Scanner)' };