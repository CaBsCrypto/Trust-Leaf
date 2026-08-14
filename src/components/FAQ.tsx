import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function FAQ() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const items = [
    { q: t.faq.q1, a: t.faq.a1 },
    { q: t.faq.q2, a: t.faq.a2 },
    { q: t.faq.q3, a: t.faq.a3 }
  ];

  return (
    <section id="faq" className="relative py-12 md:py-16 overflow-hidden bg-white">
      <div className="absolute inset-0 bg-white" />
      <div className="absolute inset-0 bg-radial-neon-bottom" />

      <div className="container relative z-10 mx-auto px-6 md:px-12 max-w-3xl">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 mb-2"
        >
          Preguntas frecuentes
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-light text-slate-950 text-center mb-8"
        >
          {t.faq.title}
        </motion.h2>
        
        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-2xl border transition-all duration-300 ${
                openIndex === i 
                  ? 'bg-emerald-50/40 border-emerald-300 shadow-sm' 
                  : 'bg-white border-slate-200/90 shadow-2xs hover:border-emerald-200'
              }`}
            >
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-5 flex items-center justify-between text-left group cursor-pointer"
              >
                <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors duration-200 text-sm md:text-base">
                  {item.q}
                </span>
                <ChevronDown 
                  className={`text-emerald-600 transition-transform duration-300 shrink-0 ml-4 ${openIndex === i ? 'rotate-180 text-emerald-700' : 'text-slate-400'}`} 
                  size={18} 
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-slate-600 leading-relaxed text-sm font-normal">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
