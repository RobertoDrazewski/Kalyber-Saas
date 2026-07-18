import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Mail } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function QuoteChatWidget({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy el asistente de Kalyber 👋 ¿Cuántos vehículos tenés en tu flota y te ayudo a armar la cotización?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const [error, setError] = useState('');
  // [NUEVO 18/07/2026] Email del cliente, para el auto-reply de
  // confirmación — se lo pedimos acá en vez de depender de que lo haya
  // mencionado dentro de la charla (poco confiable). Solo se pide
  // cuando aprieta "Enviar Cotización", no desde el arranque, para no
  // interrumpir la conversación con la IA.
  const [askingEmail, setAskingEmail] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError('');
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/quote-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al consultar el asistente');

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuoteEmail = async () => {
    if (messages.length <= 1) {
      setError('Debes chatear primero antes de enviar la cotización.');
      return;
    }

    // Primer click: mostramos el campo de email en vez de mandar
    // directo — así el auto-reply de confirmación siempre tiene a
    // dónde llegar, sin depender de que el cliente lo haya escrito
    // dentro de la charla.
    if (!askingEmail && !clientEmail) {
      setAskingEmail(true);
      return;
    }
    if (!clientEmail.trim() || !clientEmail.includes('@')) {
      setError('Ingresá un email válido para que te confirmemos la recepción.');
      return;
    }

    setSendingQuote(true);
    setError('');
    setQuoteSuccess(false);

    try {
      const response = await fetch(`${API_URL}/quote-chat/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: messages.map(m => ({ role: m.role, content: m.content })),
          clientEmail: clientEmail.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo enviar la cotización.');
      }

      setQuoteSuccess(true);
      setAskingEmail(false);
      setTimeout(() => setQuoteSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingQuote(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 bg-black/50 sm:bg-transparent">
      <div className="w-full sm:w-96 h-[85vh] sm:h-[560px] bg-[#0B1120] border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#6366F1]/20 to-transparent shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#6366F1]/20 flex items-center justify-center text-[#6366F1]">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Cotizador Kalyber</p>
              <p className="text-[11px] text-slate-500">Asistente de planes</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Mensajes */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-[#6366F1] text-white rounded-br-sm'
                  : 'bg-[#1E293B] text-slate-200 rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#1E293B] text-slate-400 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm">
                Escribiendo...
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-xs p-2.5 rounded-xl">
              {error}
            </div>
          )}
          {quoteSuccess && (
            <div className="bg-[#10B981]/10 border border-[#10B981]/40 text-[#10B981] text-xs p-2.5 rounded-xl text-center">
              ¡Cotización enviada al equipo de ventas! Te confirmamos por mail que la recibimos.
            </div>
          )}
        </div>

        {/* Action Panel: Enviar por email */}
        <div className="px-3 pb-2 pt-2 border-t border-slate-800/50 bg-[#0B1120] shrink-0 space-y-2">
          {/* [NUEVO 18/07/2026] Pedimos el email ANTES de mandar, para
              poder confirmarle al cliente por mail que recibimos su
              consulta — no depende de que lo haya escrito dentro del
              chat. */}
          {askingEmail && (
            <div className="space-y-1.5">
              <input
                type="email"
                autoFocus
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="Tu email, para confirmarte la recepción"
                className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#6366F1]"
              />
            </div>
          )}
          <button 
            onClick={handleSendQuoteEmail}
            disabled={sendingQuote || messages.length <= 1}
            className="w-full flex items-center justify-center gap-2 bg-[#1E293B] hover:bg-[#2D3748] border border-slate-700 text-slate-300 hover:text-white py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Mail size={14} />
            {sendingQuote ? 'Enviando...' : askingEmail ? 'Confirmar y enviar' : 'Enviar Cotización a Ventas'}
          </button>
        </div>

        {/* Input */}
        <form onSubmit={send} className="p-3 bg-[#0B1120] flex gap-2 shrink-0">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribí tu consulta..."
            maxLength={500}
            className="flex-1 bg-[#1E293B] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-[#6366F1]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white p-2.5 rounded-xl disabled:opacity-40 shrink-0 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}