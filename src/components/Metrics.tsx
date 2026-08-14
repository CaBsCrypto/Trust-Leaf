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
    <section className="relative py-10 md:py-12 overflow-hidden bg-slate-50 border-y border-slate-200/80">
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800 mb-6"
        >
          {t.metrics.title}
        </motion.p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {stats.map((s, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="text-center p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs"
            >
              <div className="text-3xl sm:text-4xl md:text-5xl font-light text-emerald-600 mb-1.5 tabular-nums">
                {s.value}
              </div>
              <div className="text-[10px] md:text-xs font-bold text-slate-600 uppercase tracking-[0.12em]">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
