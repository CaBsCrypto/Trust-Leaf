/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Solution from './components/Solution';
import Problem from './components/Problem';
import Process from './components/Process';
import Ecosystem from './components/Ecosystem';
import TrustDetail from './components/TrustDetail';
import FAQ from './components/FAQ';
import Metrics from './components/Metrics';
import PartnerCTA from './components/PartnerCTA';
import Footer from './components/Footer';
import MockupPortal, { PortalView } from './components/MockupPortal';

import { LanguageProvider, useLanguage } from './context/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function AppContent() {
  const { t } = useLanguage();
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [portalView, setPortalView] = useState<PortalView>('overview');

  const openPortal = (view: PortalView = 'overview') => {
    setPortalView(view);
    setIsPortalOpen(true);
  };

  return (
    <div className="min-h-screen selection:bg-brand-gold/30 selection:text-brand-green-deep relative overflow-hidden bg-brand-ivory">
      {/* Background elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-brand-green-mid/[0.03] rounded-full blur-[100px] translate-x-1/4 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-brand-gold/[0.03] rounded-full blur-[100px] -translate-x-1/4 translate-y-1/4" />
      </div>

      <Navbar onPortalClick={() => openPortal('overview')} />
      <main>
        <Hero onStartClick={openPortal} />
        <Ecosystem />
        <Problem />
        <Solution />
        <Metrics />
        <Process />
        <TrustDetail />
        <PartnerCTA />
        <FAQ />
        
        {/* Closure Section */}
        <section className="py-16 md:py-20 text-center px-6">
           <div className="max-w-2xl mx-auto text-brand-green-deep">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl sm:text-4xl md:text-6xl font-serif mb-6 md:mb-8 leading-tight"
              >
                 {t.closure.title}
              </motion.h2>
              <p className="text-brand-green-mid/70 mb-10 md:mb-12 leading-relaxed text-sm md:text-base max-w-lg mx-auto font-medium px-4">
                 {t.closure.desc}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 px-6 md:px-0">
                <button 
                   onClick={() => openPortal('overview')}
                   className="w-full sm:w-auto px-10 py-5 font-bold bg-brand-green-deep text-brand-ivory rounded-2xl md:rounded-full hover:bg-brand-green-mid transition-all shadow-xl active:scale-95 text-lg"
                >
                  {t.closure.cta}
                </button>
              </div>
           </div>
        </section>
      </main>
      <Footer />

      <MockupPortal 
        isOpen={isPortalOpen} 
        onClose={() => setIsPortalOpen(false)} 
        initialView={portalView}
      />
      </div>
  );
}


