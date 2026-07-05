import { Activity, MapPin, History, Wrench, Users, Navigation, LogOut, Car, CalendarDays, X, Radio, UserCog, ArrowLeftCircle, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// visibleFor: si no está, el tab se ve para cualquier rol logueado en
// /dashboard (super_admin o admin — los choferes ni siquiera entran
// acá, tienen su propia vista en /driver).
const menuItems = [
  { id: 'telemetria', label: 'Telemetría', icon: Activity },
  { id: 'posicion', label: 'Mapa en Vivo', icon: MapPin },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'mantenimiento', label: 'IA Mantenimiento', icon: Wrench },
  { id: 'conductores', label: 'Conductores', icon: Users },
  { id: 'viajes', label: 'KPIs Viajes', icon: Navigation },
  { id: 'flota', label: 'Gestión de Flota', icon: Car },
  { id: 'equipos', label: 'Equipos GPS', icon: Radio }, // admin la ve para PAREAR, no para dar de alta (eso se filtra dentro de TabEquipos)
  { id: 'usuarios', label: 'Usuarios', icon: UserCog },
  { id: 'facturador', label: 'Facturador', icon: Receipt, visibleFor: ['super_admin'] },
];

const roleLabel = { super_admin: 'Super Admin', admin: 'Admin de flota', driver: 'Chofer' };

export default function Sidebar({ activeTab, setActiveTab, isOpen, onClose }) {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('kyber_user') || '{}');

  const visibleItems = menuItems.filter(item => !item.visibleFor || item.visibleFor.includes(currentUser.role));

  const handleLogout = () => {
    localStorage.removeItem('kyber_token');
    localStorage.removeItem('kyber_user');
    navigate('/login');
  };

  const handleSelect = (id) => {
    setActiveTab(id);
    onClose?.(); // en mobile, elegir un tab cierra el drawer
  };

  return (
    <>
      {/* Overlay oscuro detrás del drawer en mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`w-64 bg-[#050B14] border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#6366F1] to-[#10B981] flex items-center justify-center font-bold text-white">K</div>
            <span className="text-xl font-bold tracking-widest text-white">KALYBER</span>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <X size={22} />
          </button>
        </div>

        {/* Quién está logueado — para que nunca sea confuso qué vista es */}
        <div className="px-6 pb-2">
          <span className="inline-block text-[11px] font-semibold px-2 py-1 rounded-full bg-[#6366F1]/15 text-[#818CF8]">
            {roleLabel[currentUser.role] || currentUser.role}
          </span>
          {currentUser.name && <p className="text-xs text-slate-500 mt-1 truncate">{currentUser.name}</p>}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-[#6366F1] text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                    : 'text-slate-400 hover:bg-[#1E293B] hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-1">
          <a
            href="/"
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-[#1E293B]"
          >
            <ArrowLeftCircle size={18} />
            Volver a la web
          </a>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-[#EF4444] transition-colors rounded-xl hover:bg-[#EF4444]/10">
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
