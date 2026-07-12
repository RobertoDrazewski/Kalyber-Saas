import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { X, Camera as CameraIcon } from 'lucide-react';

// Escanea un código de barras LINEAL (Code128, EAN, etc.) — distinto
// del QrScannerModal, que solo lee QR.
//
// Los códigos lineales necesitan bastante más resolución de cámara
// que un QR para leerse bien (son líneas finas, no un patrón grande
// con corrección de errores). Por eso acá, a diferencia del QR:
//   - Pedimos resolución HD explícita a la cámara.
//   - Restringimos los formatos a los típicos de estas etiquetas
//     (CODE_128 es el más común, EAN/UPC de respaldo) — la librería
//     no pierde tiempo probando formatos que no van a aparecer.
//   - Activamos TRY_HARDER (más lento por cuadro, pero mucho más
//     confiable) — tiene sentido acá porque es un escaneo puntual,
//     no necesitamos 30 cuadros por segundo.
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.ITF,
]);
hints.set(DecodeHintType.TRY_HARDER, true);

const HD_CONSTRAINTS = {
    facingMode: 'environment',
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    // Algunos celulares permiten pedir foco continuo explícito — si el
    // navegador no lo soporta, esta línea se ignora sola sin romper nada.
    advanced: [{ focusMode: 'continuous' }],
};

export default function BarcodeScannerModal({ onScan, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;
    let cancelled = false;

    async function start() {
      try {
        await reader.decodeFromConstraints(
          { video: HD_CONSTRAINTS },
          videoRef.current,
          (result) => {
            if (cancelled || !result) return;
            onScan(result.getText().trim());
          }
        );
      } catch (err) {
        setError('No se pudo acceder a la cámara en alta resolución. Revisá los permisos del navegador, o escribí el ICC a mano.');
      }
    }

    start();

    return () => {
      cancelled = true;
      readerRef.current?.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      <div className="flex items-center justify-between p-4 bg-[#0B1120]">
        <span className="text-white font-bold flex items-center gap-2"><CameraIcon size={18} /> Escaneá el código de barras del ICC</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {error ? (
          <p className="text-red-400 text-sm text-center px-8">{error}</p>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[85%] h-28 border-2 border-[#10B981] rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
            </div>
          </>
        )}
      </div>

      <div className="p-4 bg-[#0B1120] text-center space-y-1">
        <p className="text-slate-400 text-xs">Apoyá el código de barras bien recto, llenando el rectángulo verde de lado a lado</p>
        <p className="text-slate-600 text-[11px]">Buena luz, sin reflejos, y a unos 10-15cm de distancia suele andar mejor que muy pegado</p>
      </div>
    </div>
  );
}
