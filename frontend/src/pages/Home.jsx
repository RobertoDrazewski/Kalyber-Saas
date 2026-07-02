import { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Footer from '../components/Footer';
import QuoteChatWidget from '../components/QuoteChatWidget';

// Subcomponente: Características
function Features() {
  return (
    <section id="features" className="py-24 bg-[#0B1120] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        {/* Encabezado con el Diferencial Claro */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Mucho más que un "Puntito en el Mapa"
          </h2>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto">
            Un GPS tradicional solo te dice dónde está tu vehículo. <strong className="text-white">Kalyber te dice qué le pasa, cómo lo están manejando y cuánto dinero te está ahorrando.</strong> Conoce el verdadero control de flotas.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Tarjeta 1: Telemetría */}
          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#6366F1]/50 transition-all hover:-translate-y-1 shadow-lg">
            <div className="w-12 h-12 bg-[#6366F1]/20 rounded-xl flex items-center justify-center mb-6 text-[#6366F1]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Visión de Rayos X 360°</h3>
            <p className="text-slate-400 leading-relaxed">
              Olvídate del rastreo básico. Accede a la <strong className="text-slate-300">telemetría profunda</strong> de tus unidades con cero latencia. Controla la ubicación con precisión milimétrica, lee las RPM reales y monitorea la temperatura del motor en vivo desde cualquier dispositivo.
            </p>
          </div>

          {/* Tarjeta 2: Mantenimiento Predictivo */}
          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#10B981]/50 transition-all hover:-translate-y-1 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/5 rounded-bl-full pointer-events-none"></div>
            <div className="w-12 h-12 bg-[#10B981]/20 rounded-xl flex items-center justify-center mb-6 text-[#10B981]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Tu Copiloto Mecánico IA</h3>
            <p className="text-slate-400 leading-relaxed">
              Nuestra Inteligencia Artificial se conecta directo al cerebro del auto. Extraemos y procesamos los códigos de falla (DTC) ocultos para <strong className="text-slate-300">advertirte sobre averías costosas semanas antes de que ocurran</strong>. Evita que un vehículo de logística se quede varado en la ruta.
            </p>
          </div>

          {/* Tarjeta 3: Auditoría de Conductores */}
          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#F59E0B]/50 transition-all hover:-translate-y-1 shadow-lg">
            <div className="w-12 h-12 bg-[#F59E0B]/20 rounded-xl flex items-center justify-center mb-6 text-[#F59E0B]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Máxima Rentabilidad</h3>
            <p className="text-slate-400 leading-relaxed">
              Erradica el desgaste innecesario y el robo silencioso de combustible. El sistema inercial de Kalyber audita a tus choferes 24/7, detectando y penalizando <strong className="text-slate-300">frenadas bruscas, aceleraciones agresivas y tiempos en ralentí</strong>.
            </p>
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
        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">Equipos de Grado Industrial</h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">
          Dispositivos Plug & Play que se conectan directamente al puerto OBD2 de tus vehículos. Sin cortes de cables, sin perder la garantía de fábrica.
        </p>
        
        {/* Tarjetas de Hardware */}
        <div className="grid md:grid-cols-2 gap-8 w-full mb-12 text-left">
          
          {/* Hardware Plan Básico (JM-VL04) */}
          <div className="bg-[#1E293B]/30 rounded-3xl border border-slate-700 overflow-hidden flex flex-col relative hover:border-slate-500 transition-colors">
            <div className="p-8 pb-0 flex justify-center items-center h-56 bg-gradient-to-b from-transparent to-[#0B1120]/50 relative">
              <div className="absolute top-4 left-4 bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-slate-600">
                Plan Básico
              </div>
              <img src="/Jimi_Vl04l.png" alt="Hardware VL04" className="h-48 w-auto object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-8 pt-6 flex-1 flex flex-col">
              <h3 className="text-2xl font-bold text-white mb-1">Tracker Inercial 4G</h3>
              <p className="text-sm font-mono text-slate-500 mb-6 tracking-widest">MODELO: JM-VL04</p>
              
              <ul className="space-y-4 text-slate-300 text-sm flex-1">
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Redes 4G LTE:</strong> Cobertura total con respaldo 3G/2G.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Rastreo INS Asistido:</strong> Navegación inercial para zonas sin señal GPS (túneles o galpones).</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Sensores de 6 Ejes:</strong> Acelerómetro y giroscopio para detectar 8 comportamientos peligrosos.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Alarma de Voz Interna:</strong> El equipo emite una voz humana en la cabina para advertir conductas de riesgo.</div>
                </li>
              </ul>
            </div>
          </div>

          {/* Hardware Plan Avanzado (VL502) */}
          <div className="bg-gradient-to-b from-[#6366F1]/10 to-[#1E293B]/40 rounded-3xl border border-[#6366F1]/50 overflow-hidden flex flex-col relative shadow-xl shadow-[#6366F1]/10 transform hover:-translate-y-2 transition-transform duration-300">
            <div className="p-8 pb-0 flex justify-center items-center h-56 bg-gradient-to-b from-transparent to-[#0B1120]/50 relative">
              <div className="absolute top-4 left-4 bg-[#6366F1] text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#6366F1]/40">
                Plan Avanzado
              </div>
              <img src="/Jimi_Vl502.png" alt="Hardware VL502" className="h-48 w-auto object-contain drop-shadow-[0_10px_20px_rgba(99,102,241,0.3)] transform hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-8 pt-6 flex-1 flex flex-col">
              <h3 className="text-2xl font-bold text-white mb-1">Escáner OBD2 Inteligente</h3>
              <p className="text-sm font-mono text-slate-500 mb-6 tracking-widest">MODELO: JM-VL502</p>
              
              <ul className="space-y-4 text-slate-300 text-sm flex-1">
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Telemetría de Motor (ECU):</strong> Lee RPM, temperatura, combustible y kilometraje exacto del tablero.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Diagnóstico de Fallas (DTC):</strong> Soporta protocolos K-Line y CAN Bus para extraer errores mecánicos reales.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Auditoría Híbrida:</strong> Combina acelerómetro para choferes con consumo real de ralentí.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Preparado para IA:</strong> Su flujo de datos es la base para el mantenimiento predictivo de Kalyber.</div>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Adicional: Cable Extensor */}
        <div className="max-w-3xl mx-auto bg-gradient-to-r from-[#1E293B] to-[#0B1120] p-6 rounded-2xl border border-slate-700 flex flex-col sm:flex-row items-center gap-6 text-left shadow-lg">
          <div className="w-16 h-16 shrink-0 bg-[#050B14] rounded-xl flex items-center justify-center border border-slate-600">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
          </div>
          <div className="flex-1">
            <h4 className="text-white font-bold text-lg mb-1">Instalación Oculta (Cable Extensor)</h4>
            <p className="text-sm text-slate-400">¿La ficha OBD2 de tu vehículo está muy a la vista o corre riesgo de ser pateada por el conductor? Ofrecemos un cable extensor plano por <strong className="text-white">$20 USD adicionales</strong>, ideal para esconder el equipo detrás del tablero y mantener la estética de la cabina.</p>
          </div>
        </div>

      </div>
    </section>
  );
}

