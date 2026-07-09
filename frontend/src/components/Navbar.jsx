import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Globe } from 'lucide-react';

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
    flag: <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAACQElEQVR4nGNgGAWjYBSMglEwCoYDyLaO+H9Hh/H/XR2GIYEZ0AGv+8L/STbx/2/rMg5dD/C6L/wfb5M0JDzBgMsDIBxml/H/lg7z0PUALygmCnL//9rH9f//QfZBiRkIeQAcEzlF/3/s4x66HuB1X/g/OKvk//e9PEPXA7zuC/+7O5T8v6rP9v+uHsOgwQykeACEHRyr/l/W4xg6mZgXigW9FsHZto41/y/pcQ4dDwh4LvpfOu0UiphVcNP/BzX8/z80sAwoZiDGA95lO/9fuf8OQ9w6rvn/mx3Cgz8TT1t/7T8IGCStx5Azie74/3yr2ODzQFzLgf/vPv34jw2cuPrqv27COrgnDAI6/9+oEf3/sYmF7pgBXwxoRK/+f+TSC7jD//z9979y5un//B6IDA1X69Lz/5C+6ODLxFPXQZIPDOghhTwyFnab+3+xie7g8gCfx8L/j15++b9ox21wRn7w/PP/6tlnMBwv6jb7/xJjncFXjBomrf+f2H4IzpcOWv6/fAZqcSrtN+P/8SVagy8T8xKB5QKm/T+zXGPwF6O8WLBK0OT/V9YoDajj/5PrATWX3v8HjMSHZmNO17nj/zF9oQFvA90lpS0Er7Cc2v6f0BcYcEffJccDNsGN/+9XCwx44+0DOY05z9Tq/5938w94hv1PTiYOyS75/20v74A79D85HoiKzvn/poF9QBppHyltzEXYpg/6MaG7uDJxinXckBiVu4vNA0VWwQPuqLuUeGAUjIJRMApGwShgGIIAAIkb1fOHPW+vAAAAAElFTkSuQmCC" alt="Catalunya" className="w-5 h-5 object-contain inline-block" /> 
  },
];
export default function Navbar() {
  const [langOpen, setLangOpen] = useState(false);
  const [activeLang, setActiveLang] = useState(LANGUAGES[0]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById('google-translate-script')) {
      const addScript = document.createElement('script');
      addScript.id = 'google-translate-script';
      addScript.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      addScript.async = true;
      document.body.appendChild(addScript);

      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'es', includedLanguages: 'es,en,pt,de,it,fr', autoDisplay: false },
          'google_translate_element'
        );
      };
    }
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
    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = lang.code;
      select.dispatchEvent(new Event('change'));
    }
  };

  const handleScroll = (e, targetId) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      const element = document.querySelector(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      <style>{`
        .goog-te-banner-frame { display: none !important; }
        #goog-gt-tt { display: none !important; }
        body { top: 0 !important; position: static !important; }
        #google_translate_element { display: none !important; }
        iframe.goog-te-menu-frame { display: none !important; }
        .skiptranslate { display: none !important; }
        .goog-te-spinner-pos { display: none !important; }
      `}</style>
      <div id="google_translate_element"></div>

      <nav className="sticky top-0 z-50 w-full bg-[#0B1120]/80 backdrop-blur-md border-b border-slate-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-20">
          
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <img 
              src="/kaliber-banner.png" 
              alt="Logo Kalyber" 
              className="w-36 md:w-48 h-auto object-contain shrink-0 group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]"
            />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#features" onClick={(e) => handleScroll(e, '#features')} className="hover:text-white transition-all">Características</a>
            <a href="#hardware" onClick={(e) => handleScroll(e, '#hardware')} className="hover:text-white transition-all">Hardware</a>
            <a href="#pricing" onClick={(e) => handleScroll(e, '#pricing')} className="hover:text-white transition-all">Suscripciones</a>
            <a href="#contacto" onClick={(e) => handleScroll(e, '#contacto')} className="hover:text-white transition-all">Contacto</a>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg bg-[#1E293B]/50 hover:bg-[#1E293B] border border-slate-700/50 hover:border-slate-600 transition-all text-slate-300 hover:text-white"
              >
                <Globe size={18} className="text-[#6366F1]" />
                <span className="text-lg leading-none">{activeLang.flag}</span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${langOpen ? 'rotate-180' : ''}`} />
              </button>

              {langOpen && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-[#0F172A] border border-slate-700 rounded-xl shadow-xl shadow-black/50 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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

            <Link 
              to="/login" 
              className="group relative px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white text-sm font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] overflow-hidden shrink-0"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              <span className="relative z-10">Iniciar Sesión</span>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}