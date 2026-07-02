export default function Hero() {
  return (
    <div className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Efectos de luces de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#6366F1] blur-[120px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-[#10B981] blur-[150px] opacity-10 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 z-10 flex flex-col items-center text-center">
        {/* Etiqueta superior */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1E293B]/80 border border-slate-700/50 backdrop-blur-md mb-8 shadow-lg shadow-black/50">
          <span className="flex h-2.5 w-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
          <span className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
            Plataforma SaaS para Flotas • Sistema Online
          </span>
        </div>

        {/* Título */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-white">
          El Cerebro de IA para <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#10B981]">
            tu Flota.
          </span>
        </h1>

        {/* Párrafo descriptivo */}
        <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Previene fallos mecánicos costosos, audita el comportamiento de tus choferes y optimiza la rentabilidad de cada viaje utilizando telemetría avanzada OBD2 e Inteligencia Artificial.
        </p>
      </div>
    </div>
  );
}