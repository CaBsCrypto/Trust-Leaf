import { motion } from 'motion/react';
import { ArrowRight, Database, Droplets, FileText, ShieldCheck, Wind } from 'lucide-react';

interface HeroProps {
  onStartClick: () => void;
}

import { useLanguage } from '../context/LanguageContext';

export default function Hero({ onStartClick }: HeroProps) {
  const { t } = useLanguage();
  const treatmentFormats = [
    {
      label: 'Flores',
      detail: 'Lote trazable',
      icon: <FileText size={16} />,
      image: 'https://images.pexels.com/photos/6429022/pexels-photo-6429022.jpeg?auto=compress&cs=tinysrgb&w=500',
    },
    {
      label: 'Aceites',
      detail: 'Dosis verificable',
      icon: <Droplets size={16} />,
      image: 'https://images.pexels.com/photos/12996477/pexels-photo-12996477.jpeg?auto=compress&cs=tinysrgb&w=500',
    },
    {
      label: 'Vaporizables',
      detail: 'Uso controlado',
      icon: <Wind size={16} />,
      image: 'https://images.pexels.com/photos/29612649/pexels-photo-29612649.jpeg?auto=compress&cs=tinysrgb&w=500',
    },
  ];

  return (
    <section className="relative min-h-[86vh] overflow-hidden bg-brand-green-deep text-brand-ivory">
      <img
        src="https://images.pexels.com/photos/6429022/pexels-photo-6429022.jpeg?auto=compress&cs=tinysrgb&w=2000"
        alt="Flor de cannabis medicinal con tricomas visibles"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-green-deep via-brand-green-deep/76 to-brand-green-deep/18" />
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

            <div className="mt-5 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 lg:hidden">
              {treatmentFormats.map((format) => (
                <div key={format.label} className="overflow-hidden border border-white/15 bg-brand-green-deep/35 backdrop-blur-sm">
                  <img src={format.image} alt={format.label} className="h-20 w-full object-cover opacity-85" referrerPolicy="no-referrer" />
                  <div className="p-3">
                    <p className="text-xs font-bold">{format.label}</p>
                    <p className="mt-1 text-[10px] text-brand-ivory/60">{format.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-14 right-8 z-10 hidden w-[360px] grid-cols-1 gap-3 xl:grid">
        {treatmentFormats.map((format, index) => (
          <motion.div
            key={format.label}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + index * 0.08, duration: 0.5 }}
            className="grid grid-cols-[92px_1fr] overflow-hidden border border-white/15 bg-brand-green-deep/45 shadow-xl backdrop-blur-md"
          >
            <img src={format.image} alt={format.label} className="h-24 w-full object-cover" referrerPolicy="no-referrer" />
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand-gold text-brand-green-deep">
                {format.icon}
              </div>
              <div>
                <p className="text-sm font-bold">{format.label}</p>
                <p className="mt-1 text-xs text-brand-ivory/60">{format.detail}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

