import { motion } from 'motion/react';
import { Mail, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function PartnerCTA() {
  const { t } = useLanguage();

  return (
    <section className="relative py-10 md:py-14 overflow-hidden bg-white">
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-3xl p-6 sm:p-8 md:p-10 relative overflow-hidden bg-gradient-to-br from-emerald-50/70 to-slate-50 border border-emerald-200/90 shadow-sm"
        >
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-200/30 rounded-full blur-[90px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10 relative z-10">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800 mb-3">Colabora con nosotros</p>
              <h2 className="text-3xl md:text-4xl font-light text-slate-950 mb-3 leading-tight">
                {t.partners.title}
              </h2>
              <p className="text-slate-600 text-base leading-relaxed font-normal">
                {t.partners.subtitle}
              </p>
            </div>
            
            <div className="shrink-0">
              <button className="btn-neon-fill !py-4 !px-8 !text-sm !font-bold !rounded-2xl whitespace-nowrap shadow-md">
                <Mail size={18} /> {t.partners.cta}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
