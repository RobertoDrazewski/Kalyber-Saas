import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Footer from '../components/Footer';

// Subcomponente: Características
function Features() {
  return (
    <section id="features" className="py-24 bg-[#0B1120] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white">Características Principales</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#6366F1]/50 transition-colors">
            <div className="w-12 h-12 bg-[#6366F1]/20 rounded-xl flex items-center justify-center mb-6 text-[#6366F1]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Telemetría en Tiempo Real</h3>
            <p className="text-slate-400">Monitorea la ubicación exacta, velocidad y RPM de cada vehículo de tu flota con latencia mínima.</p>
          </div>
          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#10B981]/50 transition-colors">
            <div className="w-12 h-12 bg-[#10B981]/20 rounded-xl flex items-center justify-center mb-6 text-[#10B981]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Mantenimiento Predictivo IA</h3>
            <p className="text-slate-400">Nuestros algoritmos analizan los códigos de diagnóstico (DTC) previniendo fallos graves antes de que ocurran.</p>
          </div>
          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#F59E0B]/50 transition-colors">
            <div className="w-12 h-12 bg-[#F59E0B]/20 rounded-xl flex items-center justify-center mb-6 text-[#F59E0B]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Auditoría de Conductores</h3>
            <p className="text-slate-400">Detecta excesos de velocidad, frenadas bruscas y ralentí innecesario para optimizar el gasto de combustible.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Subcomponente: Hardware
function Hardware() {
  return (
    <section id="hardware" className="py-24 bg-[#050B14] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">Instalación Plug & Play</h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">
          Nuestro dispositivo de grado industrial se conecta directamente al puerto OBD2 de cualquier vehículo moderno. Cero cortes de cables, cero complicaciones.
        </p>
        <div className="w-full max-w-4xl mx-auto h-64 md:h-96 bg-gradient-to-br from-[#1E293B] to-[#0B1120] rounded-3xl border border-slate-700 flex items-center justify-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="z-10 flex flex-col items-center gap-4">
             <div className="w-32 h-20 bg-black border-2 border-slate-600 rounded-lg flex items-center justify-center shadow-xl shadow-black/60 relative">
                <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-slate-600 font-bold text-xs uppercase tracking-widest">OBD2</span>
             </div>
             <p className="text-slate-400 font-mono text-sm tracking-widest">Hardware Kalyber Connect V2</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Subcomponente: Pricing
function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-[#0B1120] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white">Planes Transparentes</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          <div className="bg-[#1E293B]/30 p-8 rounded-3xl border border-slate-700 text-left hover:border-slate-500 transition-colors">
            <h3 className="text-2xl font-bold text-white mb-2">Básico</h3>
            <p className="text-slate-400 mb-6">Para flotas pequeñas que solo necesitan rastreo.</p>
            <p className="text-5xl font-extrabold text-white mb-8">$15<span className="text-lg text-slate-500 font-normal">/mes</span></p>
            <ul className="text-slate-300 space-y-4 mb-8">
              <li className="flex items-center gap-3"><span className="text-[#10B981]">✓</span> GPS en tiempo real</li>
              <li className="flex items-center gap-3"><span className="text-[#10B981]">✓</span> Historial de viajes (30 días)</li>
              <li className="flex items-center gap-3"><span className="text-[#10B981]">✓</span> Alertas de velocidad</li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-b from-[#6366F1]/10 to-[#1E293B]/40 p-8 rounded-3xl border border-[#6366F1]/50 text-left relative transform md:-translate-y-4 shadow-xl shadow-[#6366F1]/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#6366F1] text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider">
              IA INCLUIDA
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Avanzado</h3>
            <p className="text-slate-400 mb-6">Control total y diagnóstico predictivo inteligente.</p>
            <p className="text-5xl font-extrabold text-[#6366F1] mb-8">$29<span className="text-lg text-slate-500 font-normal">/mes</span></p>
            <ul className="text-slate-300 space-y-4 mb-8">
              <li className="flex items-center gap-3"><span className="text-[#6366F1]">✓</span> Todo lo del plan Básico</li>
              <li className="flex items-center gap-3"><span className="text-[#6366F1]">✓</span> Lectura avanzada del motor OBD2</li>
              <li className="flex items-center gap-3"><span className="text-[#6366F1]">✓</span> Predicción de fallos con IA</li>
              <li className="flex items-center gap-3"><span className="text-[#6366F1]">✓</span> Score de conductores</li>
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white selection:bg-[#6366F1] selection:text-white font-sans flex flex-col scroll-smooth">
      <Navbar />
      
      <main className="flex-grow">
        <Hero />
        <Features />
        <Hardware />
        <Pricing />
      </main>

      <Footer />
    </div>
  );
}