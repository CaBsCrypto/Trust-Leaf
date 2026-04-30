import { motion } from 'motion/react';
import { Leaf } from 'lucide-react';

interface NavbarProps {
  onPortalClick: () => void;
}

import { useLanguage } from '../context/LanguageContext';

export default function Navbar({ onPortalClick }: NavbarProps) {
  const { t, language, setLanguage } = useLanguage();
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md bg-brand-ivory/80 border-b border-brand-green-deep/5"
    >
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <div className="p-1.5 bg-brand-green-deep rounded-lg text-brand-ivory">
          <Leaf size={20} />
        </div>
        <span className="text-lg md:text-xl font-bold tracking-tight text-brand-green-deep">Trust Leaf</span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 text-sm font-medium">
        <button onClick={() => scrollTo('experiencia')} className="hover:text-brand-green-mid transition-colors">Trust Network</button>
        <button onClick={() => scrollTo('ecosistema')} className="hover:text-brand-green-mid transition-colors">Marketplace</button>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          className="text-xs font-bold text-brand-green-deep/60 hover:text-brand-green-deep transition-colors tracking-widest cursor-pointer px-4"
        >
          {t.nav.language}
        </button>
        <button 
          onClick={onPortalClick}
          className="px-4 md:px-5 py-2 text-xs md:text-sm font-bold text-brand-ivory bg-brand-green-deep rounded-full hover:bg-brand-green-mid transition-all shadow-sm active:scale-95"
        >
          {t.nav.portal}
        </button>
      </div>
    </motion.nav>
  );
}
