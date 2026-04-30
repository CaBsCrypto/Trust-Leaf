import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck, Stethoscope, Store } from 'lucide-react';
import { PortalView } from './MockupPortal';

interface HeroProps {
  onStartClick: (view?: PortalView) => void;
}

import { useLanguage } from '../context/LanguageContext';

export default function Hero({ onStartClick }: HeroProps) {
  const { t } = useLanguage();

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      <div className="container mx-auto px-6 md:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-brand-gold uppercase bg-brand-gold/10 rounded-full border border-brand-gold/20">
              {t.hero.badge}
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif text-brand-green-deep leading-[1.2] md:leading-[1.1] mb-6 md:mb-8 font-medium">
              {t.hero.title}
            </h1>
            <p className="text-base md:text-xl text-brand-green-mid/80 max-w-2xl mx-auto mb-10 leading-relaxed font-medium px-4 md:px-0">
              {t.hero.desc}
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 px-6 sm:px-0">
              <button 
                onClick={() => onStartClick('traveler')}
                className="px-10 py-5 text-base md:text-lg font-bold text-brand-ivory bg-brand-green-deep rounded-2xl md:rounded-[32px] hover:bg-brand-green-mid transition-all shadow-2xl shadow-brand-green-deep/30 flex items-center justify-center gap-3 group active:scale-95"
              >
                {t.hero.cta} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => onStartClick('overview')}
                className="px-10 py-5 text-base md:text-lg font-bold text-brand-green-deep border-2 border-brand-green-deep/10 bg-white/50 backdrop-blur-sm rounded-2xl md:rounded-[32px] hover:bg-white transition-all text-center active:scale-95 flex items-center justify-center gap-2"
              >
                <ShieldCheck size={20} className="text-brand-gold" /> {t.hero.secondary}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Decorative floral elements placeholder (could use SVGs) */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-green-mid/5 rounded-full blur-3xl -z-10" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl -z-10" />
    </section>
  );
}

