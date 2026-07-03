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
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Inteligencia Operativa Integral
          </h2>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto">
            Un rastreador estándar solo proporciona coordenadas. <strong className="text-white">Kalyber diagnostica el estado del vehículo, evalúa los patrones de conducción y maximiza el retorno de inversión.</strong> Experimente el verdadero control de flotas.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#6366F1]/50 transition-all hover:-translate-y-1 shadow-lg">
            <div className="w-12 h-12 bg-[#6366F1]/20 rounded-xl flex items-center justify-center mb-6 text-[#6366F1]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Telemetría de Alta Precisión</h3>
            <p className="text-slate-400 leading-relaxed">
              Supere el monitoreo básico. Acceda a la <strong className="text-slate-300">extracción de datos profundos</strong> de sus unidades con latencia mínima. Supervise la ubicación exacta, las revoluciones del motor (RPM) y la temperatura en tiempo real desde cualquier plataforma.
            </p>
          </div>

          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#10B981]/50 transition-all hover:-translate-y-1 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/5 rounded-bl-full pointer-events-none"></div>
            <div className="w-12 h-12 bg-[#10B981]/20 rounded-xl flex items-center justify-center mb-6 text-[#10B981]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Mantenimiento Predictivo (IA)</h3>
            <p className="text-slate-400 leading-relaxed">
              Nuestros algoritmos se comunican directamente con la unidad de control (ECU). Extraemos y procesamos los códigos de diagnóstico (DTC) ocultos para <strong className="text-slate-300">alertar sobre anomalías mecánicas antes de que ocasionen tiempos de inactividad críticos</strong>.
            </p>
          </div>

          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#F59E0B]/50 transition-all hover:-translate-y-1 shadow-lg">
            <div className="w-12 h-12 bg-[#F59E0B]/20 rounded-xl flex items-center justify-center mb-6 text-[#F59E0B]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Evaluación de Conductores</h3>
            <p className="text-slate-400 leading-relaxed">
              Reduzca el desgaste prematuro de los componentes y el consumo ineficiente de combustible. El sistema inercial audita a los operadores constantemente, detectando <strong className="text-slate-300">frenadas bruscas, aceleraciones agresivas y excesos de tiempo en ralentí</strong>.
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
        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">Hardware de Grado Industrial</h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">
          Dispositivos de instalación "Plug & Play" que se conectan directamente al puerto OBD2 del vehículo. Una solución no invasiva que preserva la garantía original del fabricante.
        </p>
        
        <div className="grid md:grid-cols-2 gap-8 w-full mb-12 text-left">
          
          <div className="bg-[#1E293B]/30 rounded-3xl border border-slate-700 overflow-hidden flex flex-col relative hover:border-slate-500 transition-colors">
            <div className="p-8 pb-0 flex justify-center items-center h-56 bg-gradient-to-b from-transparent to-[#0B1120]/50 relative">
              <div className="absolute top-4 left-4 bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-slate-600">
                Suscripción Básica
              </div>
              <img src="/Jimi_Vl04l.png" alt="Hardware VL04" className="h-48 w-auto object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-8 pt-6 flex-1 flex flex-col">
              <h3 className="text-2xl font-bold text-white mb-1">Rastreador Inercial 4G</h3>
              <p className="text-sm font-mono text-slate-500 mb-6 tracking-widest">MODELO: JM-VL04</p>
              
              <ul className="space-y-4 text-slate-300 text-sm flex-1">
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Conectividad 4G LTE:</strong> Cobertura extendida con redundancia de red 3G/2G.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Navegación INS Asistida:</strong> Seguimiento inercial continuo en áreas sin cobertura satelital (ej. túneles).</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Sensores Inerciales (6 Ejes):</strong> Acelerómetro y giroscopio calibrados para identificar patrones de conducción de riesgo.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Alerta Acústica en Cabina:</strong> Notificación de voz automatizada para corrección inmediata del comportamiento del conductor.</div>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-gradient-to-b from-[#6366F1]/10 to-[#1E293B]/40 rounded-3xl border border-[#6366F1]/50 overflow-hidden flex flex-col relative shadow-xl shadow-[#6366F1]/10 transform hover:-translate-y-2 transition-transform duration-300">
            <div className="p-8 pb-0 flex justify-center items-center h-56 bg-gradient-to-b from-transparent to-[#0B1120]/50 relative">
              <div className="absolute top-4 left-4 bg-[#6366F1] text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#6366F1]/40">
                Suscripción Avanzada
              </div>
              <img src="/Jimi_Vl502.png" alt="Hardware VL502" className="h-48 w-auto object-contain drop-shadow-[0_10px_20px_rgba(99,102,241,0.3)] transform hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-8 pt-6 flex-1 flex flex-col">
              <h3 className="text-2xl font-bold text-white mb-1">Escáner Telemétrico OBD2</h3>
              <p className="text-sm font-mono text-slate-500 mb-6 tracking-widest">MODELO: JM-VL502</p>
              
              <ul className="space-y-4 text-slate-300 text-sm flex-1">
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Lectura Directa de ECU:</strong> Extracción en vivo de parámetros como RPM, temperatura del refrigerante y consumo de combustible.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Diagnóstico de Errores (DTC):</strong> Compatibilidad con protocolos K-Line y CAN Bus para la identificación de fallas mecánicas.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Auditoría Operativa Híbrida:</strong> Correlación de datos del acelerómetro con métricas reales de consumo del vehículo.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Arquitectura Optimizada para IA:</strong> Generación de flujos de datos de alta resolución, esenciales para el mantenimiento predictivo.</div>
                </li>
              </ul>
            </div>
          </div>

        </div>

        <div className="max-w-3xl mx-auto bg-gradient-to-r from-[#1E293B] to-[#0B1120] p-6 rounded-2xl border border-slate-700 flex flex-col sm:flex-row items-center gap-6 text-left shadow-lg">
          <div className="w-16 h-16 shrink-0 bg-[#050B14] rounded-xl flex items-center justify-center border border-slate-600">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
          </div>
          <div className="flex-1">
            <h4 className="text-white font-bold text-lg mb-1">Solución de Instalación Oculta (Cable Extensor)</h4>
            <p className="text-sm text-slate-400">Si el puerto OBD2 de la unidad presenta problemas de espacio o riesgo de impacto accidental, disponemos de un cable extensor plano por <strong className="text-white">$20 USD adicionales</strong>. Esta opción facilita el montaje interno detrás del panel, garantizando la seguridad del dispositivo.</p>
          </div>
        </div>

      </div>
    </section>
  );
}

