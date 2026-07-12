import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Camera as CameraIcon } from 'lucide-react';

// Escanea un QR con la cámara del celular (o webcam en desktop) y
// devuelve el texto decodificado. Pensado para el QR de la etiqueta
// del equipo, que trae el IMEI — pero devuelve el texto crudo tal
// cual lo lea, así sirve para cualquier QR, no asumimos el formato.
export default function QrScannerModal({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // cámara trasera si existe
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        tick();
      } catch (err) {
        setError('No se pudo acceder a la cámara. Revisá los permisos del navegador, o escribí el IMEI a mano.');
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        onScan(code.data.trim());
        return; // no seguimos pidiendo más frames, ya encontramos uno
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      <div className="flex items-center justify-between p-4 bg-[#0B1120]">
        <span className="text-white font-bold flex items-center gap-2"><CameraIcon size={18} /> Escaneá el QR del equipo</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {error ? (
          <p className="text-red-400 text-sm text-center px-8">{error}</p>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Marco guía, solo visual */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-[#10B981] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
            </div>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="p-4 bg-[#0B1120] text-center">
        <p className="text-slate-400 text-xs">Apuntá la cámara al código QR de la etiqueta del equipo</p>
      </div>
    </div>
  );
}
