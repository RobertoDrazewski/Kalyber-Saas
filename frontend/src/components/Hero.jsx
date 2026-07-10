export default function Hero({ onOpenChat, onOpenContact }) {
  return (
    <div className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Efectos de luces de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#6366F1] blur-[120px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-[#10B981] blur-[150px] opacity-10 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 z-10 flex flex-col items-center text-center">
        
        {/* Etiqueta superior */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1E293B]/80 border border-[#10B981]/30 backdrop-blur-md mb-8 shadow-lg shadow-black/50">
          <span className="flex h-2.5 w-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
          <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">
            Telemetría especializada para Vehículos Livianos
          </span>
        </div>

        {/* Título de impacto */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white leading-tight">
          La inteligencia definitiva para <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#10B981]">
            flotas de vehículos livianos.
          </span>
        </h1>

        {/* Descripción clara y directa con el NUEVO ENFOQUE PROPIETARIO */}
        <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          A diferencia de los rastreadores tradicionales que dependen de software genérico de terceros, Kalyber es una plataforma de inteligencia operativa <strong className="text-white">100% propietaria e independiente</strong>. Obtenga telemetría avanzada, diagnósticos OBD2 Plug & Play y la tranquilidad de una infraestructura de datos blindada y auditable mediante API.
        </p>

        {/* BOTONES DE CALL TO ACTION */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12 w-full max-w-2xl mx-auto">
          
          {/* Botón Asesor IA */}
          <button
            onClick={onOpenChat}
            className="group relative w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_35px_rgba(99,102,241,0.6)] hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
            <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.5 0-2.91-.325-4.156-.898L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
            <span className="relative z-10">Hablar con asesor IA</span>
          </button>

          {/* Botón Flota +50 */}
          <button
            onClick={onOpenContact}
            className="group w-full sm:w-auto flex items-center justify-center gap-3 bg-[#1E293B]/80 hover:bg-[#2D3748] border border-slate-600 hover:border-[#10B981] text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:-translate-y-1"
          >
            <svg className="w-6 h-6 text-[#10B981] group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
            </svg>
            <span>Flota de +50 unidades</span>
          </button>

        </div>

        {/* Viñetas de valor añadido */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-bold text-slate-300 mb-10">
          <div className="flex items-center gap-2 bg-[#1E293B]/50 px-4 py-2 rounded-lg">
            <span className="text-[#10B981]">✓</span> Perfiles de conducción de choferes
          </div>
          <div className="flex items-center gap-2 bg-[#1E293B]/50 px-4 py-2 rounded-lg">
            <span className="text-[#10B981]">✓</span> Mantenimiento preventivo con Machine Learning
          </div>
        </div>

        {/* Nota de instalación */}
        <p className="text-slate-500 text-sm italic">
          * Tecnología Plug & Play: Sin instalaciones invasivas que anulan garantías. Cero lucro cesante.
        </p>

      </div>
    </div>
  );
}