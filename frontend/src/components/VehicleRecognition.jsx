import { useEffect, useState } from 'react';
import { ScanSearch, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { fetchAPI } from '../services/api';

// ============================================================
// [NUEVO 20/07/2026] Reconocimiento de vehículo por VIN.
//
// El VL502 lee el VIN de la ECU y lo guarda. Este componente lo
// decodifica (offline, en el backend) y muestra marca / país / año
// detectados automáticamente. Ofrece un botón para autocompletar esos
// datos en el formulario de edición del auto.
//
// HONESTIDAD sobre el modelo: el VIN NO permite sacar el modelo exacto
// (Focus, Fiesta...) de forma confiable offline, así que ese campo se
// deja para que el usuario lo complete/confirme a mano. Acá solo
// autocompletamos lo que SÍ se puede saber con certeza.
//
// Props:
//   vehicleId   — id del vehículo
//   onApply     — callback(datos) para volcar {brand, year} al form
// ============================================================
export default function VehicleRecognition({ vehicleId, onApply }) {
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    let cancelled = false;
    fetchAPI(`/vehicles/${vehicleId}/decode-vin`)
      .then(data => { if (!cancelled) setState({ loading: false, data }); })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null }); });
    return () => { cancelled = true; };
  }, [vehicleId]);

  if (state.loading) {
    return (
      <div className="bg-[#1E293B]/40 border border-slate-700 rounded-xl p-3 flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 size={15} className="animate-spin" /> Leyendo identificación del vehículo...
      </div>
    );
  }

  const d = state.data;

  // Sin VIN todavía (equipo básico, o el avanzado aún no lo reportó)
  if (!d || d.has_vin === false) {
    return (
      <div className="bg-[#1E293B]/40 border border-slate-700 rounded-xl p-3 text-slate-500 text-xs flex items-start gap-2">
        <ScanSearch size={15} className="shrink-0 mt-0.5" />
        <span>
          {d?.message || 'Este vehículo todavía no reportó su VIN. Aparece automáticamente cuando el equipo lo lee de la computadora del auto (Plan Avanzado / VL502).'}
        </span>
      </div>
    );
  }

  // VIN presente pero inválido / no reconocido
  if (!d.valid) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-400/90 text-xs flex items-start gap-2">
        <ScanSearch size={15} className="shrink-0 mt-0.5" />
        <span>El equipo reportó un VIN (<span className="font-mono">{d.vin}</span>) pero no tiene el formato estándar esperado — completá los datos a mano.</span>
      </div>
    );
  }

  // VIN válido y decodificado
  const partes = [d.marca, d.pais, d.anio].filter(Boolean);
  return (
    <div className="bg-gradient-to-br from-[#6366F1]/10 to-[#1E293B]/40 border border-[#6366F1]/40 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={15} className="text-[#818CF8]" />
        <span className="text-[#818CF8] text-xs font-bold uppercase tracking-widest">Vehículo reconocido por VIN</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {d.marca && <Chip label="Marca" value={d.marca} />}
        {d.pais && <Chip label="Origen" value={d.pais} />}
        {d.anio && <Chip label="Año" value={String(d.anio)} />}
      </div>

      <p className="text-[11px] text-slate-500 font-mono mb-3">VIN: {d.vin}</p>

      {!d.marca && (
        <p className="text-[11px] text-amber-400/80 mb-3">
          La marca de este VIN no está en nuestra base — completala a mano. El año y el origen sí se detectaron.
        </p>
      )}

      {onApply && (d.marca || d.anio) && (
        <button
          type="button"
          onClick={() => onApply({ brand: d.marca || undefined, year: d.anio || undefined })}
          className="w-full flex items-center justify-center gap-2 bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/40 py-2 rounded-lg text-xs font-semibold hover:bg-[#6366F1]/30"
        >
          <CheckCircle2 size={14} /> Autocompletar {partes.slice(0, 2).join(' y ')}{d.anio ? ' y año' : ''}
        </button>
      )}
      <p className="text-[10px] text-slate-600 mt-2 text-center">
        El modelo exacto no se puede leer del VIN — completalo o confirmalo vos.
      </p>
    </div>
  );
}

function Chip({ label, value }) {
  return (
    <div className="bg-[#0B1120]/60 border border-slate-700 rounded-lg px-3 py-1.5">
      <p className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-white font-semibold">{value}</p>
    </div>
  );
}
