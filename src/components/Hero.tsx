import { motion } from 'motion/react';
import { ArrowRight, Shield, Leaf, Sparkles } from 'lucide-react';
import ThreeUserCard from './ThreeUserCard';

interface HeroProps {
  onStartClick: () => void;
  onNavigate?: (path: string) => void;
}

import { useLanguage } from '../context/LanguageContext';

export default function Hero({ onStartClick, onNavigate }: HeroProps) {
  const { t } = useLanguage();
  const handleCardNavigate = onNavigate || ((path: string) => {
    if (path === '/medico' || path === '/dispensario' || path === '/paciente') {
      window.location.href = path;
    }
  });

  return (
    <section className="relative overflow-hidden flex items-center bg-white pt-20 pb-8 md:pt-24 md:pb-12">
      {/* Background layers */}
      <div aria-hidden="true" className="absolute inset-0">
        {/* Base white */}
        <div className="absolute inset-0 bg-white" />
        {/* Soft emerald radial glow */}
        <div className="absolute inset-0 bg-radial-neon" />
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(5,150,105,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(5,150,105,0.4) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* Floating orbs */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[12%] left-[8%] w-72 h-72 rounded-full bg-emerald-100/35 blur-[90px] animate-float" />
        <div className="absolute bottom-[15%] right-[8%] w-96 h-96 rounded-full bg-purple-100/35 blur-[110px] animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[35%] right-[25%] w-60 h-60 rounded-full bg-teal-50/40 blur-[80px] animate-float" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Content Grid */}
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          
          {/* Left Column: Hero Copy & Actions */}
          <div className="lg:col-span-7 max-w-2xl">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.18em] uppercase rounded-full bg-emerald-50 border border-emerald-200/90 text-emerald-800 shadow-2xs">
                <Shield size={13} className="text-emerald-600" />
                Stellar Soroban · Chile
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-4 sm:mt-5 text-3xl sm:text-5xl md:text-5xl lg:text-6xl font-extralight leading-[1.1] tracking-tight text-slate-950"
            >
              Tu receta médica.
              <br />
              <span className="text-emerald-600 font-semibold">Blindada</span> en blockchain.
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-3.5 max-w-xl text-sm sm:text-base md:text-lg font-normal leading-relaxed text-slate-600"
            >
              Infraestructura de privacidad y trazabilidad para prescripciones reguladas de cannabis medicinal. Sin contraseñas. Sin intermediarios.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4"
            >
              <button onClick={onStartClick} className="btn-neon-fill !py-3.5 !px-7 !text-sm !font-bold !rounded-2xl shadow-md">
                Comenzar ahora
                <ArrowRight size={16} />
              </button>
              <button 
                onClick={() => {
                  const el = document.getElementById('red');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn-neon-outline !py-3.5 !px-7 !text-sm !rounded-2xl"
              >
                Explorar la red
              </button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="mt-7 flex flex-wrap gap-2.5 md:gap-3.5"
            >
              {[
                { label: 'Privacidad Zero-Knowledge', icon: '🔐' },
                { label: 'Firma con biometría Passkey', icon: '🫰' },
                { label: 'Trazabilidad inmutable', icon: '⛓️' },
              ].map((item) => (
                <div 
                  key={item.label} 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  <span className="text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right Column: 3D User Card (9:16 vertical) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex justify-center items-center relative py-2"
          >
            <ThreeUserCard onNavigate={handleCardNavigate} />
          </motion.div>

        </div>
      </div>

      {/* Bottom line */}
      <div className="absolute bottom-0 left-0 right-0 neon-line" />
    </section>
  );
}
