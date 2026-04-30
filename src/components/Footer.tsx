import { Leaf, Instagram, Twitter, Linkedin } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  
  return (
    <footer className="py-20 bg-brand-ivory border-t border-brand-green-deep/5 overflow-hidden">
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-1.5 bg-brand-green-deep rounded-lg text-brand-ivory">
                <Leaf size={20} />
              </div>
              <span className="text-xl font-bold tracking-tight text-brand-green-deep italic">Trust Leaf</span>
            </div>
            <p className="text-brand-green-mid/60 text-sm leading-relaxed mb-6 font-medium">
              Redefiniendo el acceso y la confianza en la salud transfronteriza a través de un ecosistema premium y unificado.
            </p>
            <div className="flex gap-4">
              <a href="#" className="p-2 bg-brand-neutral rounded-full text-brand-green-deep hover:bg-brand-green-deep hover:text-brand-ivory transition-all"><Instagram size={18} /></a>
              <a href="#" className="p-2 bg-brand-neutral rounded-full text-brand-green-deep hover:bg-brand-green-deep hover:text-brand-ivory transition-all"><Twitter size={18} /></a>
              <a href="#" className="p-2 bg-brand-neutral rounded-full text-brand-green-deep hover:bg-brand-green-deep hover:text-brand-ivory transition-all"><Linkedin size={18} /></a>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            <div>
              <h5 className="font-bold text-brand-green-deep mb-6 uppercase text-xs tracking-widest">Network</h5>
              <ul className="space-y-4 text-sm text-brand-green-mid/70 font-medium">
                <li><a href="#" className="hover:text-brand-green-deep transition-colors">{t.footer.investors}</a></li>
                <li><a href="#" className="hover:text-brand-green-deep transition-colors">{t.footer.partners}</a></li>
                <li><a href="#" className="hover:text-brand-green-deep transition-colors">Strategic Advisors</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-brand-green-deep mb-6 uppercase text-xs tracking-widest">Compromiso</h5>
              <ul className="space-y-4 text-sm text-brand-green-mid/70 font-medium">
                <li><a href="#" className="hover:text-brand-green-deep transition-colors">{t.footer.privacy}</a></li>
                <li><a href="#" className="hover:text-brand-green-deep transition-colors">{t.footer.legal}</a></li>
                <li><a href="#" className="hover:text-brand-green-deep transition-colors">Compliance Hub</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="pt-12 border-t border-brand-green-deep/5 text-center text-[10px] text-brand-green-mid/40 font-bold uppercase tracking-[0.2em] md:tracking-[0.3em]">
          <p>{t.footer.rights}</p>
        </div>
      </div>
    </footer>
  );
}
