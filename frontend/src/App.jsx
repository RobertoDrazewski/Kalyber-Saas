import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DriverView from './pages/DriverView';

// Protector de Rutas — además de exigir token, valida el rol cuando
// la ruta lo requiere (para que un chofer no pueda entrar a /dashboard
// escribiendo la URL a mano, ni un admin quede atrapado en /driver).
const PrivateRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('kyber_token');
  if (!token) return <Navigate to="/login" />;

  if (allowedRoles) {
    const user = JSON.parse(localStorage.getItem('kyber_user') || '{}');
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to={user.role === 'driver' ? '/driver' : '/dashboard'} />;
    }
  }
  return children;
};

export default function App() {
  return (
    <Router>
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
      </Routes>
    </Router>
  );
}
