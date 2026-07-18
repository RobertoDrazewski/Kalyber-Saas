import { useState, useMemo, useRef, useEffect } from 'react';
import { ShoppingCart, Check, Send, CreditCard, X } from 'lucide-react';

const CART_BTN_POS_KEY = 'kalyber_cart_btn_pos';
const BTN_SIZE = 64; // ancho/alto aprox del botón flotante (padding + icono), para no dejarlo salir de la pantalla
const DRAG_THRESHOLD = 4; // px de movimiento antes de considerarlo "arrastre" y no un click

function getDefaultBtnPos() {
  if (typeof window === 'undefined') return { x: 24, y: 24 };
  return { x: 24, y: window.innerHeight - BTN_SIZE - 24 }; // equivalente a bottom-6 left-6
}

function clampToViewport(x, y) {
  const maxX = window.innerWidth - BTN_SIZE;
  const maxY = window.innerHeight - BTN_SIZE;
  return { x: Math.min(Math.max(x, 0), maxX), y: Math.min(Math.max(y, 0), maxY) };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const PLANS = {
  basico: { label: 'Plan Básico', device: 'JM-VL04', monthly: 30, hardware: 110 },
  avanzado: { label: 'Plan Avanzado', device: 'JM-VL502', monthly: 60, hardware: 130 },
  // [NUEVO 18/07/2026] Kalyber Scanner — para talleres, no para flota.
  taller: { label: 'Plan Taller', device: 'Kalyber Scanner', monthly: 60, hardware: 350 },
};

function calcDiscount(qty) {
  if (qty >= 50) return 20;
  if (qty >= 10) return 10;
  return 0;
}

// Carrito flotante: antes era una sección fija en medio del Home,
// ahora es un botón flotante (como el del chat de cotización) que
// abre un panel donde se arma/edita el pedido antes de pagar.
export default function CartCalculator() {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState('avanzado');
  const [qty, setQty] = useState(1);
  const [billing, setBilling] = useState({ name: '', taxId: '', email: '', phone: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [error, setError] = useState('');
  const [initPoint, setInitPoint] = useState('');

  // Posición del botón flotante — se puede arrastrar con mouse o dedo.
  // Arranca en la esquina inferior izquierda (o donde el usuario lo
  // haya dejado la última vez, guardado en localStorage).
  const [btnPos, setBtnPos] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_BTN_POS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return getDefaultBtnPos();
  });
  const [dragging, setDragging] = useState(false);
  const btnRef = useRef(null);
  const dragInfo = useRef({ offsetX: 0, offsetY: 0, moved: false });

  // Si el usuario rota el celular o cambia el tamaño de la ventana,
  // reacomodamos el botón para que no quede fuera de la pantalla.
  useEffect(() => {
    const onResize = () => setBtnPos(pos => clampToViewport(pos.x, pos.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handlePointerDown = (e) => {
    const rect = btnRef.current.getBoundingClientRect();
    dragInfo.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
    };
    btnRef.current.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - (btnRef.current.getBoundingClientRect().left + dragInfo.current.offsetX);
    const dy = e.clientY - (btnRef.current.getBoundingClientRect().top + dragInfo.current.offsetY);
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      dragInfo.current.moved = true;
    }
    if (!dragInfo.current.moved) return;
    const newX = e.clientX - dragInfo.current.offsetX;
    const newY = e.clientY - dragInfo.current.offsetY;
    setBtnPos(clampToViewport(newX, newY));
  };

  const handlePointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    try {
      btnRef.current.releasePointerCapture(e.pointerId);
    } catch {}

    if (dragInfo.current.moved) {
      // Fue un arrastre: guardamos la nueva posición y NO abrimos el carrito.
      setBtnPos(pos => {
        try {
          localStorage.setItem(CART_BTN_POS_KEY, JSON.stringify(pos));
        } catch {}
        return pos;
      });
    } else {
      // No se movió: fue un click/tap normal, abrimos el carrito.
      setOpen(true);
    }
    dragInfo.current.moved = false;
  };

  const discountPct = calcDiscount(qty);
  const info = PLANS[plan];
  const monthlyTotal = useMemo(() => (info.monthly * qty * (1 - discountPct / 100)), [info, qty, discountPct]);
  const hardwareTotal = useMemo(() => info.hardware * qty, [info, qty]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const response = await fetch(`${API_URL}/payments/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          vehicleCount: qty,
          billingName: billing.name,
          billingTaxId: billing.taxId,
          billingEmail: billing.email,
          billingPhone: billing.phone,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al generar la orden de pago');
      if (data.init_point) setInitPoint(data.init_point);
      setStatus('success');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const resetAndClose = () => {
    setOpen(false);
    // no reseteamos plan/qty/billing al cerrar para que si vuelven a
    // abrir el carrito sigan viendo lo que ya habían cargado
  };

  return (
    <>
      {/* Botón flotante — arrancra abajo a la izquierda (para no pisar el
          botón de chat, que está a la derecha), pero se puede arrastrar
          con mouse o con el dedo a cualquier parte de la pantalla. La
          posición queda guardada para la próxima visita. */}
      {!open && (
        <button
          ref={btnRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ left: btnPos.x, top: btnPos.y, touchAction: 'none' }}
          className={`fixed z-40 bg-[#10B981] hover:bg-[#0d9668] text-white p-4 rounded-full shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center gap-2 select-none ${
            dragging ? 'cursor-grabbing scale-105' : 'cursor-grab transition-transform hover:scale-105'
          }`}
          aria-label="Armar tu plan (arrastrable)"
        >
          <ShoppingCart size={22} />
          {qty > 0 && status !== 'idle-empty' && (
            <span className="absolute -top-1 -right-1 bg-white text-[#10B981] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {qty}
            </span>
          )}
        </button>
      )}

      {/* Panel flotante */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start p-0 sm:p-6 bg-black/60 sm:bg-transparent">
          <div className="bg-[#0B1120] border border-slate-700 rounded-t-3xl sm:rounded-3xl w-full sm:w-[420px] max-h-[90vh] overflow-y-auto shadow-2xl sm:mb-6 sm:ml-0">
            <div className="sticky top-0 bg-[#0B1120] border-b border-slate-800 p-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingCart className="text-[#10B981]" size={20} /> Tu carrito
              </h2>
              <button onClick={resetAndClose} className="text-slate-400 hover:text-white">
                <X size={22} />
              </button>
            </div>

            <div className="p-5">
              {status === 'success' ? (
                <div className="text-center py-4 animate-fade-in">
                  <Check className="mx-auto text-[#10B981] mb-4" size={40} />
                  <h3 className="text-xl font-bold text-white mb-2">¡Orden generada!</h3>

                  <div className="bg-[#050B14] p-4 rounded-xl border border-slate-800 mb-5 text-left text-sm">
                    <ul className="text-slate-300 space-y-2 mb-3">
                      <li className="flex justify-between">
                        <span>{qty}x Hardware {info.device}</span>
                        <span className="font-bold text-white">${hardwareTotal.toFixed(2)}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Suscripción {info.label}</span>
                        <span className="font-bold text-[#6366F1]">${monthlyTotal.toFixed(2)}/mes</span>
                      </li>
                    </ul>
                    <div className="bg-[#10B981]/10 border border-[#10B981]/20 p-3 rounded-lg">
                      <p className="text-xs text-[#10B981] leading-relaxed">
                        Te vamos a mandar la factura y el comprobante por mail apenas se acredite el pago.
                      </p>
                    </div>
                  </div>

                  {initPoint ? (
                    <a
                      href={initPoint}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#009EE3] hover:bg-[#008ACB] text-white font-bold py-3.5 px-6 rounded-xl transition-all"
                    >
                      <CreditCard size={20} /> Pagar con Mercado Pago
                    </a>
                  ) : (
                    <button disabled className="w-full inline-flex items-center justify-center bg-slate-800 text-slate-400 font-bold py-3.5 px-6 rounded-xl cursor-wait">
                      Generando pasarela segura...
                    </button>
                  )}

                  <button type="button" onClick={() => setStatus('idle')} className="mt-4 text-sm text-slate-500 hover:text-white transition-colors">
                    Modificar cantidad o plan
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(PLANS).map(([key, p]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setPlan(key)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          plan === key ? 'border-[#6366F1] bg-[#6366F1]/10' : 'border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <p className="text-white font-bold text-xs leading-tight">{p.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{p.device}</p>
                        <p className="text-[#6366F1] font-bold text-[11px] mt-1">${p.monthly}/mes</p>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      {/* [NUEVO 18/07/2026] El Plan Taller no se cobra "por
                          vehículo" — un taller no tiene flota propia. Se
                          reusa el mismo campo de cantidad (por si un
                          taller con varias sucursales pide más de un
                          equipo), pero con la etiqueta correcta. */}
                      {plan === 'taller' ? 'Cantidad de equipos' : 'Cantidad de vehículos'}
                    </label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg bg-[#1E293B] text-white font-bold hover:bg-slate-700">−</button>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={qty}
                        onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2 text-white text-center focus:outline-none focus:border-[#6366F1]"
                      />
                      <button type="button" onClick={() => setQty(q => q + 1)} className="w-9 h-9 rounded-lg bg-[#1E293B] text-white font-bold hover:bg-slate-700">+</button>
                    </div>
                    {discountPct > 0 && (
                      <p className="text-[#10B981] text-xs mt-1.5 font-semibold">
                        🎉 {discountPct}% de descuento por {qty >= 50 ? '50+' : '10+'} {plan === 'taller' ? 'equipos' : 'vehículos'}
                      </p>
                    )}
                  </div>

                  <div className="bg-[#0B1120] rounded-xl p-3 space-y-1.5 text-sm border border-slate-800">
                    <div className="flex justify-between text-slate-400">
                      <span>Hardware ({qty} x ${info.hardware})</span>
                      <span className="text-white font-medium">${hardwareTotal.toFixed(2)} único pago</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Mantenimiento mensual</span>
                      <span className="text-[#6366F1] font-medium">${monthlyTotal.toFixed(2)}/mes</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <input required placeholder="Nombre / Empresa" className="bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366F1]" value={billing.name} onChange={e => setBilling({ ...billing, name: e.target.value })} />
                    <input placeholder="CUIT / DNI" className="bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366F1]" value={billing.taxId} onChange={e => setBilling({ ...billing, taxId: e.target.value })} />
                    <input required type="email" placeholder="Email" className="bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366F1]" value={billing.email} onChange={e => setBilling({ ...billing, email: e.target.value })} />
                    <input placeholder="Teléfono" className="bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#6366F1]" value={billing.phone} onChange={e => setBilling({ ...billing, phone: e.target.value })} />
                  </div>

                  {error && <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm p-3 rounded-xl">{error}</div>}

                  <button type="submit" disabled={status === 'sending'} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                    <Send size={18} /> {status === 'sending' ? 'Procesando...' : 'Generar orden de compra'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
