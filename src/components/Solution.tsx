import { motion } from 'motion/react';
import { CheckCircle2, Stethoscope, MapPin, Globe, ShieldCheck } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';

export default function Solution() {
  const { t } = useLanguage();

  return (
    <section id="solucion" className="py-12 md:py-16 overflow-hidden bg-white">
      <div className="container mx-auto px-6 md:px-12">
         <div className="flex flex-col lg:flex-row items-center gap-10 md:gap-16">
            <div className="lg:w-1/2 w-full">
               <motion.div
                 initial={{ opacity: 0, x: -30 }}
                 whileInView={{ opacity: 1, x: 0 }}
                 viewport={{ once: true }}
                 transition={{ duration: 0.8 }}
               >
                 <span className="text-brand-gold font-bold tracking-widest text-[10px] md:text-xs uppercase mb-4 block">{t.solution.badge}</span>
                 <h2 className="text-3xl md:text-5xl font-serif text-brand-green-deep mb-6 md:mb-8 leading-tight">
                   {t.solution.title}
                 </h2>
                 <div className="space-y-6">
                   {[
                      { icon: <Stethoscope className="text-brand-gold" size={24} />, title: t.solution.feature1Title, desc: t.solution.feature1Desc },
                      { icon: <MapPin className="text-brand-gold" />, title: t.solution.feature2Title, desc: t.solution.feature2Desc },
                      { icon: <Globe className="text-brand-gold" />, title: t.solution.feature3Title, desc: t.solution.feature3Desc }
                   ].map((item, i) => (
                     <div key={`solution-item-${i}`} className="flex gap-4 group">
                       <div className="mt-1 flex-shrink-0">{item.icon}</div>
                       <div>
                         <h4 className="font-bold text-brand-green-deep group-hover:text-brand-green-mid transition-colors text-base md:text-lg">{item.title}</h4>
                         <p className="text-brand-green-mid/70 text-sm md:text-base leading-relaxed">{item.desc}</p>
                       </div>
                     </div>
                   ))}
                 </div>
               </motion.div>
            </div>
            
            <div className="lg:w-1/2 w-full relative">
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 whileInView={{ opacity: 1, scale: 1 }}
                 viewport={{ once: true }}
                 className="relative z-10 p-2 bg-white shadow-[-20px_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-[40px] border border-brand-green-mid/5 overflow-hidden"
               >
                 <img 
                   src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=1200" 
                   alt="Trust ID Digitalization" 
                   className="rounded-[32px] w-full aspect-[4/5] lg:aspect-[5/6] object-cover"
                   referrerPolicy="no-referrer"
                 />
                 
                 {/* Floating Badges */}
                 <div className="absolute top-8 right-8">
                    <motion.div 
                      initial={{ x: 20, opacity: 0 }}
                      whileInView={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="bg-brand-green-deep text-brand-ivory p-4 rounded-2xl shadow-xl border border-white/10 backdrop-blur-sm"
                    >
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-brand-gold/20 rounded-full flex items-center justify-center">
                             <ShieldCheck className="text-brand-gold" size={20} />
                          </div>
                          <div>
                             <p className="text-[10px] uppercase tracking-widest font-bold opacity-60 leading-none mb-1">{t.solution.statusLabel}</p>
                             <p className="text-sm font-bold">{t.solution.statusValue}</p>
                          </div>
                       </div>
                    </motion.div>
                 </div>
                 
                 <div className="absolute bottom-8 left-8 right-8">
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-lg border border-brand-green-mid/5"
                    >
                       <div className="flex items-center justify-between gap-4">
                          <div className="flex -space-x-2">
                             {[1,2,3].map(i => (
                               <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-brand-ivory overflow-hidden">
                                 <img src={`https://i.pravatar.cc/100?u=user${i}`} alt="user" />
                               </div>
                             ))}
                          </div>
                          <p className="text-xs font-bold text-brand-green-deep">
                             +1,200 <span className="text-brand-green-mid/60 font-medium">{t.solution.connectedStats}</span>
                          </p>
                       </div>
                    </motion.div>
                 </div>
               </motion.div>
               
               {/* Decorative background elements */}
               <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-brand-gold/10 rounded-full blur-[80px] -z-10" />
               <div className="absolute -top-10 -right-10 w-64 h-64 bg-brand-green-mid/5 rounded-full blur-[100px] -z-10" />
            </div>
         </div>
      </div>
    </section>
  );
}
