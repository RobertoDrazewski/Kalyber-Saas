import { Receipt, ExternalLink, AlertTriangle } from 'lucide-react';

// ============================================================
// Esta tab embebe tu facturador (facturador-pumacode_2.html) dentro
// del panel, solo visible para super_admin (ya filtrado en Sidebar).
//
// PENDIENTE DE TU LADO: el HTML del facturador no viene en el zip
// del proyecto (es un archivo aparte que me pasaste). Para que este
// iframe funcione:
//   1. Copiá tu facturador-pumacode_2.html a frontend/public/facturador.html
//   2. Listo — Vite sirve todo lo de /public tal cual, en /facturador.html
//
// Como el HTML original ya usaba localStorage para persistir datos,
// eso sigue funcionando igual acá (el iframe tiene su propio
// localStorage, aislado del resto de la app).
// ============================================================
export default function TabFacturador() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Receipt className="text-[#F59E0B]" /> Facturador
      </h2>

      <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="text-[#F59E0B] shrink-0 mt-0.5" size={18} />
        <p className="text-sm text-slate-300">
          El CAE seguís sacándolo vos a mano en ARCA (ex-AFIP) antes de cargarlo acá — esta herramienta solo arma el PDF/QR con el formato de Puma Code, no factura fiscalmente por sí sola.
        </p>
      </div>

      <div className="bg-[#1E293B]/50 border border-slate-700 rounded-2xl overflow-hidden" style={{ height: '75vh' }}>
        <iframe
          src="/facturador.html"
          title="Facturador Puma Code"
          className="w-full h-full border-0 bg-[#0B1120]"
        />
      </div>

      <a
        href="/facturador.html"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-[#818CF8] hover:text-white"
      >
        <ExternalLink size={14} /> Abrir en una pestaña aparte
      </a>
    </div>
  );
}
