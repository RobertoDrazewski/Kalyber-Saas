import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Home, Shield } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import GoogleTranslateBar from '../components/GoogleTranslateBar';

const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', driver: 'Chofer', taller: 'Taller' };
const ROLE_COLOR = {
  super_admin: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30',
  admin: 'text-[#6366F1] bg-[#6366F1]/10 border-[#6366F1]/30',
  driver: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30',
  taller: 'text-[#EC4899] bg-[#EC4899]/10 border-[#EC4899]/30',
};

export default function DashboardLayout({ children, activeTab, setActiveTab }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem('kyber_user') || '{}');
  const roleLabel = ROLE_LABEL[user.role] || user.role || '—';
  const roleColor = ROLE_COLOR[user.role] || 'text-slate-400 bg-slate-700/30 border-slate-600';

  return (
    <div className="min-h-screen bg-[#0B1120] flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Barra superior mobile — logo + botón para el menú completo */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#050B14] border-b border-slate-800 flex items-center justify-between px-4 z-30">
        <span className="font-bold text-white tracking-widest text-sm">KALYBER</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${roleColor}`}>
            {roleLabel}
          </span>
          <button onClick={() => setMobileNavOpen(true)} className="text-white">
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Navegación inferior tipo app — acceso rápido a los tabs más usados */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onOpenMore={() => setMobileNavOpen(true)} />

      <div className="flex-1 md:ml-64 flex flex-col w-full">
        {/* Barra superior desktop — usuario logueado, traductor, volver a la web */}
        <div className="hidden md:flex items-center justify-between h-16 px-8 border-b border-slate-800 bg-[#050B14]/60 shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-slate-500" />
            <span className="text-sm text-slate-300">
              Conectado como <span className="font-semibold text-white">{user.name || 'Usuario'}</span>
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${roleColor}`}>
              {roleLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <GoogleTranslateBar />
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1E293B]/50 hover:bg-[#1E293B] border border-slate-700/50 hover:border-slate-600 transition-all text-slate-300 hover:text-white text-sm font-medium"
            >
              <Home size={16} /> Volver a la web
            </Link>
          </div>
        </div>

        <main className="flex-1 p-4 pt-20 pb-24 md:p-8 md:pb-8 overflow-y-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}