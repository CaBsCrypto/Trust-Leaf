import { motion } from 'motion/react';
import { Stethoscope, FileDigit, MapPin, ArrowRight } from 'lucide-react';
import { PortalView } from './MockupPortal';

interface CompactExperienceProps {
  onStartClick: (view?: PortalView) => void;
}

import { useLanguage } from '../context/LanguageContext';

export default function CompactExperience({ onStartClick }: CompactExperienceProps) {
  const { t } = useLanguage();
  const steps = [
    {
      icon: <Stethoscope />,
      title: t.process.step1Title,
      desc: t.process.step1Desc,
      view: 'doctors' as PortalView
    },
    {
      icon: <FileDigit />,
      title: t.process.step2Title,
      desc: t.process.step2Desc,
      view: 'prescriptions' as PortalView
    },
    {
      icon: <MapPin />,
      title: t.process.step3Title,
      desc: t.process.step3Desc,
      view: 'dispensaries' as PortalView
    }
  ];

  return (
    <section id="experiencia" className="py-12 bg-white/40">
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-10 md:gap-12">
          <div className="md:w-1/3">
             <h2 className="text-3xl md:text-4xl font-serif text-brand-green-deep mb-6 leading-tight">
                {t.compact.title}
             </h2>
             <p className="text-brand-green-mid/70 text-sm md:text-base leading-relaxed mb-8 font-medium">
                {t.compact.subtitle}
             </p>
             <button 
                onClick={() => onStartClick('overview')}
                className="text-brand-green-deep font-bold flex items-center gap-2 group active:scale-95 transition-transform"
              >
                {t.compact.cta} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
          
          <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            {steps.map((step, i) => (
              <motion.div
                key={`compact-step-${i}`}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onStartClick(step.view)}
                className="p-6 bg-brand-ivory rounded-3xl border border-brand-green-deep/5 shadow-sm group cursor-pointer"
              >
                <div className="text-brand-gold mb-4 group-hover:scale-110 transition-transform">{step.icon}</div>
                <h4 className="font-bold text-brand-green-deep mb-2">{step.title}</h4>
                <p className="text-xs md:text-[13px] text-brand-green-mid/60 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

