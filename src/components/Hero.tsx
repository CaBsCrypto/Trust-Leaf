import { motion } from 'motion/react';
import { ArrowRight, Database, FileText, ShieldCheck } from 'lucide-react';

interface HeroProps {
  onStartClick: () => void;
}

import { useLanguage } from '../context/LanguageContext';

export default function Hero({ onStartClick }: HeroProps) {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[86vh] overflow-hidden bg-brand-green-deep text-brand-ivory">
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src="https://images.pexels.com/photos/6429022/pexels-photo-6429022.jpeg?auto=compress&cs=tinysrgb&w=2200"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-65"
          referrerPolicy="no-referrer"
        />
        <div className="absolute bottom-12 right-[5%] hidden h-[52%] w-[34%] max-w-[460px] items-end justify-center gap-5 opacity-75 md:flex">
          {['CBD 12:1', 'THC 10:10', 'NIGHT 5:2'].map((variant, index) => (
            <div
              key={variant}
              className={`relative flex flex-col items-center ${index === 1 ? 'mb-8 scale-110' : 'mb-0 scale-95'}`}
            >
              <div className="h-9 w-16 rounded-t-md border border-white/15 bg-[#26352f]/90 shadow-2xl" />
              <div className="relative h-48 w-24 overflow-hidden rounded-b-[28px] rounded-t-lg border border-white/20 bg-gradient-to-b from-amber-200/30 via-amber-700/35 to-amber-950/50 shadow-[0_26px_70px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                <div className="absolute inset-x-0 top-0 h-16 bg-white/18" />
                <div className="absolute bottom-8 left-1/2 w-[72px] -translate-x-1/2 border border-brand-gold/45 bg-brand-ivory/88 px-2 py-3 text-center text-brand-green-deep shadow-lg">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em]">Trust</p>
                  <p className="font-serif text-lg leading-none">Grass</p>
                  <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.14em] text-brand-green-mid">{variant}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="relative mb-4 ml-1 h-64 w-8 rotate-[-8deg] rounded-full border border-white/20 bg-gradient-to-b from-brand-ivory/55 via-brand-green-mid/50 to-brand-green-deep/80 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="absolute left-1/2 top-5 h-20 w-3 -translate-x-1/2 rounded-full bg-brand-gold/55" />
            <div className="absolute bottom-8 left-1/2 h-24 w-5 -translate-x-1/2 rounded-full bg-white/15" />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-brand-green-deep via-brand-green-deep/70 to-brand-green-deep/18" />
        <div className="absolute inset-0 bg-brand-green-deep/12" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-brand-ivory to-transparent" />
      <div className="container relative z-10 mx-auto flex min-h-[86vh] items-center px-6 pb-20 pt-28 md:px-12 md:pt-36">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block border border-brand-gold/35 bg-brand-green-deep/35 px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-brand-gold uppercase backdrop-blur-sm">
              {t.hero.badge}
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif leading-[1.02] mb-6 md:mb-8 font-medium">
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
                ['Flor y aceite', <FileText size={18} />],
                ['Cupo mensual', <Database size={18} />],
                ['Lote verificable', <ShieldCheck size={18} />],
              ].map(([label, icon]) => (
                <div key={label as string} className="flex items-center gap-3 border border-white/15 bg-brand-green-deep/30 px-4 py-3 text-sm font-bold backdrop-blur-sm">
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

