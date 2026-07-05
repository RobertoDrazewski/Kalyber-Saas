import { useState, useMemo } from 'react';
import { ShoppingCart, Check, Send } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const PLANS = {
  basico: { label: 'Plan Básico', device: 'JM-VL04', monthly: 30, hardware: 110 },
  avanzado: { label: 'Plan Avanzado', device: 'JM-VL502', monthly: 60, hardware: 130 },
};

function calcDiscount(qty) {
  if (qty >= 50) return 20;
  if (qty >= 10) return 10;
  return 0;
}

export default function CartCalculator() {
  const [plan, setPlan] = useState('avanzado');
  const [qty, setQty] = useState(1);
  const [billing, setBilling] = useState({ name: '', taxId: '', email: '', phone: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [error, setError] = useState('');

  const discountPct = calcDiscount(qty);
  const info = PLANS[plan];
  const monthlyTotal = useMemo(() => (info.monthly * qty * (1 - discountPct / 100)), [info, qty, discountPct]);
  const hardwareTotal = useMemo(() => info.hardware * qty, [info, qty]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const response = await fetch(`${API_URL}/contact/cart-quote`, {
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
      if (!response.ok) throw new Error(data.error || 'Error al enviar la cotización');
      setStatus('success');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <section id="cart" className="py-24 px-6 bg-[#0B1120] border-t border-slate-800/50">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
          <ShoppingCart className="text-[#6366F1]" /> Armá tu plan
        </h2>
        <p className="text-slate-400">Elegí el plan y la cantidad de vehículos — el descuento se aplica automático.</p>
      </div>

      <div className="max-w-xl mx-auto bg-[#1E293B]/50 border border-slate-700 rounded-3xl p-8">
        {status === 'success' ? (
          <div className="text-center py-10">
            <Check className="mx-auto text-[#10B981] mb-3" size={40} />
            <p className="text-[#10B981] font-bold text-lg">¡Listo! Recibimos tu cotización.</p>
            <p className="text-slate-400 text-sm mt-2">
              Te vamos a contactar para coordinar el pago y activar tu suscripción.
            </p>
            <button type="button" onClick={() => setStatus('idle')} className="mt-4 text-sm text-[#6366F1] hover:underline">
              Armar otra cotización
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Selección de plan */}
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(PLANS).map(([key, p]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setPlan(key)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    plan === key ? 'border-[#6366F1] bg-[#6366F1]/10' : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <p className="text-white font-bold">{p.label}</p>
                  <p className="text-xs text-slate-400 mt-1">{p.device}</p>
                  <p className="text-[#6366F1] font-bold text-sm mt-2">${p.monthly}/mes</p>
                </button>
              ))}
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cantidad de vehículos</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-3 text-white"
              />
              {discountPct > 0 && (
                <p className="text-[#10B981] text-xs mt-1.5 font-semibold">
                  🎉 {discountPct}% de descuento por flota de {qty >= 50 ? '50+' : '10+'} vehículos
                </p>
              )}
            </div>

            {/* Resumen */}
            <div className="bg-[#0B1120] rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Hardware ({qty} x ${info.hardware})</span>
                <span className="text-white">${hardwareTotal.toFixed(2)} único pago</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Mantenimiento mensual</span>
                <span className="text-white">${monthlyTotal.toFixed(2)}/mes</span>
              </div>
            </div>

            {/* Datos de facturación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required placeholder="Nombre / Empresa" className="bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm" value={billing.name} onChange={e => setBilling({ ...billing, name: e.target.value })} />
              <input placeholder="CUIT / DNI" className="bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm" value={billing.taxId} onChange={e => setBilling({ ...billing, taxId: e.target.value })} />
              <input required type="email" placeholder="Email" className="bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm" value={billing.email} onChange={e => setBilling({ ...billing, email: e.target.value })} />
              <input placeholder="Teléfono" className="bg-[#0B1120] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm" value={billing.phone} onChange={e => setBilling({ ...billing, phone: e.target.value })} />
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm p-3 rounded-xl">{error}</div>}

            <button type="submit" disabled={status === 'sending'} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              <Send size={18} /> {status === 'sending' ? 'Enviando...' : 'Solicitar esta cotización'}
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Todavía no se cobra nada acá — te contactamos para coordinar el pago recurrente y activar el servicio.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
