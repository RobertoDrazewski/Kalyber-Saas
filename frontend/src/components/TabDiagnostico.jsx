import { useEffect, useState } from 'react';
import { fetchAPI } from '../services/api';
import { Cpu, X, Building2, Car as CarIcon, Radio } from 'lucide-react';
import ErrorBanner from './ErrorBanner';

const MODEL_LABEL = { VL04: 'JM-VL04 · Básico', VL502: 'JM-VL502 · Avanzado' };

function StatusBadge({ status }) {
  const map = {
    paired: { text: 'Pareado', cls: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' },
    unpaired: { text: 'Sin parear', cls: 'bg-slate-700/30 text-slate-400 border-slate-600' },
  };
  const s = map[status] || map.unpaired;
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${s.cls}`}>{s.text}</span>;
}

function fmtValue(v) {
  if (v === null || v === undefined || v === '') return <span className="text-slate-600">—</span>;
  return String(v);
}

// Panel de detalle: TODO lo que la base guarda de este equipo, sin
// procesar — pensado para diagnóstico real, no para uso diario.
function DeviceDetail({ deviceId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAPI(`/devices/${deviceId}/raw?limit=100`).then(setData).catch(err => setError(err.message));
  }, [deviceId]);

  const columns = data?.readings?.[0] ? Object.keys(data.readings[0]) : [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0B1120] border border-slate-700 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white font-mono">{data?.device?.imei || '...'}</h3>
            <p className="text-xs text-slate-400">{MODEL_LABEL[data?.device?.model] || data?.device?.model}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={22} /></button>
        </div>

        {error && <div className="p-5 text-red-400 text-sm">{error}</div>}

        {data && (
          <div className="overflow-y-auto flex-1">
            {/* Ficha del equipo */}
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-800">
              <div>
                <p className="text-[11px] text-slate-500 uppercase">Cliente</p>
                <p className="text-white text-sm">{data.device.owner_company || data.device.owner_name || 'Sin asignar'}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase">Vehículo</p>
                <p className="text-white text-sm font-mono">{data.device.vehicle_plate || '—'} {data.device.brand ? `(${data.device.brand} ${data.device.vehicle_model})` : ''}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase">Estado</p>
                <StatusBadge status={data.device.status} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase">Odómetro</p>
                <p className="text-white text-sm">{data.device.odometer_km != null ? `${Math.round(data.device.odometer_km).toLocaleString('es-AR')} km` : '—'}</p>
              </div>
            </div>

            {/* Tabla cruda de Telemetry_Raw */}
            <div className="p-5">
              <p className="text-xs text-slate-500 mb-3">Últimas {data.readings.length} lecturas guardadas en Telemetry_Raw, sin procesar:</p>
              {data.readings.length === 0 ? (
                <p className="text-slate-500 text-sm">Este equipo todavía no tiene lecturas guardadas.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-[#1E293B] text-slate-400 sticky top-0">
                      <tr>{columns.map(c => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.readings.map((row, i) => (
                        <tr key={i} className="text-slate-300 hover:bg-[#1E293B]/50">
                          {columns.map(c => (
                            <td key={c} className="px-3 py-1.5 max-w-[240px] truncate" title={String(row[c] ?? '')}>
                              {fmtValue(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TabDiagnostico() {
  const [devices, setDevices] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetchAPI('/devices').then(setDevices).catch(err => setLoadError(err.message));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Cpu className="text-[#6366F1]" /> Diagnóstico de Equipos
      </h2>
      <p className="text-slate-500 text-sm -mt-4">
        Todos los equipos, con su modelo, cliente y estado — click en uno para ver todo lo que la base de datos guarda de él, sin procesar.
      </p>
      <ErrorBanner message={loadError} />

      <div className="bg-[#1E293B]/50 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-[#0B1120] text-slate-400">
              <tr>
                <th className="px-6 py-4">IMEI</th>
                <th className="px-6 py-4">Modelo</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Vehículo</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {devices.map(d => (
                <tr
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className="cursor-pointer hover:bg-[#0B1120]/60 transition-colors"
                >
                  <td className="px-6 py-3 font-mono text-white flex items-center gap-2">
                    <Radio size={14} className="text-slate-500" /> {d.imei}
                  </td>
                  <td className="px-6 py-3">{MODEL_LABEL[d.model] || d.model}</td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-500" />
                      {d.owner_company || d.owner_name || <span className="text-slate-600">Sin asignar</span>}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {d.vehicle_plate
                      ? <span className="flex items-center gap-1.5 font-mono"><CarIcon size={13} className="text-slate-500" />{d.vehicle_plate}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={d.status} /></td>
                </tr>
              ))}
              {devices.length === 0 && !loadError && (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Todavía no hay equipos dados de alta.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && <DeviceDetail deviceId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
