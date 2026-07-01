export default function Footer() {
  return (
    <footer className="w-full bg-[#050B14] border-t border-slate-800/80 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Contenedor principal del grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          
          {/* Columna de Logo y Descripción (Centrada/Alineada) */}
          <div className="md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left">
            <img 
              src="/kaliber-banner.png" 
              alt="Kyber ML Logo" 
              className="h-40 w-auto mb-24 object-contain" 
            />
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Inteligencia Artificial aplicada a la gestión operativa de vehículos. 
              Diseñado para dueños de flotas de Uber, Cabify y logística avanzada.
            </p>
          </div>

          {/* Columna de Producto */}
          <div className="md:col-span-3 md:col-start-7">
            <h4 className="text-white font-semibold mb-6">Producto</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Telemetría en Vivo</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Mantenimiento Predictivo</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Scoring de Choferes</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Hardware OBD2</a></li>
            </ul>
          </div>

          {/* Columna de Compañía */}
          <div className="md:col-span-2">
            <h4 className="text-white font-semibold mb-6">Compañía</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Sobre Nosotros</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Contacto</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Términos Legales</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Privacidad</a></li>
            </ul>
          </div>
        </div>

        {/* Línea inferior */}
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4">
          <p>© 2026 Kyber ML. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <p>Operaciones en Mendoza, Argentina.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}