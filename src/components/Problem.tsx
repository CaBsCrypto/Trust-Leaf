import { motion } from 'motion/react';
import { XCircle, AlertCircle } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';

export default function Problem() {
  const { t } = useLanguage();

  return (
    <section id="problem" className="py-16 bg-brand-neutral/50">
      <div className="container mx-auto px-6 md:px-12 text-center">
        <motion.div
           initial={{ opacity: 0 }}
           whileInView={{ opacity: 1 }}
           viewport={{ once: true }}
           transition={{ duration: 0.8 }}
           className="max-w-3xl mx-auto"
        >
          <h2 className="text-4xl md:text-5xl font-serif text-brand-green-deep mb-6 leading-tight">
            {t.problem.title}
          </h2>
          <p className="text-lg text-brand-green-mid/70 mb-16 leading-relaxed">
            {t.problem.desc}
          </p>
        </motion.div>
  
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left max-w-5xl mx-auto">
          <div className="space-y-8">
            <div className="flex gap-4 p-8 bg-white rounded-3xl shadow-sm border border-red-50 hover:shadow-xl hover:shadow-red-500/5 transition-all group">
              <div className="text-red-400 shrink-0 group-hover:scale-110 transition-transform"><XCircle size={28} /></div>
              <div>
                <h4 className="font-bold text-brand-green-deep mb-1 text-lg">{t.problem.card1Title}</h4>
                <p className="text-sm text-brand-green-mid/70">{t.problem.card1Desc}</p>
              </div>
            </div>
            <div className="flex gap-4 p-8 bg-white rounded-3xl shadow-sm border border-red-50 hover:shadow-xl hover:shadow-red-500/5 transition-all group">
              <div className="text-red-400 shrink-0 group-hover:scale-110 transition-transform"><AlertCircle size={28} /></div>
              <div>
                <h4 className="font-bold text-brand-green-deep mb-1 text-lg">{t.problem.card2Title}</h4>
                <p className="text-sm text-brand-green-mid/70">{t.problem.card2Desc}</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col justify-center">
             <div className="p-8 bg-brand-green-deep rounded-3xl text-brand-ivory relative overflow-hidden group">
                <span className="text-xs uppercase tracking-widest text-brand-gold font-bold mb-4 block">{t.problem.oldExpTitle}</span>
                <p className="text-xl font-serif italic leading-relaxed mb-6">
                  "{t.problem.oldExpQuote}"
                </p>
                <div className="h-1 w-20 bg-brand-gold group-hover:w-full transition-all duration-700" />
             </div>
          </div>
        </div>
      </div>
    </section>
  );
}
