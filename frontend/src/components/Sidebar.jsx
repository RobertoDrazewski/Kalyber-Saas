// Busca esta línea y asegúrate de incluir 'Car'
import { Activity, MapPin, History, Wrench, Users, Navigation, LogOut, Car, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navigate = useNavigate();

  // Dentro de src/components/Sidebar.jsx
const menuItems = [
    { id: 'telemetria', label: 'Telemetría', icon: Activity },
    { id: 'posicion', label: 'Mapa en Vivo', icon: MapPin },
    { id: 'calendario', label: 'Calendario', icon: CalendarDays },
    { id: 'historico', label: 'Histórico', icon: History },
    { id: 'mantenimiento', label: 'IA Mantenimiento', icon: Wrench },
    { id: 'conductores', label: 'Conductores', icon: Users },
    { id: 'viajes', label: 'KPIs Viajes', icon: Navigation },
    { id: 'flota', label: 'Gestión de Flota', icon: Car }, // Asegúrate de tener esto
];

  const handleLogout = () => {
    localStorage.removeItem('kyber_token');
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-[#050B14] border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-[#6366F1] to-[#10B981] flex items-center justify-center font-bold text-white">K</div>
        <span className="text-xl font-bold tracking-widest text-white">Kalyber</span>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
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

      <div className="p-4 border-t border-slate-800">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-[#EF4444] transition-colors rounded-xl hover:bg-[#EF4444]/10">
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}