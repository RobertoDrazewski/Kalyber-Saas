import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';

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

      {/* Barra superior solo en mobile, con botón hamburguesa */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#050B14] border-b border-slate-800 flex items-center px-4 z-30">
        <button onClick={() => setMobileNavOpen(true)} className="text-white">
          <Menu size={22} />
        </button>
        <span className="ml-3 font-bold text-white tracking-widest text-sm">KYBER</span>
      </div>

      <main className="flex-1 md:ml-64 p-4 pt-20 md:p-8 overflow-y-auto w-full">
        {children}
      </main>
    </div>
  );
}
