import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Database, FileText, ShieldCheck, X } from 'lucide-react';

interface HeroProps {
  onStartClick: () => void;
}

import { useLanguage } from '../context/LanguageContext';

export default function Hero({ onStartClick }: HeroProps) {
  const { t } = useLanguage();
  const [activeModal, setActiveModal] = useState<'flor' | 'dosis' | 'lote' | null>(null);

  const modalData = {
    flor: {
      title: 'Formatos Clínicos: Flor y Aceite',
      icon: <FileText className="h-10 w-10 text-brand-gold animate-pulse" />,
      desc: 'La dApp de Trust Leaf admite la prescripción digital estandarizada tanto de flores de grado farmacéutico (cannabis seco) como de aceites purificados y extractos dosificados de espectro completo o aislados.',
      bullets: [
        'Estandarización química del perfil de fitofármacos con proporciones exactas de THC/CBD.',
        'Soporte completo para vaporización clínica y dosificación sublingual controlada.',
        'Bloqueo automático en blockchain ante intentos de entrega de formatos no autorizados por el médico.'
      ]
    },
    dosis: {
      title: 'Control Cuantitativo e Inmutabilidad de Dosis',
      icon: <Database className="h-10 w-10 text-brand-gold animate-pulse" />,
      desc: 'Evita cualquier sobredosificación o abuso de recetas mediante un control riguroso de miligramos activos y concentraciones específicas grabados en el contrato Soroban de manera inalterable.',
      bullets: [
        'Descuento automático de dosis por cada retiro parcial del paciente en el dispensario.',
        'Bloqueo automático del Ledger cuando el saldo restante llega exactamente a 0.',
        'Prevención criptográfica de duplicidad de recetas o "doble retiro" en múltiples farmacias.'
      ]
    },
    lote: {
      title: 'Lote Farmacéutico Verificable y Co-trazabilidad',
      icon: <ShieldCheck className="h-10 w-10 text-brand-gold animate-pulse" />,
      desc: 'Garantiza la legalidad del fitofármaco vinculando la prescripción médica con el código de lote y procedencia de cultivo autorizada a través de hashes SHA-256 en la blockchain de Stellar.',
      bullets: [
        'Validación instantánea en farmacia del origen legítimo del cannabis y fecha de cosecha.',
        'Transparencia absoluta para inspectores sanitarios y entes gubernamentales reguladores.',
        'Blindaje de la cadena de suministro medicinal contra el mercado gris y falsificaciones.'
      ]
    }
  };

  return (
    <section className="relative min-h-[86vh] overflow-hidden bg-brand-green-deep text-brand-ivory">
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src="https://images.pexels.com/photos/6429022/pexels-photo-6429022.jpeg?auto=compress&cs=tinysrgb&w=2200"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[42%_center] opacity-78 md:object-center"
          referrerPolicy="no-referrer"
        />
        <img
          src="https://cdn.pixabay.com/photo/2020/11/16/12/33/cannabis-5748860_1280.jpg"
          alt=""
          className="absolute bottom-[1%] right-[-35%] h-[44%] w-[88%] object-cover object-center opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_46%,transparent_80%)] sm:right-[-20%] sm:w-[70%] md:bottom-[6%] md:right-[1%] md:h-[52%] md:w-[34%] md:opacity-72 md:[mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_82%)]"
          referrerPolicy="no-referrer"
        />
        <img
          src="https://images.pexels.com/photos/9419514/pexels-photo-9419514.jpeg?auto=compress&cs=tinysrgb&w=1200"
          alt=""
          className="absolute right-[-18%] top-[34%] h-[30%] w-[58%] rotate-[-5deg] object-cover object-center opacity-46 [mask-image:radial-gradient(ellipse_at_center,black_38%,transparent_76%)] sm:right-[-2%] sm:top-[26%] sm:w-[44%] md:right-[12%] md:top-[13%] md:h-[32%] md:w-[30%] md:opacity-50 lg:right-[19%] lg:top-[12%] lg:h-[36%] lg:w-[28%] lg:opacity-58"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-green-deep/94 via-brand-green-deep/62 to-brand-green-deep/8 md:from-brand-green-deep/92 md:via-brand-green-deep/58 md:to-brand-green-deep/12" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-green-deep/22 via-transparent to-brand-green-deep/24 md:to-brand-green-deep/30" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
      <div className="container relative z-10 mx-auto flex min-h-[86vh] items-center px-6 pb-16 pt-28 md:px-12 md:pt-36">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block border border-brand-gold/35 bg-brand-green-deep/35 px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-brand-gold uppercase backdrop-blur-sm">
              {t.hero.badge}
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif leading-[1.02] mb-6 md:mb-8 font-medium">
              {t.hero.title}
            </h1>
            <p className="text-base md:text-xl text-brand-ivory/78 max-w-2xl mb-10 leading-relaxed font-medium">
              {t.hero.desc}
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button 
                onClick={onStartClick}
                className="px-10 py-5 text-base md:text-lg font-bold text-brand-green-deep bg-brand-gold rounded-2xl hover:bg-brand-ivory transition-all shadow-2xl shadow-brand-green-deep/30 flex items-center justify-center gap-3 group active:scale-95 cursor-pointer"
              >
                {t.hero.cta} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { id: 'flor', label: 'Flor y aceite', icon: <FileText size={18} /> },
                { id: 'dosis', label: 'Dosis autorizada', icon: <Database size={18} /> },
                { id: 'lote', label: 'Lote verificable', icon: <ShieldCheck size={18} /> },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveModal(id as 'flor' | 'dosis' | 'lote')}
                  className="flex items-center gap-3 border border-white/15 bg-brand-green-deep/30 px-4 py-3 text-sm font-bold backdrop-blur-sm text-left hover:bg-white/15 transition-all select-none hover:border-brand-gold/40 hover:-translate-y-0.5 duration-300 cursor-pointer w-full text-brand-ivory group"
                >
                  <span className="text-brand-gold group-hover:scale-110 transition-transform">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modal Popup overlay */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-green-deep/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-lg overflow-hidden border border-brand-gold/20 bg-brand-green-deep/95 p-8 shadow-2xl rounded-2xl"
          >
            {/* Background absolute accents */}
            <div className="absolute top-0 right-0 h-40 w-40 bg-brand-gold/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 h-40 w-40 bg-brand-gold/5 rounded-full blur-3xl" />

            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2 text-brand-ivory/60 hover:text-brand-gold transition-colors cursor-pointer rounded-lg hover:bg-white/5"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-brand-gold/10 rounded-xl border border-brand-gold/20">
                {modalData[activeModal].icon}
              </div>
              <h2 className="text-xl md:text-2xl font-serif text-brand-gold font-semibold leading-snug">
                {modalData[activeModal].title}
              </h2>
            </div>

            <p className="text-brand-ivory/85 text-sm md:text-base leading-relaxed mb-6">
              {modalData[activeModal].desc}
            </p>

            <div className="border-t border-white/10 pt-5">
              <h3 className="text-xs font-semibold text-brand-gold uppercase tracking-wider mb-3">
                Características Clínicas
              </h3>
              <ul className="space-y-2.5">
                {modalData[activeModal].bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-brand-ivory/75 leading-relaxed">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-gold mt-1.5 shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <button 
              onClick={() => setActiveModal(null)}
              className="mt-8 w-full py-3.5 bg-brand-gold hover:bg-brand-ivory text-brand-green-deep font-bold transition-all rounded-xl cursor-pointer active:scale-[0.98] text-sm"
            >
              Entendido
            </button>
          </motion.div>
        </div>
      )}
    </section>
  );
}

