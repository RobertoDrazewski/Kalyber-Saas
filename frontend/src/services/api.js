// En dev, si no seteás VITE_API_URL, cae a localhost (sirve para probar
// en la PC). Para probar desde el celular en la misma red WiFi, o para
// producción en Railway, hay que setear VITE_API_URL explícitamente
// (ver .env.example).
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const fetchAPI = async (endpoint, options = {}) => {
  const token = localStorage.getItem('kyber_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  } catch (err) {
    // Fetch falla acá cuando el backend es inalcanzable (URL mal
    // configurada, backend caído, o CORS). Lo tiramos como error
    // legible en vez de dejar que se pierda en silencio.
    throw new Error(`No se pudo conectar a la API (${API_URL}). ¿Está corriendo el backend y es alcanzable desde este dispositivo?`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('kyber_token');
      window.location.href = '/login';
    }
    let detail = '';
    try {
      const body = await response.json();
      detail = body.error || '';
    } catch {
      // la respuesta no era JSON (ej. un 404/502 en HTML) — no hay detail, no pasa nada
    }
    throw new Error(`${response.status} en ${endpoint}${detail ? ' — ' + detail : ''}`);
  }

  return response.json();
};
