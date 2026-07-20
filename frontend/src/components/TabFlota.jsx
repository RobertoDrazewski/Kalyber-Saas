import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { Plus, Trash2, Car, Upload, UserCheck, Pencil, X } from 'lucide-react';
import ErrorBanner from './ErrorBanner';
import VehicleRecognition from './VehicleRecognition';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=200&q=60';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Selector de chofer — lo usan el super_admin y el admin para
// vincular directamente un conductor a un vehículo (sin depender de
// que el chofer lo elija él mismo desde su vista).
function DriverAssign({ vehicle, drivers, onAssign }) {
  return (
    <select
      className="bg-[#0B1120] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
      value={vehicle.current_driver_id || ''}
      onChange={e => onAssign(vehicle.id, e.target.value || null)}
    >
      <option value="">Sin chofer asignado</option>
      {drivers.map(d => (
        <option key={d.id} value={d.id}>{d.full_name}</option>
      ))}
    </select>
  );
}

// Modal de edición — reutiliza el mismo endpoint PATCH que ya existe,
// solo faltaba la pantalla para llamarlo desde un auto ya cargado.
function EditVehicleModal({ vehicle, onClose, onSaved }) {
  const [form, setForm] = useState({
    brand: vehicle.brand || '',
    model: vehicle.model || '',
    year: vehicle.year || '',
    odometer_km: vehicle.odometer_km || 0,
    status: vehicle.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await fetchAPI(`/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          brand: form.brand,
          model: form.model,
          year: form.year ? parseInt(form.year) : null,
          odometer_km: form.odometer_km !== '' ? parseFloat(form.odometer_km) : null,
          status: form.status,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0B1120] border border-slate-700 rounded-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white font-mono">Editar {vehicle.plate}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && <div className="bg-[#EF4444]/20 text-[#EF4444] p-3 rounded-lg text-sm">{error}</div>}

          {/* [NUEVO 20/07/2026] Reconocimiento por VIN — detecta marca,
              origen y año del VIN que reporta el equipo, y ofrece
              autocompletar el formulario. */}
          <VehicleRecognition
            vehicleId={vehicle.id}
            onApply={({ brand, year }) => setForm(f => ({
              ...f,
              brand: brand ?? f.brand,
              year: year ?? f.year,
            }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Marca</label>
              <input className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Modelo</label>
              <input className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Año</label>
              <input type="number" className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Estado</label>
              <select className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Odómetro (km)</label>
            <input type="number" min="0" step="0.1" className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-white" value={form.odometer_km} onChange={e => setForm({ ...form, odometer_km: e.target.value })} />
            <p className="text-[11px] text-slate-500 mt-1">Se sigue sumando solo con el GPS después de guardar acá — esto solo corrige el punto de partida.</p>
          </div>
          <button type="submit" disabled={saving} className="w-full bg-[#6366F1] py-2.5 rounded-lg text-white font-bold hover:bg-[#4F46E5] disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function TabFlota() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [newVehicle, setNewVehicle] = useState({ plate: '', brand: '', model: '', device_imei: '', odometer_km: '' });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [editingVehicle, setEditingVehicle] = useState(null);

  const loadVehicles = () => fetchAPI('/vehicles').then(setVehicles).catch(err => setLoadError(err.message));
  const loadDrivers = () => fetchAPI('/drivers').then(setDrivers).catch(() => {}); // si el rol no tiene acceso, no rompe la tab

  useEffect(() => { loadVehicles(); loadDrivers(); }, []);

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
          odometer_km: newVehicle.odometer_km ? parseFloat(newVehicle.odometer_km) : 0,
        }),
      });
      setNewVehicle({ plate: '', brand: '', model: '', device_imei: '', odometer_km: '' });
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

  const handleAssignDriver = async (vehicleId, driverId) => {
    try {
      await fetchAPI(`/vehicles/${vehicleId}/assign-driver`, {
        method: 'PATCH',
        body: JSON.stringify({ driver_id: driverId }),
      });
      loadVehicles();
    } catch (err) {
      setLoadError(err.message);
    }
  };

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
            <label className="block text-xs text-slate-400 mb-1">Odómetro actual (km)</label>
            <input type="number" min="0" step="0.1" placeholder="Del tablero del auto" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white w-full sm:w-40" value={newVehicle.odometer_km} onChange={e => setNewVehicle({ ...newVehicle, odometer_km: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ID de equipo (IMEI)</label>
            <input placeholder="Opcional — se parea después" className="bg-[#0B1120] border border-slate-700 rounded-lg px-4 py-2 text-white w-full sm:w-48" value={newVehicle.device_imei} onChange={e => setNewVehicle({ ...newVehicle, device_imei: e.target.value })} />
          </div>
          <button type="submit" className="bg-[#6366F1] px-6 py-2 rounded-lg text-white font-bold flex items-center justify-center gap-2 hover:bg-[#4F46E5] h-[42px]">
            <Plus size={18} /> Agregar
          </button>
        </form>
      </div>

      {/* Mobile: tarjetas */}
      <div className="md:hidden space-y-3">
        <h3 className="font-bold text-white text-sm">Flota</h3>
        {vehicles.map(v => (
          <div key={v.id} className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-4">
              <img src={v.photo_url || FALLBACK_PHOTO} className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[#10B981] font-bold">{v.plate}</p>
                <p className="text-sm text-slate-300 truncate">{v.brand} {v.model}</p>
                <p className="text-xs mt-1">
                  {v.device_imei ? <span className="text-[#10B981]">Pareado ({v.device_imei})</span> : <span className="text-slate-500">Sin equipo</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{Math.round(v.odometer_km || 0).toLocaleString('es-AR')} km</p>
              </div>
              <button onClick={() => setEditingVehicle(v)} className="text-slate-400 hover:text-white shrink-0">
                <Pencil size={18} />
              </button>
              <button onClick={() => handleDelete(v.id)} className="text-red-500 hover:text-red-400 shrink-0">
                <Trash2 size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <UserCheck size={14} className="text-slate-500 shrink-0" />
              <DriverAssign vehicle={v} drivers={drivers} onAssign={handleAssignDriver} />
            </div>
          </div>
        ))}
        {vehicles.length === 0 && <p className="text-slate-500 text-sm">Todavía no cargaste ningún auto.</p>}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden md:block bg-[#1E293B]/50 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-4 bg-[#0B1120] border-b border-slate-800">
          <h3 className="font-bold text-white">Flota</h3>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-[#0B1120] text-slate-400">
            <tr>
              <th className="px-6 py-4">Foto</th>
              <th className="px-6 py-4">Patente</th>
              <th className="px-6 py-4">Marca/Modelo</th>
              <th className="px-6 py-4">Equipo GPS</th>
              <th className="px-6 py-4">Odómetro</th>
              <th className="px-6 py-4">Chofer asignado</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {vehicles.map(v => (
              <tr key={v.id}>
                <td className="px-6 py-3"><img src={v.photo_url || FALLBACK_PHOTO} className="w-10 h-10 rounded-lg object-cover border border-slate-700" /></td>
                <td className="px-6 py-3 font-mono text-[#10B981] font-bold">{v.plate}</td>
                <td className="px-6 py-3">{v.brand} {v.model}</td>
                <td className="px-6 py-3 text-xs">{v.device_imei ? <span className="text-[#10B981]">Pareado ({v.device_imei})</span> : <span className="text-slate-500">Sin equipo</span>}</td>
                <td className="px-6 py-3">{Math.round(v.odometer_km || 0).toLocaleString('es-AR')} km</td>
                <td className="px-6 py-3">
                  <DriverAssign vehicle={v} drivers={drivers} onAssign={handleAssignDriver} />
                </td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => setEditingVehicle(v)} className="text-slate-400 hover:text-white mr-3"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(v.id)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">Todavía no cargaste ningún auto.</td></tr>
            )}
          </tbody>
        </table></div>
      </div>

      {editingVehicle && (
        <EditVehicleModal
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSaved={() => { setEditingVehicle(null); loadVehicles(); }}
        />
      )}
    </div>
  );
}
