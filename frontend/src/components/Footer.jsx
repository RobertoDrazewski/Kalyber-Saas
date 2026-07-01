export default function Footer() {
  return (
    <footer className="w-full bg-[#050B14] border-t border-slate-800/80 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-[#6366F1] to-[#10B981] flex items-center justify-center font-bold text-white text-xs">
                K
              </div>
              <span className="text-lg font-bold tracking-widest text-white">KYBER</span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm">
              Inteligencia Artificial aplicada a la gestión operativa de vehículos. Diseñado para dueños de flotas de Uber, Cabify y logística.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Producto</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Telemetría en Vivo</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Mantenimiento Predictivo</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Scoring de Choferes</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Hardware OBD2</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Compañía</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Sobre Nosotros</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Contacto</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Términos Legales</a></li>
              <li><a href="#" className="hover:text-[#6366F1] transition-colors">Privacidad</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
          <p>© 2026 Kyber AI. Todos los derechos reservados.</p>
          <p className="mt-2 md:mt-0">Operaciones en Mendoza, Argentina.</p>
        </div>
      </div>
    </footer>
  );
}
