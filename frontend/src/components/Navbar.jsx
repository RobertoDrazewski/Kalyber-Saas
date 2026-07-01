import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-[#0B1120]/80 backdrop-blur-md border-b border-slate-800/50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-between items-center h-20">
        
        {/* Logo Actualizado */}
        <Link to="/" className="flex items-center gap-3 group">
          <img 
            src="/kaliber-banner.png" 
            alt="Logo Puma Code / Kyber" 
            className="h-60 w-auto object-contain group-hover:scale-105 transition-transform drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]"
          />
        </Link>

        {/* Enlaces y Login */}
        <div className="flex items-center gap-8">
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Características</a>
            <a href="#hardware" className="hover:text-white transition-colors">Hardware</a>
            <a href="#pricing" className="hover:text-white transition-colors">Planes</a>
          </div>
          <Link 
            to="/login" 
            className="px-6 py-2.5 rounded-lg bg-[#1E293B] hover:bg-[#2D3748] border border-slate-700 text-white text-sm font-semibold transition-all hover:border-[#6366F1]"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    </nav>
  );
}