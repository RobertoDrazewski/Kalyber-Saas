import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';

export default function DashboardLayout({ children, activeTab, setActiveTab }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B1120] flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Barra superior solo en mobile — logo + botón para el menú completo */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#050B14] border-b border-slate-800 flex items-center justify-between px-4 z-30">
        <span className="font-bold text-white tracking-widest text-sm">KALYBER</span>
        <button onClick={() => setMobileNavOpen(true)} className="text-white">
          <Menu size={22} />
        </button>
      </div>

      {/* Navegación inferior tipo app — acceso rápido a los tabs más usados */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onOpenMore={() => setMobileNavOpen(true)} />

      <main className="flex-1 md:ml-64 p-4 pt-20 pb-24 md:p-8 md:pb-8 overflow-y-auto w-full">
        {children}
      </main>
    </div>
  );
}
