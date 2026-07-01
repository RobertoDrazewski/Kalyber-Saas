import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      localStorage.setItem('kyber_token', data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#1E293B]/80 backdrop-blur-md p-8 rounded-2xl border border-slate-700 shadow-2xl">
        
        {/* Logo de Kyber Actualizado */}
        <div className="flex justify-center mb-8">
          <img 
            src="/kalyber.png" 
            alt="Logo Kyber" 
            className="h-50 w-auto object-contain drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          />
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-6">Iniciar Sesión en Kyber</h2>
        {error && <div className="bg-[#EF4444]/20 text-[#EF4444] p-3 rounded-lg mb-4 text-sm text-center">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Email Empresarial</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#6366F1]" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#6366F1]" required />
          </div>
          <button type="submit" className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3 rounded-lg transition-all mt-4">
            Ingresar al Panel
          </button>
        </form>

      </div>
    </div>
  );
}