// Subcomponente: Pricing
function Pricing({ onOpenChat }) {
  return (
    <section id="pricing" className="py-24 bg-[#0B1120] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Estructura de Suscripciones Corporativas</h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Prevenga incidentes mecánicos severos con una inversión inicial mínima. Adquiera el hardware en propiedad mediante un pago único y acceda a la plataforma Kalyber a través de una suscripción recurrente.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 w-full">
          
          <div className="bg-[#1E293B]/30 p-8 rounded-3xl border border-slate-700 flex flex-col hover:border-slate-500 transition-colors">
            <h3 className="text-2xl font-bold text-white mb-2">Plan Básico</h3>
            <p className="text-slate-400 mb-8 h-12">Herramientas de auditoría digital para la gestión y evaluación del comportamiento de los operadores.</p>
            
            <div className="mb-6 p-5 bg-[#050B14] rounded-2xl border border-slate-800">
              <p className="text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Inversión Inicial (Hardware)</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-4xl font-extrabold text-white">$110</p>
                <p className="text-slate-500 pb-1 font-medium">USD <span className="text-xs ml-1">/ unidad</span></p>
              </div>
              <p className="text-xs text-slate-500">Incluye: Hardware Rastreador Inercial (JM-VL04), conectividad M2M y parametrización.</p>
            </div>

            <div className="mb-8">
              <p className="text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Suscripción Mensual (Software)</p>
              <div className="flex items-end gap-2">
                <p className="text-5xl font-extrabold text-white">$30</p>
                <p className="text-slate-500 pb-1 font-medium">/mes <span className="text-xs ml-1">por unidad</span></p>
              </div>
            </div>

            <hr className="border-slate-800 mb-8" />

            <ul className="text-slate-300 space-y-5 flex-1">
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Análisis de Operadores (Machine Learning):</strong> Evaluación algorítmica de los patrones de conducción para identificar áreas de mejora.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Rastreo Satelital Continuo:</strong> Posicionamiento global con registro histórico de recorridos.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Gestión de Perímetros (Geocercas):</strong> Configuración de áreas operativas y alertas automáticas por desvíos.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Control de Velocidad:</strong> Parametrización de límites y advertencias dinámicas en el interior de la unidad.</div>
              </li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-b from-[#6366F1]/10 to-[#1E293B]/40 p-8 rounded-3xl border border-[#6366F1]/50 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-[#6366F1]/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#6366F1] text-white px-5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase shadow-lg shadow-[#6366F1]/40">
              Integración IA Avanzada
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Plan Avanzado</h3>
            <p className="text-slate-400 mb-8 h-12">Solución integral de diagnóstico predictivo y telemetría para la gestión proactiva de flotas corporativas.</p>
            
            <div className="mb-6 p-5 bg-[#050B14] rounded-2xl border border-[#6366F1]/30">
              <p className="text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Inversión Inicial (Hardware)</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-4xl font-extrabold text-white">$130</p>
                <p className="text-slate-500 pb-1 font-medium">USD <span className="text-xs ml-1">/ unidad</span></p>
              </div>
              <p className="text-xs text-slate-500">Incluye: Escáner Telemétrico OBD2 (JM-VL502), conectividad M2M y vinculación de API.</p>
            </div>

            <div className="mb-8">
              <p className="text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Suscripción Mensual (Software)</p>
              <div className="flex items-end gap-2">
                <p className="text-5xl font-extrabold text-[#6366F1]">$60</p>
                <p className="text-slate-500 pb-1 font-medium">/mes <span className="text-xs ml-1">por unidad</span></p>
              </div>
            </div>

            <hr className="border-slate-800 mb-8" />

            <ul className="text-slate-300 space-y-5 flex-1">
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Mantenimiento Predictivo Integral:</strong> Modelos de IA aplicados simultáneamente al diagnóstico del vehículo y al análisis del operador.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Datos Directos del Motor (ECU):</strong> Acceso en tiempo real a indicadores críticos de rendimiento mecánico.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Detección Temprana de Fallas:</strong> Intercepción de códigos de error (DTC) para la prevención de paradas operativas no planificadas.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Procesamiento y Notificación Inteligente:</strong> Generación de alertas contextuales y reportes consolidados mediante tecnología OpenAI.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Funcionalidad Completa:</strong> Incluye absolutamente todas las características operativas del Plan Básico.</div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 max-w-4xl mx-auto bg-gradient-to-r from-[#1E293B] to-[#0B1120] rounded-2xl border border-slate-700 p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366F1] blur-[100px] opacity-10 pointer-events-none"></div>
          
          <div className="text-center md:text-left z-10">
            <h4 className="text-2xl font-bold text-white mb-2">¿Gestiona una flota operativa de más de 10 unidades?</h4>
            <p className="text-slate-400">Desarrollamos propuestas comerciales a medida, estructurando descuentos por volumen aplicables tanto al hardware como a la suscripción corporativa.</p>
          </div>
          
          <button onClick={onOpenChat} className="shrink-0 z-10 flex items-center gap-3 px-8 py-4 bg-[#1E293B] hover:bg-[#2D3748] border border-[#6366F1]/50 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] group">
            <svg className="w-5 h-5 text-[#6366F1] group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            Cotización Asistida (IA)
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