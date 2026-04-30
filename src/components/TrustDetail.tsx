import { motion } from 'motion/react';
import { ShieldCheck, Lock, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function TrustDetail() {
  const { t } = useLanguage();
  
  const features = [
    {
      icon: <Lock className="text-brand-gold" size={32} />,
      title: t.trust.card1Title,
      desc: t.trust.card1Desc
    },
    {
      icon: <Globe className="text-brand-gold" size={32} />,
      title: t.trust.card2Title,
      desc: t.trust.card2Desc
    },
    {
      icon: <ShieldCheck className="text-brand-gold" size={32} />,
      title: t.trust.card3Title,
      desc: t.trust.card3Desc
    }
  ];

  return (
    <section className="py-16 bg-brand-green-deep text-brand-ivory overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-gold rounded-full blur-[120px]" />
      </div>
      
      <div className="container mx-auto px-6 md:px-12 relative z-10 text-center">
        <motion.span 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-brand-gold font-bold tracking-widest text-xs uppercase mb-4 block"
        >
          {t.trust.badge}
        </motion.span>
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-serif mb-12"
        >
          {t.trust.title}
        </motion.h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {features.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="mb-6 inline-block p-4 bg-brand-gold/10 rounded-2xl">
                {f.icon}
              </div>
              <h4 className="text-xl font-bold mb-4">{f.title}</h4>
              <p className="text-brand-ivory/60 text-sm leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
