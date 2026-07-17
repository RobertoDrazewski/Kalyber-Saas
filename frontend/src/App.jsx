import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DriverView from './pages/DriverView';
import ScannerMechanicView from './pages/ScannerMechanicView';

// Protector de Rutas — además de exigir token, valida el rol cuando
// la ruta lo requiere. El fallback contempla los 3 roles con vista
// propia (driver/taller van a la suya, todo lo demás al dashboard).
const roleHome = { driver: '/driver', taller: '/scanner' };
const PrivateRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('kyber_token');
  if (!token) return <Navigate to="/login" />;

  if (allowedRoles) {
    const user = JSON.parse(localStorage.getItem('kyber_user') || '{}');
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to={roleHome[user.role] || '/dashboard'} />;
    }
  }
  return children;
};

export default function App() {
  // El widget de Google Translate se inicializa ACÁ, a nivel raíz,
  // en vez de adentro del Navbar. Motivo: el Navbar se desmonta al
  // navegar del Home al panel (son rutas distintas de React Router),
  // y si el <div id="google_translate_element"> vive adentro del
  // Navbar, se destruye con él — ahí es cuando el idioma elegido se
  // "olvidaba" al entrar al panel. Viviendo en App.jsx, que nunca se
  // desmonta, el widget sigue activo en toda la navegación y traduce
  // solo el contenido nuevo que va apareciendo (Dashboard, etc.) sin
  // que haga falta tocar nada por página.
  useEffect(() => {
    if (!document.getElementById('google-translate-script')) {
      const addScript = document.createElement('script');
      addScript.id = 'google-translate-script';
      addScript.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      addScript.async = true;
      document.body.appendChild(addScript);

      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'es', includedLanguages: 'es,en,pt,de,it,fr,ca', autoDisplay: false },
          'google_translate_element'
        );
      };
    }
  }, []);

  return (
    <Router>
      {/* Ocultamiento de la interfaz nativa de Google ahora vive en
          index.css (global) — así tapa la ventana en TODAS las
          páginas, no solo donde estaba montado el Navbar. */}
      <div id="google_translate_element"></div>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard/*"
          element={
            <PrivateRoute allowedRoles={['super_admin', 'admin']}>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/driver"
          element={
            <PrivateRoute allowedRoles={['driver']}>
              <DriverView />
            </PrivateRoute>
          }
        />
        {/* Vista del mecánico (producto Kalyber Scanner) — rol propio 'taller'. */}
        <Route
          path="/scanner"
          element={
            <PrivateRoute allowedRoles={['super_admin', 'taller']}>
              <ScannerMechanicView />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}
