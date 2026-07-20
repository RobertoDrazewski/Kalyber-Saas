import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Cpu, Plus, Printer, CheckCircle2, Loader2, Radio } from 'lucide-react';
import { fetchAPI } from '../services/api';

// ============================================================
// [NUEVO 19/07/2026] Provisioning de Kalyber Scanners — solo super_admin.
// Genera el próximo device_uid de la serie (KAL-SCAN-XXXX), lo
// pre-carga en la base, y muestra el código de barras (Code128) listo
// para imprimir y pegar en la tapa del equipo. Ese mismo código lo
// escanea después el taller con la cámara al parear.
// ============================================================

// Barcode individual — se dibuja en un <svg> con JsBarcode. Code128
// porque es el formato que el BarcodeScannerModal lee mejor (mismo
// que ya usamos para el ICC).
function Barcode({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: 'CODE128',
          width: 2,
          height: 60,
          fontSize: 14,
          margin: 8,
          displayValue: true,
        });
      } catch (err) {
        // valor inválido para el formato — no romper la vista
      }
    }
  }, [value]);
  return <svg ref={ref} />;
}

export default function ScannerProvisioning() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [justCreated, setJustCreated] = useState(null);

  const load = () => {
    fetchAPI('/scanner/provision')
      .then(rows => setDevices(Array.isArray(rows) ? rows : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetchAPI('/scanner/provision', { method: 'POST', body: JSON.stringify({}) });
      setJustCreated(res.device_uid);
      load();
    } catch (err) {
      // silencioso
    } finally {
      setGenerating(false);
    }
  };

  // Imprime SOLO el barcode recién generado, en una ventana nueva —
  // así el usuario manda a la impresora la etiqueta sin el resto del panel.
  const printBarcode = (uid) => {
    const win = window.open('', '_blank', 'width=400,height=300');
    if (!win) return;
    win.document.write(`
      <html><head><title>${uid}</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      </head><body style="text-align:center;padding:20px;font-family:sans-serif;">
      <svg id="bc"></svg>
      <script>
        JsBarcode("#bc", "${uid}", { format: "CODE128", width: 2, height: 70, fontSize: 16, displayValue: true });
        setTimeout(() => window.print(), 300);
      </script>
      </body></html>
    `);
    win.document.close();
  };

  const sinReclamar = devices.filter(d => !d.reclamado);
  const reclamados = devices.filter(d => d.reclamado);

  return (
    <div className="bg-[#111827] rounded-2xl border border-slate-800 p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Cpu size={18} className="text-[#EC4899]" /> Equipos Kalyber Scanner
        </h3>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 bg-[#EC4899] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Generar nuevo scanner
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando...</p>
      ) : devices.length === 0 ? (
        <p className="text-slate-500 text-sm py-6 text-center">
          Todavía no generaste ningún equipo. Tocá "Generar nuevo scanner" para crear el primero (KAL-SCAN-0001) y su código de barras.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Recién creado — destacado con su barcode grande listo para imprimir */}
          {justCreated && (
            <div className="bg-[#EC4899]/10 border border-[#EC4899]/40 rounded-xl p-4 text-center">
              <p className="text-[#EC4899] text-xs font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} /> Equipo generado — imprimí este código para la tapa
              </p>
              <div className="bg-white rounded-lg inline-block px-2 py-1 my-2">
                <Barcode value={justCreated} />
              </div>
              <div>
                <button
                  onClick={() => printBarcode(justCreated)}
                  className="inline-flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold mt-1"
                >
                  <Printer size={15} /> Imprimir etiqueta
                </button>
              </div>
            </div>
          )}

          {/* Stock sin asignar */}
          {sinReclamar.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                En stock · sin asignar ({sinReclamar.length})
              </p>
              <div className="space-y-2">
                {sinReclamar.map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-[#0B1120]/60 border border-slate-800 rounded-lg px-3 py-2">
                    <span className="font-mono text-white text-sm">{d.device_uid}</span>
                    <button
                      onClick={() => printBarcode(d.device_uid)}
                      className="text-slate-400 hover:text-white flex items-center gap-1.5 text-xs"
                    >
                      <Printer size={13} /> Imprimir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ya vendidos / asignados a un taller */}
          {reclamados.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                Asignados a talleres ({reclamados.length})
              </p>
              <div className="space-y-2">
                {reclamados.map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-[#0B1120]/60 border border-slate-800 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-mono text-white text-sm">{d.device_uid}</span>
                      <span className="text-slate-500 text-xs ml-2">{d.workshop_name || 'Taller'}</span>
                    </div>
                    {d.online ? (
                      <span className="flex items-center gap-1 text-[#10B981] text-xs">
                        <Radio size={12} /> En línea
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">Offline</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
