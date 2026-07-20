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

export default function BarcodeScannerModal({
  onScan,
  onClose,
  // [NUEVO 19/07/2026] Textos configurables para poder reusar este
  // mismo modal en distintos contextos (ICC del chip M2M, device_uid
  // del scanner de taller, etc.) sin duplicar el componente. Los
  // defaults son los textos originales, así el uso en TabEquipos.jsx
  // no cambia en nada.
  title = 'Escaneá el código de barras del ICC',
  errorHint = 'No se pudo acceder a la cámara en alta resolución. Revisá los permisos del navegador, o escribí el ICC a mano.',
}) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null); // guardamos los controls del scan en curso, no el reader
  const scannedRef = useRef(false); // evita procesar/loopear después del primer resultado
  const [error, setError] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(hints);
    let cancelled = false;

    async function start() {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: HD_CONSTRAINTS },
          videoRef.current,
          (result, err, ctrls) => {
            if (cancelled || !result || scannedRef.current) return;
            scannedRef.current = true;
            // FIX: frenamos con la API oficial de zxing (controls.stop()),
            // llamada desde ADENTRO del callback como corresponde.
            //
            // Antes acá se llamaba reader.reset() desde dentro de este
            // mismo callback. reset() está pensado para cortar el scan
            // desde AFUERA del ciclo de decodificación (ej. en el cleanup
            // del useEffect al desmontar), no desde adentro de un frame
            // que la librería todavía tiene en vuelo. Llamarlo acá cortaba
            // el stream a mitad de un ciclo de decodificación interno, y
            // la lógica de recuperación de zxing lo interpretaba como que
            // la cámara se había caído sola — entonces reintentaba abrir
            // getUserMedia de nuevo, reabriendo el permiso/la ventana de
            // cámara en loop, aunque scannedRef ya estuviera en true.
            (ctrls ?? controlsRef.current)?.stop();
            onScan(result.getText().trim());
          }
        );
        controlsRef.current = controls;
        // Por si el primer resultado llegó ANTES de que esta promesa
        // terminara de resolver (cámara rápida / código ya en cuadro
        // desde el primer frame) — no dejamos un stream corriendo de más.
        if (cancelled || scannedRef.current) controls.stop();
      } catch (err) {
        if (!cancelled) {
          setError(errorHint);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      // FIX: en el cleanup también usamos controls.stop(), no reader.reset().
      // Es la forma consistente de cortar el stream sin disparar la
      // lógica de "reintentar cámara" de la librería.
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      <div className="flex items-center justify-between p-4 bg-[#0B1120]">
        <span className="text-white font-bold flex items-center gap-2"><CameraIcon size={18} /> {title}</span>
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
