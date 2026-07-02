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
        .skiptranslate iframe { display: none !important; }
        body { top: 0 !important; }
        #google_translate_element { display: none !important; }
        .goog-te-spinner-pos { display: none !important; }
      `}</style>
      <div id="google_translate_element"></div>

      <nav className="sticky top-0 z-50 w-full bg-[#0B1120]/80 backdrop-blur-md border-b border-slate-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-20">
          
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <img 
              src="/kaliber-banner.png" 
              alt="Logo Kalyber" 
              className="h-80 sm:h-40 w-auto object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]"
            />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#features" onClick={(e) => handleScroll(e, '#features')} className="hover:text-white transition-all">Características</a>
            <a href="#hardware" onClick={(e) => handleScroll(e, '#hardware')} className="hover:text-white transition-all">Hardware</a>
            <a href="#pricing" onClick={(e) => handleScroll(e, '#pricing')} className="hover:text-white transition-all">Planes Corporativos</a>
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
              className="group relative px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white text-sm font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] overflow-hidden"
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