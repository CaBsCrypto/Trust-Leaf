import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Leaf, Code, Menu, X } from 'lucide-react';

interface NavbarProps {
  onPortalClick: () => void;
  showTechnicalDetails?: boolean;
  onToggleTechnicalDetails?: () => void;
}

import { useLanguage } from '../context/LanguageContext';

export default function Navbar({ onPortalClick, showTechnicalDetails, onToggleTechnicalDetails }: NavbarProps) {
  const { t, language, setLanguage } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled 
          ? 'py-3 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-sm' 
          : 'py-5 bg-transparent border-b border-transparent'
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-6 md:px-12">
        {/* Logo */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="p-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 group-hover:border-emerald-400 group-hover:bg-emerald-100/70 transition-all duration-300 shadow-sm">
            <Leaf size={18} className="text-emerald-600" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Trust<span className="text-emerald-600">Leaf</span>
          </span>
        </div>
        
        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <button onClick={() => scrollTo('red')} className="hover:text-emerald-600 transition-colors duration-200 cursor-pointer">Red</button>
          <button onClick={() => scrollTo('profesionales')} className="hover:text-emerald-600 transition-colors duration-200 cursor-pointer">Profesionales</button>
          <button onClick={() => scrollTo('faq')} className="hover:text-emerald-600 transition-colors duration-200 cursor-pointer">FAQ</button>
        </div>
        
        {/* Right side */}
        <div className="flex items-center gap-3">
          {onToggleTechnicalDetails && (
            <button
              onClick={onToggleTechnicalDetails}
              title={showTechnicalDetails ? "Desactivar Modo Dev" : "Activar Modo Dev"}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                showTechnicalDetails 
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' 
                  : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-600 shadow-xs'
              }`}
            >
              <Code size={14} />
            </button>
          )}
          <button 
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors tracking-widest cursor-pointer px-3"
          >
            {t.nav.language}
          </button>
          <button 
            onClick={onPortalClick}
            className="btn-neon-fill !py-2 !px-5 !text-xs !font-bold"
          >
            {t.nav.portal}
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-700 hover:text-emerald-600 transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden mt-2 mx-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xl"
        >
          <div className="flex flex-col gap-3">
            <button onClick={() => scrollTo('red')} className="text-left text-sm font-semibold text-slate-700 hover:text-emerald-600 transition-colors py-2 cursor-pointer">Red</button>
            <button onClick={() => scrollTo('profesionales')} className="text-left text-sm font-semibold text-slate-700 hover:text-emerald-600 transition-colors py-2 cursor-pointer">Profesionales</button>
            <button onClick={() => scrollTo('faq')} className="text-left text-sm font-semibold text-slate-700 hover:text-emerald-600 transition-colors py-2 cursor-pointer">FAQ</button>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
