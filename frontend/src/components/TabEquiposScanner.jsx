import { ScanLine } from 'lucide-react';
import ScannerProvisioning from './ScannerProvisioning';

// ============================================================
// [NUEVO 20/07/2026] Pestaña propia para dar de alta y gestionar los
// equipos Kalyber Scanner — antes vivía escondida al fondo de
// Usuarios. Ahora es una herramienta separada en el menú, al lado de
// "Equipos GPS", para que sea fácil de encontrar y coherente con cómo
// está organizado el resto del panel.
// ============================================================
export default function TabEquiposScanner() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ScanLine className="text-[#EC4899]" size={24} /> Equipos Scanner
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Generá y gestioná los equipos Kalyber Scanner. Cada equipo se pre-carga con un
          código único (KAL-SCAN-XXXX) que se imprime en la tapa como código de barras —
          el taller lo escanea con la cámara al momento de parearlo.
        </p>
      </div>

      <ScannerProvisioning />
    </div>
  );
}
