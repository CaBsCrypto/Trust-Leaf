import { Leaf, Instagram, Twitter, Linkedin, Github } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  
  return (
    <footer className="relative pt-12 pb-8 overflow-hidden bg-slate-50 border-t border-slate-200">
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-1.5 rounded-xl bg-emerald-100 border border-emerald-300 shadow-2xs">
                <Leaf size={18} className="text-emerald-700" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Trust<span className="text-emerald-600">Leaf</span>
              </span>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-6 font-normal">
              Redefiniendo el acceso y la confianza en la salud transfronteriza a través de un ecosistema premium y unificado.
            </p>
            <div className="flex gap-3">
              {[
                { icon: <Instagram size={16} />, href: '#' },
                { icon: <Twitter size={16} />, href: '#' },
                { icon: <Linkedin size={16} />, href: '#' },
                { icon: <Github size={16} />, href: 'https://github.com/CaBsCrypto/Trust-Leaf' },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600 hover:shadow-xs transition-all duration-200"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-10 md:gap-12">
            <div>
              <h5 className="font-bold text-slate-900 mb-4 uppercase text-[11px] tracking-[0.18em]">Network</h5>
              <ul className="space-y-2.5 text-sm text-slate-600 font-normal">
                <li><a href="#" className="hover:text-emerald-600 transition-colors duration-200">{t.footer.investors}</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors duration-200">{t.footer.partners}</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors duration-200">Strategic Advisors</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-slate-900 mb-4 uppercase text-[11px] tracking-[0.18em]">Compromiso</h5>
              <ul className="space-y-2.5 text-sm text-slate-600 font-normal">
                <li><a href="#" className="hover:text-emerald-600 transition-colors duration-200">{t.footer.privacy}</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors duration-200">{t.footer.legal}</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors duration-200">Compliance Hub</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-slate-900 mb-4 uppercase text-[11px] tracking-[0.18em]">Tech</h5>
              <ul className="space-y-2.5 text-sm text-slate-600 font-normal">
                <li><a href="https://stellar.org" target="_blank" rel="noopener" className="hover:text-emerald-600 transition-colors duration-200">Stellar Network</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors duration-200">Soroban Contracts</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors duration-200">Documentation</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="h-px bg-slate-200 mb-8" />
        <div className="text-center text-xs text-slate-500 font-semibold uppercase tracking-[0.15em]">
          <p>{t.footer.rights}</p>
        </div>
      </div>
    </footer>
  );
}
