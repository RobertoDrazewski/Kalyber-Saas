import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { ClipboardCheck, X, Plus, Pencil, Trash2, Wrench } from 'lucide-react';
import MaintenanceEventForm, { TYPE_LABEL, TYPE_COLOR } from './MaintenanceEventForm';
import ErrorBanner from './ErrorBanner';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=200&q=60';

function fmtDate(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}

function VehicleDetail({ vehicle, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const load = () => fetchAPI(`/maintenance/events/${vehicle.id}`).then(setData).catch(err => setError(err.message));
  useEffect(() => { load(); }, [vehicle.id]);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro de mantenimiento?')) return;
    try {
      await fetchAPI(`/maintenance/events/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0B1120] border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <img src={vehicle.photo_url || FALLBACK_PHOTO} className="w-12 h-12 rounded-xl object-cover border border-slate-700" />
            <div>
              <h3 className="text-lg font-bold text-white font-mono">{vehicle.plate}</h3>
              <p className="text-xs text-slate-400">{vehicle.brand} {vehicle.model} · {data ? Math.round(data.current_odometer_km).toLocaleString('es-AR') : '—'} km</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={22} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <ErrorBanner message={error} />

          {!showForm && !editingEvent && (
            <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#6366F1]/50 text-[#6366F1] text-sm font-semibold hover:bg-[#6366F1]/10">
              <Plus size={16} /> Registrar mantenimiento
            </button>
          )}
          {showForm && (
            <MaintenanceEventForm
              vehicleId={vehicle.id}
              currentOdometer={data?.current_odometer_km}
              onDone={() => { setShowForm(false); load(); }}
              onCancel={() => setShowForm(false)}
            />
          )}
          {editingEvent && (
            <MaintenanceEventForm
              vehicleId={vehicle.id}
              currentOdometer={data?.current_odometer_km}
              editing={editingEvent}
              onDone={() => { setEditingEvent(null); load(); }}
              onCancel={() => setEditingEvent(null)}
            />
          )}

          <div className="space-y-2">
            {data?.events.map(ev => (
              <div key={ev.id} className="bg-[#1E293B]/50 border border-slate-800 rounded-xl p-4 flex gap-3">
                {ev.photo_url?.startsWith('data:image') && (
                  <img src={ev.photo_url} className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${TYPE_COLOR[ev.type]}`}>{TYPE_LABEL[ev.type]}</span>
                    <span className="text-xs text-slate-500">{fmtDate(ev.event_date)}</span>
                    {ev.km_at_event != null && <span className="text-xs text-slate-500">· {Math.round(ev.km_at_event).toLocaleString('es-AR')} km</span>}
                    {ev.origin === 'ml' && <span className="text-[10px] text-slate-600">(sugerido por IA)</span>}
                  </div>
                  {ev.description && <p className="text-sm text-slate-300">{ev.description}</p>}
                  <p className="text-xs text-slate-500 mt-1">
                    {ev.provider && <>{ev.provider} · </>}
                    {ev.cost != null && <>${Number(ev.cost).toLocaleString('es-AR')} · </>}
                    {ev.created_by_name && <>cargado por {ev.created_by_name}</>}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => setEditingEvent(ev)} className="text-slate-500 hover:text-white"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(ev.id)} className="text-slate-500 hover:text-[#EF4444]"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {data && data.events.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-8">Todavía no hay mantenimiento registrado para este auto.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TabMantenimientoRealizado() {
  const [vehicles, setVehicles] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchAPI('/vehicles').then(setVehicles).catch(err => setLoadError(err.message));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <ClipboardCheck className="text-[#10B981]" /> Mantenimiento Realizado
      </h2>
      <p className="text-slate-500 text-sm -mt-4">
        Click en un auto para ver su historial completo — service, neumáticos, frenos, y cualquier comprobante que hayan cargado.
      </p>
      <ErrorBanner message={loadError} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map(v => (
          <button
            key={v.id}
            onClick={() => setSelected(v)}
            className="bg-[#1E293B]/50 border border-slate-700 rounded-2xl p-4 flex items-center gap-3 text-left hover:border-[#6366F1] transition-colors"
          >
            <img src={v.photo_url || FALLBACK_PHOTO} className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-white font-bold">{v.plate}</p>
              <p className="text-xs text-slate-400 truncate">{v.brand} {v.model}</p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Wrench size={11} /> {Math.round(v.odometer_km || 0).toLocaleString('es-AR')} km</p>
            </div>
          </button>
        ))}
        {vehicles.length === 0 && !loadError && (
          <p className="text-slate-500 text-sm col-span-full">Todavía no hay autos cargados.</p>
        )}
      </div>

      {selected && <VehicleDetail vehicle={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
