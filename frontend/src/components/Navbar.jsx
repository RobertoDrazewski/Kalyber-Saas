import { Link } from 'react-router-dom';

export default function Navbar() {
  // Manejador del desplazamiento suave al hacer click en los enlaces.
  const handleScroll = (e, targetId) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      const element = document.querySelector(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-between items-center h-20">
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <img 
            src="/kaliber-banner.png" 
            alt="Logo Puma Code / Kyber" 
            className="h-50 w-auto object-contain group-hover:scale-105 transition-transform"
          />
        </Link>

        {/* Enlaces Centrales: Visibles solo en Desktop (hidden md:flex).
          El menú hamburguesa fue eliminado por completo, en móvil no se muestra nada.
        */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#features" onClick={(e) => handleScroll(e, '#features')} className="hover:text-white transition-colors">Características</a>
          <a href="#hardware" onClick={(e) => handleScroll(e, '#hardware')} className="hover:text-white transition-colors">Hardware</a>
          <a href="#pricing" onClick={(e) => handleScroll(e, '#pricing')} className="hover:text-white transition-colors">Planes</a>
        </div>

        {/* Botón de Acceso */}
        <div>
          <Link 
            to="/login" 
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1E293B] to-[#0F172A] hover:from-[#2D3748] hover:to-[#1E293B] border border-slate-700 text-white text-sm font-bold transition-all hover:border-[#6366F1] shadow-lg"
          >
            Iniciar Sesión
          </Link>
        </div>
        
      </div>
    </nav>
  );
}