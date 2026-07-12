import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { X, Camera as CameraIcon } from 'lucide-react';

// Escanea un código de barras LINEAL (Code128, EAN, etc.) — distinto
// del QrScannerModal, que solo lee QR. Es lo que trae impreso el
// sobre de la SIM con el número de ICC.
export default function BarcodeScannerModal({ onScan, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let cancelled = false;

    async function start() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        // Preferimos la cámara trasera si el navegador la identifica como tal.
        const backCam = devices.find(d => /back|rear|environment/i.test(d.label));
        const deviceId = backCam?.deviceId || devices[0]?.deviceId;

        await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
          if (cancelled) return;
          if (result) {
            onScan(result.getText().trim());
          }
          // "err" acá se dispara todo el tiempo mientras no encuentra
          // nada en el cuadro — es normal, no es un error real, no lo
          // mostramos.
        });
      } catch (err) {
        setError('No se pudo acceder a la cámara. Revisá los permisos del navegador, o escribí el ICC a mano.');
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
              <div className="w-72 h-32 border-2 border-[#10B981] rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
            </div>
          </>
        )}
      </div>

      <div className="p-4 bg-[#0B1120] text-center">
        <p className="text-slate-400 text-xs">Apuntá la cámara al código de barras del sobre de la SIM (el que dice "Número de ICC")</p>
      </div>
    </div>
  );
}
