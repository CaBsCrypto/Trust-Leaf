import { motion } from 'motion/react';
import { ArrowRight, Database, FileText, ShieldCheck } from 'lucide-react';

interface HeroProps {
  onStartClick: () => void;
}

import { useLanguage } from '../context/LanguageContext';

export default function Hero({ onStartClick }: HeroProps) {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[88vh] overflow-hidden bg-brand-green-deep text-brand-ivory">
      <img
        src="https://images.pexels.com/photos/6442512/pexels-photo-6442512.jpeg?auto=compress&cs=tinysrgb&w=1800"
        alt="Aceites de cannabis medicinal en frascos de tratamiento"
        className="absolute inset-0 h-full w-full object-cover opacity-42"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-brand-green-deep/68" />
      <div className="container relative z-10 mx-auto flex min-h-[88vh] items-center px-6 pb-16 pt-32 md:px-12 md:pt-40">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-brand-gold uppercase bg-brand-gold/10 border border-brand-gold/20">
              {t.hero.badge}
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-serif leading-[1.05] mb-6 md:mb-8 font-medium">
              {t.hero.title}
            </h1>
            <p className="text-base md:text-xl text-brand-ivory/78 max-w-2xl mb-10 leading-relaxed font-medium">
              {t.hero.desc}
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button 
                onClick={onStartClick}
                className="px-10 py-5 text-base md:text-lg font-bold text-brand-green-deep bg-brand-gold rounded-2xl hover:bg-brand-ivory transition-all shadow-2xl shadow-brand-green-deep/30 flex items-center justify-center gap-3 group active:scale-95"
              >
                {t.hero.cta} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={onStartClick}
                className="px-10 py-5 text-base md:text-lg font-bold text-brand-ivory border border-white/20 bg-white/10 backdrop-blur-sm rounded-2xl hover:bg-white/15 transition-all text-center active:scale-95 flex items-center justify-center gap-2"
              >
                <ShieldCheck size={20} className="text-brand-gold" /> {t.hero.secondary}
              </button>
            </div>

            <div className="mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['Expediente privado', <FileText size={18} />],
                ['Cupo mensual', <Database size={18} />],
                ['Trazabilidad por lote', <ShieldCheck size={18} />],
              ].map(([label, icon]) => (
                <div key={label as string} className="flex items-center gap-3 border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold backdrop-blur-sm">
                  <span className="text-brand-gold">{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

