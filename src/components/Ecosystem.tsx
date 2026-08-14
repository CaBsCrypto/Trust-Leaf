import { motion } from 'motion/react';
import { Users, Stethoscope, Store, Sparkles, ShieldCheck } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';

export default function Ecosystem() {
  const { t } = useLanguage();
  const roles = [
    { title: t.ecosystem.item1, icon: <Users size={15} /> },
    { title: t.ecosystem.item2, icon: <Stethoscope size={15} /> },
    { title: t.ecosystem.item3, icon: <Store size={15} /> },
    { title: t.ecosystem.item4, icon: <Sparkles size={15} /> },
    { title: t.ecosystem.item5, icon: <ShieldCheck size={15} /> }
  ];

  return (
    <section id="ecosistema" className="relative py-4 md:py-5 overflow-hidden bg-slate-50 border-y border-slate-200/80">
      <div className="container relative z-10 mx-auto px-6 md:px-12 text-center md:text-left">
        <div className="flex flex-wrap justify-center items-center gap-5 md:gap-8">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 block w-full text-center md:w-auto mb-1 md:mb-0">
             {t.ecosystem.title}
          </span>
          {roles.map((role, i) => (
            <div key={`ecosystem-role-${i}`} className="flex items-center gap-2 group cursor-default">
              <div className="text-emerald-600 transition-transform duration-200 group-hover:scale-110">{role.icon}</div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-950 whitespace-nowrap transition-colors duration-200">{role.title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
