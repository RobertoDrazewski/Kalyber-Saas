const API_URL = 'http://localhost:3001/api';

export const fetchAPI = async (endpoint, options = {}) => {
  const token = localStorage.getItem('kyber_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('kyber_token');
      window.location.href = '/login';
    }
    throw new Error('Error en la petición a la API');
  }
  
  return response.json();
};