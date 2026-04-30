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
    <section className="py-16 bg-brand-ivory">
      <div className="container mx-auto px-6 md:px-12 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-serif text-brand-green-deep text-center mb-10">
          {t.faq.title}
        </h2>
        
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="border-b border-brand-green-mid/10">
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full py-6 flex items-center justify-between text-left group"
              >
                <span className="font-bold text-brand-green-deep group-hover:text-brand-green-mid transition-colors">
                  {item.q}
                </span>
                <ChevronDown 
                  className={`text-brand-gold transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`} 
                  size={20} 
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="pb-6 text-brand-green-mid/70 leading-relaxed text-sm">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
