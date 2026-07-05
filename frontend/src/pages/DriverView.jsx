import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { LogOut, Car, CheckCircle2 } from 'lucide-react';
import { fetchAPI } from '../services/api';
import ErrorBanner from '../components/ErrorBanner';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=200&q=60';

function vehicleIcon(photoUrl, isMine) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:44px;height:44px;border-radius:9999px;
      border:3px solid ${isMine ? '#10B981' : '#334155'};
      box-shadow:0 0 12px rgba(0,0,0,0.5);
      background:#0B1120 url('${photoUrl || FALLBACK_PHOTO}') center/cover no-repeat;
    "></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export default function DriverView() {
  const [vehicles, setVehicles] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState('');
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('kyber_user') || '{}');

  const load = () => fetchAPI('/vehicles').then(setVehicles).catch(err => setLoadError(err.message));

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const myVehicle = vehicles.find(v => v.current_driver_name === user.name);

  const handleSelect = async (vehicleId) => {
    setSelecting(true);
    setSelectError('');
    try {
      await fetchAPI('/vehicles/select-as-driver', {
        method: 'POST',
        body: JSON.stringify({ vehicle_id: vehicleId }),
      });
      load();
    } catch (err) {
      setSelectError(err.message);
    } finally {
      setSelecting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kyber_token');
    localStorage.removeItem('kyber_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col">
      {/* Header simple */}
      <div className="bg-[#050B14] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white font-bold">{user.name || 'Chofer'}</p>
          <p className="text-xs text-slate-500">
            {myVehicle ? `Manejando: ${myVehicle.plate}` : 'Sin auto asignado'}
          </p>
        </div>
        <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 flex items-center gap-1 text-sm">
          <LogOut size={16} /> Salir
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1 flex flex-col">
        <ErrorBanner message={loadError} />
        {selectError && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm p-3 rounded-xl">{selectError}</div>
        )}

        {/* Mapa */}
        <div className="flex-1 min-h-[280px] rounded-2xl overflow-hidden border border-slate-700">
          <MapContainer center={[-32.8895, -68.8458]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {vehicles.map(v => v.lat && v.lng && (
              <Marker key={v.id} position={[v.lat, v.lng]} icon={vehicleIcon(v.photo_url, v.id === myVehicle?.id)}>
                <Popup><div className="text-black font-bold">{v.plate}</div></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Selector de auto */}
        <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-4">
          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Car size={16} /> Elegí tu auto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.filter(v => v.status === 'active').map(v => {
              const isMine = v.id === myVehicle?.id;
              return (
                <button
                  key={v.id}
                  onClick={() => handleSelect(v.id)}
                  disabled={selecting}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    isMine ? 'bg-[#10B981]/10 border-[#10B981]/50' : 'bg-[#0B1120] border-slate-700 hover:border-slate-500'
                  } disabled:opacity-60`}
                >
                  <img src={v.photo_url || FALLBACK_PHOTO} className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-white font-bold">{v.plate}</p>
                    <p className="text-xs text-slate-400 truncate">{v.brand} {v.model}</p>
                  </div>
                  {isMine && <CheckCircle2 size={18} className="text-[#10B981] shrink-0" />}
                </button>
              );
            })}
            {vehicles.length === 0 && !loadError && (
              <p className="text-slate-500 text-sm col-span-2">No hay autos disponibles en tu flota todavía.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
