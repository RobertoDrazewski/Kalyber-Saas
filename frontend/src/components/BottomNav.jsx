import { Activity, MapPin, CalendarDays, Wrench, Menu } from 'lucide-react';

const QUICK_ITEMS = [
  { id: 'telemetria', label: 'Live', icon: Activity },
  { id: 'posicion', label: 'Mapa', icon: MapPin },
  { id: 'calendario', label: 'Agenda', icon: CalendarDays },
  { id: 'mantenimiento', label: 'IA', icon: Wrench },
];

export default function BottomNav({ activeTab, setActiveTab, onOpenMore }) {
  return (
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
        onClick={onOpenMore}
        className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500"
      >
        <Menu size={20} />
        Más
      </button>
    </nav>
  );
}
