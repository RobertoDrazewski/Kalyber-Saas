import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { Plus, Trash2, Car, Upload } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=200&q=60';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function VehicleCard({ v, onDelete }) {
  return (
    <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-4 flex items-center gap-4">
      <img src={v.photo_url || FALLBACK_PHOTO} className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[#10B981] font-bold">{v.plate}</p>
        <p className="text-sm text-slate-300 truncate">{v.brand} {v.model}</p>
        <p className="text-xs mt-1">
          {v.device_imei ? <span className="text-[#10B981]">Pareado ({v.device_imei})</span> : <span className="text-slate-500">Sin equipo</span>}
        </p>
      </div>
      {onDelete && (
        <button onClick={() => onDelete(v.id)} className="text-red-500 hover:text-red-400 shrink-0">
          <Trash2 size={18} />
        </button>
      )}
    </div>
  );
}

export default function TabFlota() {
  const [vehicles, setVehicles] = useState([]);
  const [newVehicle, setNewVehicle] = useState({ plate: '', brand: '', model: '', device_imei: '' });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadVehicles = () => fetchAPI('/vehicles').then(setVehicles).catch(err => setLoadError(err.message));

  useEffect(() => { loadVehicles(); }, []);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setPhotoBase64(b64);
    setPhotoPreview(b64);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await fetchAPI('/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          plate: newVehicle.plate,
          brand: newVehicle.brand,
          model: newVehicle.model,
          photo_url: photoBase64,
          device_imei: newVehicle.device_imei || null,
        }),
      });
      setNewVehicle({ plate: '', brand: '', model: '', device_imei: '' });
      setPhotoBase64(null);
      setPhotoPreview(null);
      loadVehicles();
    } catch (err) {
      setError('No se pudo agregar el vehículo. Revisá la patente o el ID de equipo.');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar vehículo?')) {
      await fetchAPI(`/vehicles/${id}`, { method: 'DELETE' });
      loadVehicles();
    }
  };

  const realVehicles = vehicles.filter(v => v.source !== 'simulated');
  const demoVehicles = vehicles.filter(v => v.source === 'simulated');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Car className="text-[#10B981]" /> Administración de Flota
      </h2>
      <ErrorBanner message={loadError} />

      <div className="bg-[#1E293B]/50 p-6 rounded-2xl border border-slate-700 space-y-4">
        {error && <div className="bg-[#EF4444]/20 text-[#EF4444] p-3 rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Foto</label>
            <label className="w-16 h-16 rounded-xl border border-dashed border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden bg-[#0B1120] hover:border-[#6366F1]">
              {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : <Upload size={18} className="text-slate-500" />}
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Patente</label>
            <input placeholder="AB123CD" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white w-full sm:w-32" value={newVehicle.plate} onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })} required />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Marca</label>
            <input placeholder="Marca" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white w-full sm:w-32" value={newVehicle.brand} onChange={e => setNewVehicle({ ...newVehicle, brand: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Modelo</label>
            <input placeholder="Modelo" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white w-full sm:w-32" value={newVehicle.model} onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ID de equipo (IMEI)</label>
            <input placeholder="Opcional — se parea después" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white w-full sm:w-48" value={newVehicle.device_imei} onChange={e => setNewVehicle({ ...newVehicle, device_imei: e.target.value })} />
          </div>
          <button type="submit" className="bg-[#6366F1] px-6 py-2 rounded-lg text-white font-bold flex items-center justify-center gap-2 hover:bg-[#4F46E5] h-[42px]">
            <Plus size={18} /> Agregar
          </button>
        </form>
        <p className="text-xs text-slate-500">
          El ID de equipo tiene que estar dado de alta antes en Devices. Si lo dejás vacío, el auto queda cargado sin GPS hasta que compres el equipo y lo parees.
        </p>
      </div>

      {/* Mobile: tarjetas */}
      <div className="md:hidden space-y-3">
        <h3 className="font-bold text-white text-sm">Flota real</h3>
        {realVehicles.map(v => <VehicleCard key={v.id} v={v} onDelete={handleDelete} />)}
        {realVehicles.length === 0 && <p className="text-slate-500 text-sm">Todavía no cargaste ningún auto real.</p>}

        {demoVehicles.length > 0 && (
          <>
            <h3 className="font-bold text-white text-sm mt-6 flex items-center justify-between">
              Flota de demo <span className="text-xs text-[#F59E0B] font-normal">{demoVehicles.length} autos</span>
            </h3>
            {demoVehicles.map(v => <VehicleCard key={v.id} v={v} />)}
          </>
        )}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden md:block bg-[#1E293B]/50 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-4 bg-[#0B1120] border-b border-slate-800">
          <h3 className="font-bold text-white">Flota real</h3>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-[#0B1120] text-slate-400">
            <tr>
              <th className="px-6 py-4">Foto</th>
              <th className="px-6 py-4">Patente</th>
              <th className="px-6 py-4">Marca/Modelo</th>
              <th className="px-6 py-4">Equipo GPS</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {realVehicles.map(v => (
              <tr key={v.id}>
                <td className="px-6 py-3"><img src={v.photo_url || FALLBACK_PHOTO} className="w-10 h-10 rounded-lg object-cover border border-slate-700" /></td>
                <td className="px-6 py-3 font-mono text-[#10B981] font-bold">{v.plate}</td>
                <td className="px-6 py-3">{v.brand} {v.model}</td>
                <td className="px-6 py-3 text-xs">{v.device_imei ? <span className="text-[#10B981]">Pareado ({v.device_imei})</span> : <span className="text-slate-500">Sin equipo</span>}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => handleDelete(v.id)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
            {realVehicles.length === 0 && (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Todavía no cargaste ningún auto real.</td></tr>
            )}
          </tbody>
        </table></div>
      </div>

      {demoVehicles.length > 0 && (
        <div className="hidden md:block bg-[#1E293B]/30 rounded-2xl border border-slate-800 overflow-hidden opacity-80">
          <div className="p-4 bg-[#0B1120] border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-white">Flota de demo (simulador)</h3>
            <span className="text-xs text-[#F59E0B]">{demoVehicles.length} autos — no editables</span>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-400">
            <tbody className="divide-y divide-slate-800">
              {demoVehicles.map(v => (
                <tr key={v.id}>
                  <td className="px-6 py-3"><img src={v.photo_url || FALLBACK_PHOTO} className="w-8 h-8 rounded-lg object-cover border border-slate-700" /></td>
                  <td className="px-6 py-3 font-mono">{v.plate}</td>
                  <td className="px-6 py-3">{v.brand} {v.model}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
