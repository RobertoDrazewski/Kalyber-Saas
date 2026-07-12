import { useState } from 'react';
import { Activity, MapPin, CalendarDays, Wrench, Menu, X, LogOut, ArrowLeftCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { menuItems, roleLabel } from '../constants/menuItems';

// Los 4 más usados quedan fijos abajo (accesibles con el pulgar sin
// tocar nada más). TODO lo demás — incluido lo que se va agregando
// con el tiempo — vive en "Más", que ahora abre una grilla completa
// en vez de depender del drawer angosto del costado.
const QUICK_ITEMS = [
  { id: 'telemetria', label: 'Live', icon: Activity },
  { id: 'posicion', label: 'Mapa', icon: MapPin },
  { id: 'calendario', label: 'Agenda', icon: CalendarDays },
  { id: 'mantenimiento', label: 'IA', icon: Wrench },
];

export default function BottomNav({ activeTab, setActiveTab }) {
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('kyber_user') || '{}');

  // Misma lista que usa el Sidebar de escritorio — se actualiza sola
  // cuando se agrega una tab nueva, sin tener que tocar este archivo.
  const visibleItems = menuItems.filter(item => !item.visibleFor || item.visibleFor.includes(currentUser.role));

  const handleSelect = (id) => {
    setActiveTab(id);
    setShowMore(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('kyber_token');
    localStorage.removeItem('kyber_user');
    navigate('/login');
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#050B14] border-t border-slate-800 flex items-stretch z-30 pb-[env(safe-area-inset-bottom)]">
        {QUICK_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-[#6366F1]' : 'text-slate-500'
              }`}
            >
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowMore(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
            showMore ? 'text-[#6366F1]' : 'text-slate-500'
          }`}
        >
          <Menu size={20} />
          Más
        </button>
      </nav>

      {/* Grilla completa de herramientas — pantalla completa, fácil de
          tocar con el pulgar, sin depender de un drawer angosto */}
      {showMore && (
        <div className="md:hidden fixed inset-0 bg-[#0B1120] z-40 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
            <div>
              <span className="inline-block text-[11px] font-semibold px-2 py-1 rounded-full bg-[#6366F1]/15 text-[#818CF8]">
                {roleLabel[currentUser.role] || currentUser.role}
              </span>
              {currentUser.name && <p className="text-sm text-white font-bold mt-1">{currentUser.name}</p>}
            </div>
            <button onClick={() => setShowMore(false)} className="text-slate-400 hover:text-white p-2">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24">
            <div className="grid grid-cols-3 gap-3">
              {visibleItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl text-center transition-colors ${
                      isActive
                        ? 'bg-[#6366F1] text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                        : 'bg-[#1E293B]/50 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <Icon size={22} />
                    <span className="text-xs font-medium leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 space-y-1 shrink-0 pb-[env(safe-area-inset-bottom)]">
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
        </div>
      )}
    </>
  );
}
