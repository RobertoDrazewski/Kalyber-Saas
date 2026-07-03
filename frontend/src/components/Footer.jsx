export default function Footer() {
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
    <footer className="w-full bg-[#050B14] border-t border-slate-800/80 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
          
          <div className="md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left">
            <img 
              src="/kaliber-banner.png" 
              alt="Kalyber Logo" 
              className="w-40 md:w-52 h-auto object-contain shrink-0 mb-6" 
            />
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Inteligencia Artificial aplicada a la gestión operativa de vehículos. 
              El verdadero cerebro de telemetría predictiva y auditoría para flotas corporativas y de logística.
            </p>
          </div>

          <div className="md:col-span-4 md:col-start-9 flex flex-col items-center md:items-start text-center md:text-left">
            <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-xs">Secciones</h4>
            <ul className="space-y-4 text-sm font-medium text-slate-400">
              <li>
                <a href="#features" onClick={(e) => handleScroll(e, '#features')} className="hover:text-[#6366F1] transition-colors">
                  Características
                </a>
              </li>
              <li>
                <a href="#hardware" onClick={(e) => handleScroll(e, '#hardware')} className="hover:text-[#6366F1] transition-colors">
                  Hardware Industrial
                </a>
              </li>
              <li>
                <a href="#pricing" onClick={(e) => handleScroll(e, '#pricing')} className="hover:text-[#6366F1] transition-colors">
                  Planes Corporativos
                </a>
              </li>
              <li>
                <a href="mailto:Kalyber@puma-code.com" className="hover:text-[#10B981] transition-colors flex items-center justify-center md:justify-start gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  Kalyber@puma-code.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/60 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4 mb-8">
          <p>© 2026 Kalyber.com.ar. Todos los derechos reservados.</p>
          <p>Operaciones en Mendoza, Argentina.</p>
        </div>

        <div className="border-t border-slate-800/40 pt-6 flex flex-col items-center justify-center text-center gap-3">
          <img 
            src="/puma-code.png" 
            alt="Puma Code Logo" 
            className="w-28 md:w-32 h-auto object-contain shrink-0 brightness-90 hover:brightness-100 transition-all"
          />
          <p className="text-[11px] text-slate-600 tracking-wide">
            Kalyber.com.ar es un producto de software que pertenece a{' '}
            <a 
              href="https://www.puma-code.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-slate-500 hover:text-[#6366F1] font-semibold underline decoration-slate-700 hover:decoration-[#6366F1] transition-colors"
            >
              www.puma-code.com
            </a>
          </p>
          <span className="text-[10px] text-slate-700 font-mono uppercase tracking-widest">
            Powered and developed by Puma Code
          </span>
        </div>

      </div>
    </footer>
  );
}