import { motion } from 'motion/react';
import { Users, Stethoscope, Store, Sparkles, ShieldCheck } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';

export default function Ecosystem() {
  const { t } = useLanguage();
  const roles = [
    { title: t.ecosystem.item1, icon: <Users size={16} /> },
    { title: t.ecosystem.item2, icon: <Stethoscope size={16} /> },
    { title: t.ecosystem.item3, icon: <Store size={16} /> },
    { title: t.ecosystem.item4, icon: <Sparkles size={16} /> },
    { title: t.ecosystem.item5, icon: <ShieldCheck size={16} /> }
  ];

  return (
    <section id="ecosistema" className="py-8 md:py-12 border-y border-brand-green-deep/5">
      <div className="container mx-auto px-6 md:px-12 text-center md:text-left">
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 opacity-60">
          <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold text-brand-green-mid block w-full text-center md:w-auto mb-2 md:mb-0">
             {t.ecosystem.title}
          </span>
          {roles.map((role, i) => (
            <div key={`ecosystem-role-${i}`} className="flex items-center gap-2 md:grayscale md:hover:grayscale-0 transition-all cursor-default group">
              <div className="text-brand-green-mid group-hover:text-brand-green-deep transition-colors scale-90 md:scale-100">{role.icon}</div>
              <span className="text-[10px] md:text-xs font-bold text-brand-green-deep whitespace-nowrap">{role.title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
