import { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Footer from '../components/Footer';
import QuoteChatWidget from '../components/QuoteChatWidget';
import CartCalculator from '../components/CartCalculator';

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
            Un rastreador estándar solo proporciona coordenadas a un servidor genérico. <strong className="text-white">Kalyber procesa la telemetría en infraestructura propia, evalúa los patrones de conducción y blinda su información logística.</strong> Experimente el verdadero control de flotas.
          </p>
        </div>

        {/* Grilla perfecta de 3x2 con las 6 tarjetas */}
        <div className="grid md:grid-cols-3 gap-8 ">
          
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
              Eventos de manejo reales con hora y ubicación exacta — colisión, frenada y aceleración brusca ya llegan al panel <strong className="text-slate-300">desde el Plan Básico</strong>. Con el <strong className="text-slate-300">Plan Avanzado</strong> se suma la lectura directa de la ECU: giros cerrados, exceso de velocidad cruzado con datos de motor, y el score de conducción más preciso del mercado.
            </p>
          </div>

          {/* Tarjeta 4: Infraestructura Propietaria y API */}
          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#6366F1]/50 transition-all hover:-translate-y-1 shadow-lg">
            <div className="w-12 h-12 bg-[#6366F1]/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-[#6366F1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Ecosistema 100% Propietario y API REST</h3>
            <p className="text-slate-400 leading-relaxed">
              No revendemos software enlatado ni dependemos de servidores compartidos en el extranjero. Al ser dueños de nuestra arquitectura de sockets, le ofrecemos una <strong className="text-slate-300">API RESTful abierta</strong> para integrar la telemetría directamente con su software ERP (SAP, Odoo).
            </p>
          </div>

          {/* Tarjeta 5: El Sello de Ciberseguridad */}
          <div className="bg-gradient-to-br from-[#1E293B]/80 to-[#0F172A] p-8 rounded-3xl border border-[#10B981]/30 hover:border-[#10B981] transition-all hover:-translate-y-1 shadow-[0_0_15px_rgba(16,185,129,0.1)] relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-[#10B981]/20 text-[#10B981] text-xs font-bold px-3 py-1 rounded-full border border-[#10B981]/50">
              Auditoría Enterprise
            </div>
            
            <div className="w-12 h-12 bg-[#10B981]/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Datos Blindados de Ciberseguridad</h3>
            <p className="text-slate-400 leading-relaxed mb-4">
              La filtración de rutas y operaciones logísticas es un riesgo real. Nuestra plataforma está sometida a pruebas activas de vulnerabilidades y monitoreo continuo por expertos para garantizar que <strong className="text-white">la información de su flota esté protegida bajo estándares de seguridad auditados.</strong>
            </p>
          </div>

          {/* Tarjeta 6: Business Intelligence & Ventas */}
          <div className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 hover:border-[#A855F7]/50 transition-all hover:-translate-y-1 shadow-lg">
            <div className="w-12 h-12 bg-[#A855F7]/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-[#A855F7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Business Intelligence y ROI</h3>
            <p className="text-slate-400 leading-relaxed">
              Convierta la información técnica en decisiones financieras. Genere reportes gerenciales automatizados que exponen la <strong className="text-slate-300">reducción de costos operativos y el ahorro real de combustible</strong>, permitiendo visualizar el Retorno de Inversión (ROI) instantáneo.
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
        
        <div className="grid md:grid-cols-3 gap-8 w-full mb-12 text-left ">
          
          {/* Hardware Básico */}
          <div className="bg-gradient-to-b from-slate-700/20 to-[#1E293B]/40 rounded-3xl border border-slate-700 overflow-hidden flex flex-col relative shadow-xl shadow-black/10 transform hover:-translate-y-2 transition-transform duration-300 h-full">
            <div className="p-5 md:p-8 pb-0 flex justify-center items-center h-36 md:h-56 bg-gradient-to-b from-transparent to-[#0B1120]/50 relative">
              <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10 bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border border-slate-600">
                Suscripción Básica
              </div>
              <img src="/Jimi_Vl04l.png" alt="Hardware Básico" className="h-24 md:h-48 w-auto object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-5 md:p-8 pt-4 md:pt-6 flex-1 flex flex-col">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-1">Rastreador Inercial 4G</h3>
              <p className="text-xs md:text-sm font-semibold text-[#10B981] mb-4 md:mb-6 uppercase tracking-widest">Kalyber Tracking Core</p>
              
              <ul className="space-y-3 md:space-y-4 text-slate-300 text-sm flex-1">
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
                  <div><strong className="text-white">Posición y Velocidad en Tiempo Real:</strong> GPS continuo con histórico de recorridos, visible en el panel web.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Odómetro de Precisión:</strong> Kilometraje medido por el propio equipo (no una estimación por GPS), con resolución de metro.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#10B981] font-bold">✓</span>
                  <div><strong className="text-white">Eventos de Manejo en el Panel:</strong> Colisión, corte de energía y desconexión física llegan en vivo al panel del administrador — no es solo un aviso sonoro en cabina.</div>
                </li>
              </ul>
            </div>
          </div>

          {/* Hardware Avanzado */}
          <div className="bg-gradient-to-b from-[#6366F1]/10 to-[#1E293B]/40 rounded-3xl border border-[#6366F1]/50 overflow-hidden flex flex-col relative shadow-xl shadow-[#6366F1]/10 transform hover:-translate-y-2 transition-transform duration-300 h-full">
            <div className="p-5 md:p-8 pb-0 flex justify-center items-center h-36 md:h-56 bg-gradient-to-b from-transparent to-[#0B1120]/50 relative">
              <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10 bg-[#6366F1] text-white px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#6366F1]/40">
                Suscripción Avanzada
              </div>
              <img src="/Kalyber_OBD_Pro.png" alt="Hardware Avanzado" className="h-24 md:h-48 w-auto object-contain drop-shadow-[0_10px_20px_rgba(99,102,241,0.3)] transform hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-5 md:p-8 pt-4 md:pt-6 flex-1 flex flex-col">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-1">Escáner Telemétrico OBD2</h3>
              <p className="text-xs md:text-sm font-semibold text-[#6366F1] mb-4 md:mb-6 uppercase tracking-widest">Kalyber OBD-Telemetry Engine</p>
              
              <ul className="space-y-3 md:space-y-4 text-slate-300 text-sm flex-1">
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Lectura Directa de ECU:</strong> RPM, temperatura de motor, presión y vida útil de aceite, combustible y voltaje de batería en tiempo real.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Diagnóstico de Errores (DTC):</strong> Compatibilidad con protocolos K-Line y CAN Bus para la identificación de fallas mecánicas.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Eventos de Manejo con Ubicación:</strong> Frenadas y aceleraciones bruscas, giros cerrados, colisiones y exceso de velocidad, cada uno con hora y GPS exacto — no un puntaje estimado, el evento real.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#6366F1] font-bold">✓</span>
                  <div><strong className="text-white">Estado Completo del Vehículo:</strong> Puertas, luces, cinturones de seguridad y freno de mano, visibles en vivo en el panel.</div>
                </li>
              </ul>
            </div>
          </div>

          {/* [ACTUALIZADO 31/07/2026] Kalyber Scanner — el hardware ya
              está listo en versión beta (KAL-SCAN-0001, Demo v1.0).
              Se saca el badge "Próximamente" y el ícono placeholder,
              entra la foto real del producto. */}
          <div className="bg-gradient-to-b from-[#EC4899]/10 to-[#1E293B]/40 rounded-3xl border border-[#EC4899]/50 overflow-hidden flex flex-col relative shadow-xl shadow-[#EC4899]/10 transform hover:-translate-y-2 transition-transform duration-300 h-full">
            <div className="p-5 md:p-8 pb-0 flex justify-center items-center h-36 md:h-56 bg-gradient-to-b from-transparent to-[#0B1120]/50 relative">
              <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10 bg-[#EC4899] text-white px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#EC4899]/40">
                Plan Taller
              </div>
              {/* [NUEVO 31/07/2026] Reemplaza al viejo badge ámbar de
                  "Próximamente" — el hardware ya está en versión beta,
                  disponible para probar. */}
              <div className="absolute top-3 right-3 md:top-4 md:right-4 z-10 bg-emerald-500 text-[#0B1120] px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/40">
                ✅ 30 días gratis
              </div>
              <img src="/scannerpro.png" alt="Kalyber Scanner" className="h-24 md:h-48 w-auto object-contain drop-shadow-[0_10px_20px_rgba(236,72,153,0.3)] transform hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-5 md:p-8 pt-4 md:pt-6 flex-1 flex flex-col">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-1">Kalyber Scanner</h3>
              <p className="text-xs md:text-sm font-semibold text-[#EC4899] mb-2 uppercase tracking-widest">Diagnóstico OBD-II para Talleres</p>
              <p className="text-[11px] md:text-xs text-emerald-400/90 mb-4 md:mb-6">Hardware listo en versión beta — pruébelo 30 días gratis en su taller, sin cargo.</p>

              <ul className="space-y-3 md:space-y-4 text-slate-300 text-sm flex-1">
                <li className="flex items-start gap-3">
                  <span className="text-[#EC4899] font-bold">✓</span>
                  <div><strong className="text-white">Diagnóstico en Vivo:</strong> Conecte el scanner al auto y vea los códigos de falla (DTC) aparecer en tiempo real, desde el celular o la computadora del taller.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#EC4899] font-bold">✓</span>
                  <div><strong className="text-white">Historial de Clientes:</strong> Cada auto que pasa por el taller queda registrado, con su historial de diagnósticos anteriores.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#EC4899] font-bold">✓</span>
                  <div><strong className="text-white">Conectividad WiFi Propia:</strong> Sin depender del WiFi del taller para funcionar — se conecta directo a la red del local una sola vez.</div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#EC4899] font-bold">✓</span>
                  <div><strong className="text-white">Un Equipo, Autos Ilimitados:</strong> Sin límite de vehículos escaneados por mes — pago único de hardware, suscripción mensual por taller.</div>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Accesorios: Cable y Chip M2M */}
        <div className="grid md:grid-cols-2 gap-8 w-full mb-12 text-left ">
          
          {/* Bloque Cable Extensor */}
          <div className="bg-gradient-to-r from-[#1E293B] to-[#0B1120] p-6 rounded-2xl border border-slate-700 flex flex-col xl:flex-row items-center gap-6 shadow-lg overflow-hidden relative hover:border-slate-500 transition-colors">
            <div className="w-32 h-32 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-300 relative z-10 p-4 shadow-inner">
              <img 
                src="/cable-extensor.png" 
                alt="Cable Extensor OBD2" 
                className="w-full h-full object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.3)]" 
              />
            </div>
            <div className="flex-1 relative z-10 text-center xl:text-left">
              <h4 className="text-white font-bold text-xl mb-2">Solución Oculta (Cable)</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Si el puerto OBD2 presenta problemas de espacio o riesgo de impacto accidental, disponemos de un cable extensor plano por <strong className="text-white">$20 USD adicionales</strong>. Facilita el montaje interno garantizando estética y seguridad.
              </p>
            </div>
          </div>

          {/* Bloque Chip M2M */}
          <div className="bg-gradient-to-r from-[#1E293B] to-[#0B1120] p-6 rounded-2xl border border-slate-700 flex flex-col xl:flex-row items-center gap-6 shadow-lg overflow-hidden relative hover:border-[#6366F1]/50 transition-colors">
            <div className="w-32 h-32 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-300 relative z-10 p-4 shadow-inner">
              <img 
                src="/m2m.png" 
                alt="Chip Telemetría M2M" 
                className="w-full h-full object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.3)]" 
              />
            </div>
            <div className="flex-1 relative z-10 text-center xl:text-left">
              <h4 className="text-white font-bold text-xl mb-2">Conectividad M2M Ininterrumpida</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Incluimos tecnología de red de misión crítica. Nuestro chip M2M Multi-Carrier conmuta automáticamente entre <strong className="text-white">3 redes móviles</strong> para evitar puntos ciegos en su operación.
              </p>
            </div>
          </div>

        </div>

        {/* Resumen de Conectividad (Bloque PRO) */}
        <div className="bg-[#1E293B]/40 rounded-3xl border border-slate-700 p-8 shadow-lg relative overflow-hidden mb-12">
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-[#6366F1] blur-[120px] opacity-10 pointer-events-none"></div>
          
          <div className="text-center mb-10 relative z-10">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Conectividad M2M Ininterrumpida</h3>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Equipamos su flota con tecnología de red de misión crítica para garantizar la transmisión de telemetría sin puntos ciegos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 ">
            <div className="bg-[#050B14] p-6 rounded-2xl border border-slate-800 text-center flex flex-col items-center shadow-md hover:border-[#6366F1]/50 transition-colors">
              <div className="w-14 h-14 bg-[#6366F1]/10 text-[#6366F1] rounded-full flex items-center justify-center mb-4">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
                </svg>
              </div>
              <h4 className="text-white font-bold text-lg mb-1">3 Redes en 1 SIM</h4>
              <p className="text-xs text-[#6366F1] font-bold uppercase tracking-wide">Multi-Carrier</p>
            </div>

            <div className="bg-[#050B14] p-6 rounded-2xl border border-slate-800 text-center flex flex-col items-center shadow-md hover:border-[#10B981]/50 transition-colors">
              <div className="w-14 h-14 bg-[#10B981]/10 text-[#10B981] rounded-full flex items-center justify-center mb-4">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                </svg>
              </div>
              <h4 className="text-white font-bold text-lg mb-1">Conmutación</h4>
              <p className="text-xs text-[#10B981] font-bold uppercase tracking-wide">Automática</p>
            </div>

            <div className="bg-[#050B14] p-6 rounded-2xl border border-slate-800 text-center flex flex-col items-center shadow-md hover:border-[#F59E0B]/50 transition-colors">
              <div className="w-14 h-14 bg-[#F59E0B]/10 text-[#F59E0B] rounded-full flex items-center justify-center mb-4">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h4 className="text-white font-bold text-lg mb-1">Operación 24/7</h4>
              <p className="text-xs text-[#F59E0B] font-bold uppercase tracking-wide">Monitoreo Continuo</p>
            </div>

            <div className="bg-[#050B14] p-6 rounded-2xl border border-slate-800 text-center flex flex-col items-center shadow-md hover:border-[#EF4444]/50 transition-colors">
              <div className="w-14 h-14 bg-[#EF4444]/10 text-[#EF4444] rounded-full flex items-center justify-center mb-4">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                </svg>
              </div>
              <h4 className="text-white font-bold text-lg mb-1">SIM 100%</h4>
              <p className="text-xs text-[#EF4444] font-bold uppercase tracking-wide">Bonificadas</p>
            </div>
          </div>
        </div>

        {/* NUEVO BLOQUE: Video de Instalación Plug & Play */}
        <div className="bg-gradient-to-b from-[#1E293B]/60 to-[#0B1120] rounded-3xl border border-slate-700 p-8 md:p-12 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[#10B981] blur-[150px] opacity-10 pointer-events-none"></div>

          <div className="mb-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] mb-6">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
              <span className="text-xs font-bold tracking-widest uppercase">100% Plug & Play</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">No requiere instalación</h3>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Olvídese de los mecánicos, los cables cortados y el lucro cesante. Conecte el dispositivo en segundos y proteja la garantía original de su vehículo.
            </p>
          </div>

          <div className="relative z-10 max-w-4xl mx-auto rounded-2xl overflow-hidden border border-slate-700 shadow-[0_0_30px_rgba(0,0,0,0.5)] bg-black">
            <video 
              className="w-full h-auto object-cover"
              controls
              autoPlay
              muted
              loop
              playsInline
            >
              <source src="/como-funciona.mp4" type="video/mp4" />
              Tu navegador no soporta la reproducción de videos.
            </video>
          </div>
        </div>

      </div>
    </section>
  );
}

// Subcomponente: Pricing
function Pricing() {
  return (
    <section id="pricing" className="pt-24 pb-12 bg-[#0B1120] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Estructura de Suscripciones Corporativas</h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Prevenga incidentes mecánicos severos con una inversión inicial mínima. Adquiera el hardware en propiedad mediante un pago único y acceda a la plataforma Kalyber a través de una suscripción recurrente.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 w-full ">
          
          <div className="bg-gradient-to-b from-slate-700/20 to-[#1E293B]/40 p-8 rounded-3xl border border-slate-700 flex flex-col shadow-2xl shadow-black/10 hover:brightness-110 transition-all">
            <h3 className="text-2xl font-bold text-white mb-2">Plan Básico</h3>
            <p className="text-slate-400 mb-5 md:mb-8 min-h-[3rem] md:min-h-[4.5rem] text-sm md:text-base">Rastreo satelital, odómetro real y eventos de manejo en vivo — colisión, corte de energía y frenada/aceleración brusca, sin datos de motor.</p>
            
            <div className="mb-4 md:mb-6 p-4 md:p-5 bg-[#050B14] rounded-2xl border border-slate-800">
              <p className="text-xs md:text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Inversión Inicial (Hardware)</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-3xl md:text-4xl font-extrabold text-white">$110</p>
                <p className="text-slate-500 pb-1 font-medium">USD <span className="text-xs ml-1">/ unidad</span></p>
              </div>
              <p className="text-xs text-slate-500">Incluye: Hardware Rastreador Inercial (JM-VL04), conectividad M2M y parametrización.</p>
            </div>

            <div className="mb-5 md:mb-8">
              <p className="text-xs md:text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Suscripción Mensual (Software)</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl md:text-5xl font-extrabold text-white">$30</p>
                <p className="text-slate-500 pb-1 font-medium">/mes <span className="text-xs ml-1">por unidad</span></p>
              </div>
            </div>

            <hr className="border-slate-800 mb-5 md:mb-8" />

            <ul className="text-slate-300 space-y-3.5 md:space-y-5 flex-1 text-sm md:text-base">
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Soberanía de Datos (Zero Third-Parties):</strong> Su información se procesa en infraestructura privada. Sin intermediarios ni licencias genéricas. Usted es el dueño absoluto de su información.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Rastreo Satelital Continuo:</strong> Posicionamiento global en tiempo real con registro histórico de recorridos.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Odómetro de Precisión del Equipo:</strong> Kilometraje real medido por el propio dispositivo, no una estimación por GPS — resolución de metro.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Gestión de Perímetros (Geocercas) por GPS:</strong> El cruce de entrada/salida se calcula en nuestra infraestructura a partir de la posición real — funciona igual en los dos modelos de hardware, sin depender de que el equipo la detecte por su cuenta.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Eventos de Manejo en Vivo:</strong> Colisión, corte de energía y desconexión física llegan al panel en tiempo real, con hora y ubicación — no es solo un aviso sonoro en cabina.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#10B981] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Upgrade sin cambiar de plataforma:</strong> Si más adelante necesita datos de motor, migra al Plan Avanzado sin perder su historial de recorridos.</div>
              </li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-b from-[#6366F1]/10 to-[#1E293B]/40 p-8 rounded-3xl border border-[#6366F1]/50 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-[#6366F1]/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#6366F1] text-white px-5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase shadow-lg shadow-[#6366F1]/40">
              Integración IA Avanzada
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Plan Avanzado</h3>
            <p className="text-slate-400 mb-5 md:mb-8 min-h-[3rem] md:min-h-[4.5rem] text-sm md:text-base">Solución integral de diagnóstico predictivo y telemetría para la gestión proactiva de flotas corporativas.</p>
            
            <div className="mb-4 md:mb-6 p-4 md:p-5 bg-[#050B14] rounded-2xl border border-[#6366F1]/30">
              <p className="text-xs md:text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Inversión Inicial (Hardware)</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-3xl md:text-4xl font-extrabold text-white">$130</p>
                <p className="text-slate-500 pb-1 font-medium">USD <span className="text-xs ml-1">/ unidad</span></p>
              </div>
              <p className="text-xs text-slate-500">Incluye: Escáner Telemétrico OBD2 (JM-VL502), conectividad M2M y vinculación de API.</p>
            </div>

            <div className="mb-5 md:mb-8">
              <p className="text-xs md:text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Suscripción Mensual (Software)</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl md:text-5xl font-extrabold text-[#6366F1]">$60</p>
                <p className="text-slate-500 pb-1 font-medium">/mes <span className="text-xs ml-1">por unidad</span></p>
              </div>
            </div>

            <hr className="border-slate-800 mb-5 md:mb-8" />

            <ul className="text-slate-300 space-y-3.5 md:space-y-5 flex-1 text-sm md:text-base">
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Mantenimiento Predictivo Integral:</strong> Heurísticas de desgaste (frenos, neumáticos) combinadas con eventos de manejo reales reportados por el propio equipo — no una estimación, el dato real de la ECU.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Datos Directos del Motor (ECU):</strong> Acceso en tiempo real a indicadores críticos de rendimiento mecánico.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Detección Temprana de Fallas:</strong> Leemos y registramos en tiempo real los códigos de diagnóstico (DTC) que reporta la computadora del vehículo, para que puedas anticiparte a una falla antes de que se convierta en una rotura mayor.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Acceso por API para Integraciones:</strong> El administrador de flota puede generar sus propias API Keys para conectar Kalyber con su ERP u otro software, sin depender de nosotros para cada integración.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Gestión de Perímetros (Geocercas) por GPS:</strong> Misma tecnología de cruce por GPS del Plan Básico, incluida sin cargo extra.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#6366F1] mt-0.5 font-bold">✓</span> 
                <div><strong className="text-white font-semibold">Funcionalidad Completa de Plataforma:</strong> Incluye todas las capacidades de software del Plan Básico (Soberanía de Datos, geocercas, score de manejo). Único punto a aclarar: el aviso sonoro en cabina es una capacidad física del hardware VL04 — el escáner VL502 no tiene buzzer local, reporta sus eventos por red igual que todo lo demás.</div>
              </li>
            </ul>
          </div>

          {/* [ACTUALIZADO 31/07/2026] Kalyber Scanner — hardware ya
              disponible en versión beta, se saca el badge de
              "Próximamente" y se suma la promo de prueba gratuita. */}
          <div className="bg-gradient-to-b from-[#EC4899]/10 to-[#1E293B]/40 p-8 rounded-3xl border border-[#EC4899]/50 flex flex-col shadow-2xl shadow-[#EC4899]/10 hover:brightness-110 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-fit text-[10px] font-bold tracking-widest uppercase text-[#EC4899] bg-[#EC4899]/10 px-3 py-1 rounded-full">
                Nuevo — Para Talleres
              </span>
              <span className="inline-block w-fit text-[10px] font-bold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                ✅ 30 días gratis
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Plan Taller</h3>
            <p className="text-slate-400 mb-5 md:mb-8 min-h-[3rem] md:min-h-[4.5rem] text-sm md:text-base">Diagnóstico OBD-II en vivo, códigos de falla (DTC) e historial completo de cada vehículo que pasa por su taller.</p>

            {/* [NUEVO 31/07/2026] Promo de lanzamiento — 30 días de
                prueba sin cargo antes de que arranque la suscripción. */}
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
              <p className="text-emerald-400 text-xs md:text-sm font-semibold">✅ Pruébelo 30 días gratis en su taller, sin cargo y sin compromiso, antes de decidir.</p>
            </div>

            <div className="mb-4 md:mb-6 p-4 md:p-5 bg-[#050B14] rounded-2xl border border-[#EC4899]/30">
              <p className="text-xs md:text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Inversión Inicial (Hardware)</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-3xl md:text-4xl font-extrabold text-white">$350</p>
                <p className="text-slate-500 pb-1 font-medium">USD <span className="text-xs ml-1">pago único</span></p>
              </div>
              <p className="text-xs text-slate-500">Incluye: Kalyber Scanner (equipo OBD-II con conectividad WiFi propia), conector OBD-II, y puesta en marcha.</p>
            </div>

            <div className="mb-5 md:mb-8">
              <p className="text-xs md:text-sm text-slate-400 mb-2 uppercase tracking-wide font-semibold">Suscripción Mensual (Software)</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl md:text-5xl font-extrabold text-[#EC4899]">$60</p>
                <p className="text-slate-500 pb-1 font-medium">/mes <span className="text-xs ml-1">por taller</span></p>
              </div>
            </div>

            <hr className="border-slate-800 mb-5 md:mb-8" />

            <ul className="text-slate-300 space-y-3.5 md:space-y-5 flex-1 text-sm md:text-base">
              <li className="flex items-start gap-3">
                <span className="text-[#EC4899] mt-0.5 font-bold">✓</span>
                <div><strong className="text-white font-semibold">Diagnóstico en Vivo:</strong> Conecte el scanner al auto y vea los códigos de falla (DTC) aparecer en tiempo real desde su celular o computadora.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#EC4899] mt-0.5 font-bold">✓</span>
                <div><strong className="text-white font-semibold">Historial de Clientes:</strong> Cada auto que pasa por su taller queda registrado — vuelva a consultar diagnósticos anteriores sin depender de papeles.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#EC4899] mt-0.5 font-bold">✓</span>
                <div><strong className="text-white font-semibold">Alta por Vehículo con Foto:</strong> Registre cada auto con foto de patente, marca, modelo y VIN antes de escanearlo.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#EC4899] mt-0.5 font-bold">✓</span>
                <div><strong className="text-white font-semibold">Un equipo, autos ilimitados:</strong> Sin límite de vehículos escaneados por mes — la suscripción es por taller, no por auto.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#EC4899] mt-0.5 font-bold">✓</span>
                <div><strong className="text-white font-semibold">Confirmación de Diagnóstico:</strong> Confirme o corrija cada falla detectada después de revisar el auto — su taller construye su propio historial verificado, no solo códigos sin contexto.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#EC4899] mt-0.5 font-bold">✓</span>
                <div><strong className="text-white font-semibold">Reporte PDF para su Cliente:</strong> Genere un informe profesional de diagnóstico, listo para entregarle al dueño del vehículo — con los códigos detectados y su confirmación.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#EC4899] mt-0.5 font-bold">✓</span>
                <div><strong className="text-white font-semibold">"Este Auto Ya Estuvo Acá":</strong> Aviso automático al cargar una patente repetida, con su historial completo — nunca pierda de vista si una falla ya se había presentado antes.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#EC4899] mt-0.5 font-bold">✓</span>
                <div><strong className="text-white font-semibold">Estadísticas de su Taller:</strong> Qué marcas y qué fallas se repiten más en sus clientes — para saber qué repuestos conviene tener siempre a mano.</div>
              </li>
            </ul>
          </div>

        </div>

      </div>
    </section>
  );
}

function FeatureItem({ text }) {
  return (
    <div className="flex items-center gap-4 bg-[#0B1120]/50 p-4 rounded-xl border border-slate-800">
      <div className="w-8 h-8 rounded-full bg-[#10B981]/20 flex items-center justify-center text-[#10B981]">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
      </div>
      <span className="text-slate-200 font-medium">{text}</span>
    </div>
  );
}

// Subcomponente: Banner Corporativo (+50 flotas) - Tono Profesional Neutro
function CorporateBanner({ onOpenContact }) {
  return (
    <section className="pb-24 pt-12 bg-[#0B1120] px-6 lg:px-8">
      <div className="max-w-5xl mx-auto bg-gradient-to-br from-[#1E293B] to-[#0B1120] border border-slate-700 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
        
        {/* Efecto de luz decorativo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366F1] blur-[120px] opacity-10 pointer-events-none"></div>

        <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
              ¿Cuenta con una flota de más de 50 dispositivos?
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              Acceda a nuestro programa exclusivo para integradores y grandes flotas. Optimizamos su rentabilidad y escalabilidad técnica desde el primer día.
            </p>
            <button 
              onClick={onOpenContact}
              className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-4 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
              Consultar programa corporativo
            </button>
          </div>

          <div className="space-y-4">
            <FeatureItem text="Escala de precios mayorista por volumen" />
            <FeatureItem text="API RESTful propia (Zero Third-Parties) para integración bidireccional con SAP, Odoo o su ERP actual." />
            <FeatureItem text="Soporte técnico dedicado nivel ingeniería" />
            <FeatureItem text="Opciones de IP fija y VPN privada" />
          </div>
        </div>
      </div>
    </section>
  );
}

// Subcomponente: Contacto
function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState({ type: '', msg: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', msg: 'Enviando mensaje...' });
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if(res.ok) {
        setStatus({ type: 'success', msg: 'Mensaje enviado con éxito. Te contactaremos a la brevedad.' });
        setFormData({ name: '', email: '', message: '' });
      } else {
        setStatus({ type: 'error', msg: 'Hubo un error al enviar el mensaje. Intenta nuevamente.' });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: 'Error de red. Verifica tu conexión.' });
    }
  };

  return (
    <section id="contacto" className="py-24 bg-[#0B1120] border-t border-slate-800/50 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Contáctenos</h2>
          <p className="text-lg text-slate-400">Envíenos un mensaje y nuestro equipo se comunicará para brindarle soporte o asesoramiento comercial.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-[#1E293B]/40 p-8 rounded-3xl border border-slate-800 shadow-xl">
          <div className="mb-6">
            <label className="block text-slate-300 text-sm font-bold mb-2" htmlFor="name">Nombre / Empresa</label>
            <input 
              id="name" type="text" required 
              value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} 
              className="w-full bg-[#050B14] text-white border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-[#6366F1] transition-colors" 
              placeholder="Su nombre o razón social" 
            />
          </div>
          <div className="mb-6">
            <label className="block text-slate-300 text-sm font-bold mb-2" htmlFor="email">Correo Electrónico</label>
            <input 
              id="email" type="email" required 
              value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} 
              className="w-full bg-[#050B14] text-white border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-[#6366F1] transition-colors" 
              placeholder="su@email.com" 
            />
          </div>
          <div className="mb-6">
            <label className="block text-slate-300 text-sm font-bold mb-2" htmlFor="message">Mensaje</label>
            <textarea 
              id="message" required rows="4" 
              value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} 
              className="w-full bg-[#050B14] text-white border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-[#6366F1] transition-colors" 
              placeholder="¿En qué podemos ayudarle?"
            ></textarea>
          </div>
          <button 
            type="submit" 
            disabled={status.type === 'loading'}
            className="w-full bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] disabled:opacity-70"
          >
            {status.type === 'loading' ? 'Enviando...' : 'Enviar Mensaje'}
          </button>
          
          {status.msg && (
            <div className={`mt-6 p-4 rounded-xl text-center text-sm font-semibold border ${status.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              {status.msg}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

// Componente Principal
export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);

  const scrollToContact = () => {
    document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-white selection:bg-[#6366F1] selection:text-white font-sans flex flex-col scroll-smooth">
      <Navbar />

      <main className="flex-grow">
        {/* Aquí pasamos las funciones a los botones del Hero */}
        <Hero onOpenChat={() => setChatOpen(true)} onOpenContact={scrollToContact} />
        <Features />
        <Hardware />
        <Pricing />
        <CorporateBanner onOpenContact={scrollToContact} />
        <Contact />
      </main>

      <Footer />

      {/* Carrito flotante — se maneja solo (botón + panel), no ocupa lugar en el flujo */}
      <CartCalculator />

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