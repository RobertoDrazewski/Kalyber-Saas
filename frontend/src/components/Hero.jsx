export default function Hero() {
  return (
    <div className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Efectos de luces de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#6366F1] blur-[120px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-[#10B981] blur-[150px] opacity-10 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 z-10 flex flex-col items-center text-center">
        
        {/* Etiqueta superior disruptiva */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1E293B]/80 border border-[#ef4444]/30 backdrop-blur-md mb-8 shadow-lg shadow-black/50">
          <span className="flex h-2.5 w-2.5 rounded-full bg-[#ef4444] animate-pulse"></span>
          <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">
            El fin del GPS tradicional • Telemetría Predictiva
          </span>
        </div>

        {/* Título de alto impacto */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-white leading-tight">
          No rastrees tus vehículos. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#10B981]">
            Hazlos Inteligentes.
          </span>
        </h1>

        {/* Párrafo descriptivo enfocado en el dolor del cliente (dinero y roturas) */}
        <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          Un GPS normal solo te dice dónde está tu camioneta. <strong className="text-white font-semibold">Kalyber te dice qué le duele, cómo la manejan y cuánto dinero te hace perder.</strong> Conecta nuestro Cerebro de IA al motor de tu flota y evita averías de miles de dólares antes de que sucedan.
        </p>

        {/* Viñetas de refuerzo corporativo (Micro-copy) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-2 text-sm font-bold text-slate-400 tracking-wide uppercase">
          <div className="flex items-center gap-2">
            <span className="text-[#10B981] text-lg">✓</span> LECTURA DE MOTOR OBD2
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#10B981] text-lg">✓</span> AUDITORÍA DE CHOFERES
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#10B981] text-lg">✓</span> CERO CORTES DE CABLES
          </div>
        </div>

      </div>
    </div>
  );
}