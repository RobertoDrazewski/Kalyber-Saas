export default function Hero() {
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

        {/* Descripción clara y directa */}
        <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          Kalyber es la herramienta perfecta para <strong>autos de Uber, Cabify, taxis y utilitarios de reparto</strong>. Somos compatibles 100% con puerto <strong>OBD2</strong>. Usted es dueño del equipo desde el primer día: simplemente conéctelo y muévalo libremente entre los vehículos de su flota.
        </p>

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
          * Tecnología Plug & Play: No requiere instalación técnica. Autogestión total de su flota.
        </p>

      </div>
    </div>
  );
}