// Subcomponente: Pricing (Actualizado con aclaración por unidad y cotizador IA para flotas)
function Pricing({ onOpenChat }) {
  return (
    <section id="pricing" className="py-24 bg-[#0B1120] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Planes Corporativos</h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Evita roturas costosas por el precio de un café al día. El hardware es tuyo con un pago único, luego solo abonas el acceso a la plataforma Kalyber.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 w-full">
          
          {/* Tarjeta Plan Básico */}
          <div className="bg-[#1E293B]/30 p-8 rounded-3xl border border-slate-700 flex flex-col hover:border-slate-500 transition-colors">
            <h3 className="text-2xl font-bold text-white mb-2">Básico</h3>
            <p className="text-slate-400 mb-8 h-12">Auditoría digital para controlar el comportamiento de tus choferes 24/7.</p>
            
            <div className="mb-6 p-5 bg-[#050B14] rounded-2xl border border-slate-800">
              <p className="text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Pago Único Inicial (Hardware)</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-4xl font-extrabold text-white">$110</p>
                <p className="text-slate-500 pb-1 font-medium">USD <span className="text-xs ml-1">/ unidad</span></p>
              </div>
              <p className="text-xs text-slate-500">Incluye: Hardware Tracker Inercial 4G (JM-VL04), chip M2M y configuración.</p>
            </div>

            <div className="mb-8">
              <p className="text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Mantenimiento Mensual (Software)</p>
              <div className="flex items-end gap-2">
                <p className="text-5xl font-extrabold text-white">$30</p>
                <p className="text-slate-500 pb-1 font-medium">/mes <span className="text-xs ml-1">por unidad</span></p>
              </div>
            </div>

            <hr className="border-slate-800 mb-8" />

            <ul className="text-slate-300 space-y-5 flex-1">
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Machine Learning (Choferes):</strong> IA aplicada exclusivamente para calificar conductas de manejo (frenadas, giros, aceleraciones).</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">GPS en Tiempo Real:</strong> Ubicación precisa con historial de rutas de 6 meses.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Geocercas Inteligentes:</strong> Notificaciones de entrada/salida y zonas prohibidas.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Alertas de Excesos:</strong> Control de velocidad y alarma de voz en cabina.</div>
              </li>
            </ul>
          </div>
          
          {/* Tarjeta Plan Avanzado */}
          <div className="bg-gradient-to-b from-[#6366F1]/10 to-[#1E293B]/40 p-8 rounded-3xl border border-[#6366F1]/50 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-[#6366F1]/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#6366F1] text-white px-5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase shadow-lg shadow-[#6366F1]/40">
              Copiloto IA Incluido
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Avanzado</h3>
            <p className="text-slate-400 mb-8 h-12">Diagnóstico predictivo para flotas corporativas. Tu Jefe de Mantenimiento automatizado.</p>
            
            <div className="mb-6 p-5 bg-[#050B14] rounded-2xl border border-[#6366F1]/30">
              <p className="text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Pago Único Inicial (Hardware)</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-4xl font-extrabold text-white">$130</p>
                <p className="text-slate-500 pb-1 font-medium">USD <span className="text-xs ml-1">/ unidad</span></p>
              </div>
              <p className="text-xs text-slate-500">Incluye: Escáner OBD2 4G (JM-VL502), chip M2M y vinculación API.</p>
            </div>

            <div className="mb-8">
              <p className="text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Mantenimiento Mensual (Software)</p>
              <div className="flex items-end gap-2">
                <p className="text-5xl font-extrabold text-[#6366F1]">$60</p>
                <p className="text-slate-500 pb-1 font-medium">/mes <span className="text-xs ml-1">por unidad</span></p>
              </div>
            </div>

            <hr className="border-slate-800 mb-8" />

            <ul className="text-slate-300 space-y-5 flex-1">
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Machine Learning Total:</strong> IA aplicada al conductor Y al diagnóstico predictivo del vehículo.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Telemetría de Motor (ECU):</strong> Lectura real de RPM, temperatura del refrigerante y nivel de combustible.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Diagnóstico de Fallas (DTC):</strong> Extracción de códigos de error mecánicos antes de averías severas.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">IA en Vivo (OpenAI):</strong> Notificaciones contextuales al instante ante anomalías y resumen diario.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Todo lo del plan Básico.</strong></div>
              </li>
            </ul>
          </div>
        </div>

        {/* Banner para Flotas con Botón de Cotizador IA */}
        <div className="mt-16 max-w-4xl mx-auto bg-gradient-to-r from-[#1E293B] to-[#0B1120] rounded-2xl border border-slate-700 p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          {/* Brillo decorativo */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366F1] blur-[100px] opacity-10 pointer-events-none"></div>
          
          <div className="text-center md:text-left z-10">
            <h4 className="text-2xl font-bold text-white mb-2">¿Tienes una flota de más de 10 vehículos?</h4>
            <p className="text-slate-400">Podemos estructurar descuentos por volumen en el hardware y en tu suscripción mensual corporativa.</p>
          </div>
          
          <button onClick={onOpenChat} className="shrink-0 z-10 flex items-center gap-3 px-8 py-4 bg-[#1E293B] hover:bg-[#2D3748] border border-[#6366F1]/50 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] group">
            {/* Ícono de "Bot/Sparkles" genérico para representar IA */}
            <svg className="w-5 h-5 text-[#6366F1] group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            Cotizar con IA
          </button>
        </div>

      </div>
    </section>
  );
}

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B1120] text-white selection:bg-[#6366F1] selection:text-white font-sans flex flex-col scroll-smooth">
      <Navbar />

      <main className="flex-grow">
        <Hero />
        <Features />
        <Hardware />
        <Pricing onOpenChat={() => setChatOpen(true)} />
      </main>

      <Footer />

      <QuoteChatWidget isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Botón flotante permanente, así el chat también se puede abrir sin scrollear a Pricing */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-[#6366F1] hover:bg-[#4F46E5] text-white p-4 rounded-full shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-transform hover:scale-105"
          aria-label="Cotizar con IA"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.5 0-2.91-.325-4.156-.898L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
        </button>
      )}
    </div>
  );
}