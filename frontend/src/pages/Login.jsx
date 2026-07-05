import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Misma convención que services/api.js: VITE_API_URL YA incluye el /api,
  // así que acá solo agregamos la ruta puntual (/auth/login), sin repetirlo.
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      // Si el backend (o un proxy/dominio mal configurado) devuelve HTML
      // en vez de JSON, esto lo detecta con un mensaje claro en vez de
      // reventar con "Unexpected token '<'".
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`La API respondió algo que no es JSON (revisá VITE_API_URL: ${API_URL}/auth/login)`);
      }

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Error al iniciar sesión');

      localStorage.setItem('kyber_token', data.token);
      localStorage.setItem('kyber_user', JSON.stringify(data.user));
      // Los choferes van a su vista reducida (mapa + elegir auto);
      // el resto va al dashboard completo.
      navigate(data.user.role === 'driver' ? '/driver' : '/dashboard');
      return;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050B14] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Fondo decorativo sutil */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#6366F1]/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-[#0B1120]/60 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-2xl relative z-10">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/kaliber-banner.png"
            alt="Kyber ML Logo"
            className="h-40 w-auto object-contain"
          />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white">Bienvenido</h2>
          <p className="text-slate-400 text-sm mt-2">Ingresá tus credenciales para acceder a la flota</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#050B14] border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all"
              placeholder="nombre@empresa.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#050B14] border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#6366F1]/20 flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Autenticando...' : 'Ingresar al Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
