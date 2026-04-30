import { motion } from 'motion/react';
import { Mail } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function PartnerCTA() {
  const { t } = useLanguage();

  return (
    <section className="py-16 bg-brand-neutral/30">
      <div className="container mx-auto px-6 md:px-12">
        <div className="max-w-4xl mx-auto p-12 bg-white rounded-[40px] shadow-xl border border-brand-green-mid/5 relative overflow-hidden text-center md:text-left">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-serif text-brand-green-deep mb-6 leading-tight">
                {t.partners.title}
              </h2>
              <p className="text-brand-green-mid/70 text-lg leading-relaxed mb-0 font-medium">
                {t.partners.subtitle}
              </p>
            </div>
            
            <div>
              <button className="px-8 py-5 bg-brand-green-deep text-brand-ivory rounded-2xl font-bold hover:bg-brand-green-mid transition-all shadow-xl shadow-brand-green-deep/10 flex items-center gap-3 whitespace-nowrap active:scale-95">
                <Mail size={20} /> {t.partners.cta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
