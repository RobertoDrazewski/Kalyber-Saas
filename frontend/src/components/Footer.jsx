export default function Footer() {
  // Manejador del desplazamiento suave al hacer click en las secciones
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
        {/* Contenedor principal del grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
          
          {/* Columna de Logo y Descripción */}
          <div className="md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left">
            <img 
              src="/kaliber-banner.png" 
              alt="Kalyber Logo" 
              className="h-10 w-auto mb-6 object-contain" 
            />
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Inteligencia Artificial aplicada a la gestión operativa de vehículos. 
              El verdadero cerebro de telemetría predictiva y auditoría para flotas corporativas y de logística.
            </p>
          </div>

          {/* Columna de Navegación del Sitio Simplificada */}
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
            </ul>
          </div>
        </div>

        {/* Línea inferior y Derechos Reservados */}
        <div className="border-t border-slate-800/60 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4 mb-8">
          <p>© 2026 Kalyber.com.ar. Todos los derechos reservados.</p>
          <p>Operaciones en Mendoza, Argentina.</p>
        </div>

        {/* Bloque de Autoría: Centrado, logo en miniatura y enlaces de Puma Code */}
        <div className="border-t border-slate-800/40 pt-6 flex flex-col items-center justify-center text-center gap-3">
          <img 
            src="/puma-code.png" 
            alt="Puma Code Logo" 
            className="h-20 w-auto object-contain brightness-90 hover:brightness-100 transition-all"
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