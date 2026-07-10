import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Globe } from 'lucide-react';

// ============================================================
// Mismo widget que el Navbar público, pero:
//   1. Reutilizable — se monta también en el panel de control.
//   2. Arregla el bug de "no cambia de idioma": el contenedor
//      #google_translate_element tenía display:none desde el
//      arranque, y Google a veces no termina de construir el
//      <select> interno si el contenedor nunca estuvo "renderizado"
//      (aunque sea invisible). Ahora se oculta con una técnica que
//      lo deja fuera de vista pero sigue siendo parte del layout.
//   3. Si tocás una bandera antes de que Google termine de inicializar
//      (puede tardar uno o dos segundos), reintenta solo en vez de
//      no hacer nada.
// ============================================================

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇦🇷' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  {
    code: 'ca',
    label: 'Català',
    flag: (
      <img
        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAACQElEQVR4nGNgGAWjYBSMglEwCoYDyLaO+H9Hh/H/XR2GIYEZ0AGv+8L/STbx/2/rMg5dD/C6L/wfb5M0JDzBgMsDIBxml/H/lg7z0PUALygmCnL//9rH9f//QfZBiRkIeQAcEzlF/3/s4x66HuB1X/g/OKvk//e9PEPXA7zuC/+7O5T8v6rP9v+uHsOgwQykeACEHRyr/l/W4xg6mZgXigW9FsHZto41/y/pcQ4dDwh4LvpfOu0UiphVcNP/BzX8/z80sAwoZiDGA95lO/9fuf8OQ9w6rvn/mx3Cgz8TT1t/7T8IGCStx5Azie74/3yr2ODzQFzLgf/vPv34jw2cuPrqv27COrgnDAI6/9+oEf3/sYmF7pgBXwxoRK/+f+TSC7jD//z9979y5un//B6IDA1X69Lz/5C+6ODLxFPXQZIPDOghhTwyFnab+3+xie7g8gCfx8L/j15++b9ox21wRn7w/PP/6tlnMBwv6jb7/xJjncFXjBomrf+f2H4IzpcOWv6/fAZqcSrtN+P/8SVagy8T8xKB5QKm/T+zXGPwF6O8WLBK0OT/V9YoDajj/5PrATWX3v8HjMSHZmNO17nj/zF9oQFvA90lpS0Er7Cc2v6f0BcYcEffJccDNsGN/+9XCwx44+0DOY05z9Tq/5938w94hv1PTiYOyS75/20v74A79D85HoiKzvn/poF9QBppHyltzEXYpg/6MaG7uDJxinXckBiVu4vNA0VWwQPuqLuUeGAUjIJRMApGwShgGIIAAIkb1fOHPW+vAAAAAElFTkSuQmCC"
        alt="Catalunya"
        className="w-5 h-5 object-contain inline-block"
      />
    ),
  },
];

const INCLUDED_LANGS = 'es,en,pt,de,it,fr,ca';

// El script de Google se carga UNA sola vez por página, sea cual sea
// el primer componente que se monte (Navbar en el home, esta barra
// en el panel). Guardamos el estado en window para coordinarlo entre
// montajes distintos de React.
function ensureGoogleTranslateLoaded(onReady) {
  if (window.__googleTranslateReady) {
    onReady();
    return;
  }
  window.__googleTranslateReadyCallbacks = window.__googleTranslateReadyCallbacks || [];
  window.__googleTranslateReadyCallbacks.push(onReady);

  if (document.getElementById('google-translate-script')) return; // ya se está cargando

  const addScript = document.createElement('script');
  addScript.id = 'google-translate-script';
  addScript.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  addScript.async = true;
  document.body.appendChild(addScript);

  window.googleTranslateElementInit = () => {
    new window.google.translate.TranslateElement(
      { pageLanguage: 'es', includedLanguages: INCLUDED_LANGS, autoDisplay: false },
      'google_translate_element'
    );
    window.__googleTranslateReady = true;
    (window.__googleTranslateReadyCallbacks || []).forEach(cb => cb());
    window.__googleTranslateReadyCallbacks = [];
  };
}

// Busca el <select> que arma Google, reintentando si todavía no
// existe (típico si el usuario clickea muy rápido después de cargar).
function triggerTranslate(langCode, attempt = 0) {
  const combo = document.querySelector('.goog-te-combo');
  if (combo) {
    combo.value = langCode;
    combo.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  // Fallback extra: la cookie que usa Google internamente. Ayuda en
  // los casos donde el evento sobre el <select> no alcanza a disparar
  // la traducción (pasa en algunos navegadores/versiones del widget).
  document.cookie = `googtrans=/es/${langCode}; path=/`;

  if (attempt < 10) {
    setTimeout(() => triggerTranslate(langCode, attempt + 1), 300);
  }
}

export default function GoogleTranslateBar({ className = '' }) {
  const [langOpen, setLangOpen] = useState(false);
  const [activeLang, setActiveLang] = useState(LANGUAGES[0]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    ensureGoogleTranslateLoaded(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTranslate = (lang) => {
    setActiveLang(lang);
    setLangOpen(false);
    triggerTranslate(lang.code);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Este div lo usa Google para montar su <select> oculto. Ojo:
          NO uses display:none acá — con eso el widget a veces no
          termina de inicializar el <select> interno. Se oculta de
          forma que sigue "presente" para el layout. */}
      <div
        id="google_translate_element"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
      ></div>

      <button
        onClick={() => setLangOpen(!langOpen)}
        className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg bg-[#1E293B]/50 hover:bg-[#1E293B] border border-slate-700/50 hover:border-slate-600 transition-all text-slate-300 hover:text-white"
      >
        <Globe size={18} className="text-[#6366F1]" />
        <span className="text-lg leading-none">{activeLang.flag}</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${langOpen ? 'rotate-180' : ''}`} />
      </button>

      {langOpen && (
        <div className="absolute top-full right-0 mt-2 w-40 bg-[#0F172A] border border-slate-700 rounded-xl shadow-xl shadow-black/50 py-2 z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleTranslate(lang)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                activeLang.code === lang.code ? 'bg-[#6366F1]/10 text-white font-bold' : 'text-slate-400 hover:bg-[#1E293B] hover:text-white'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
