import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';

export default function Metrics() {
  const { t } = useLanguage();
  
  const stats = [
    { label: t.metrics.m1Label, value: t.metrics.m1Value },
    { label: t.metrics.m2Label, value: t.metrics.m2Value },
    { label: t.metrics.m3Label, value: t.metrics.m3Value },
    { label: t.metrics.m4Label, value: t.metrics.m4Value }
  ];

  return (
    <section className="py-10 bg-white border-y border-brand-green-mid/5">
      <div className="container mx-auto px-6 md:px-12">
        <h2 className="text-center font-serif text-xl md:text-2xl text-brand-green-deep/30 mb-8 uppercase tracking-[0.2em]">
          {t.metrics.title}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((s, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-6xl font-serif text-brand-green-deep mb-2">
                {s.value}
              </div>
              <div className="text-xs md:text-sm font-bold text-brand-gold uppercase tracking-widest">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
