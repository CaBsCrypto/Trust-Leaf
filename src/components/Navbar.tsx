import { useRef, useState, type MouseEventHandler } from 'react';
import { Code2, Menu, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { BRAND_CHANNEL, BRAND_NAME, BRAND_TITLE } from '../lib/brand';

interface NavbarProps {
  onAccess: MouseEventHandler<HTMLAnchorElement>;
  showTechnicalDetails?: boolean;
  onToggleTechnicalDetails?: () => void;
}

const copy = {
  es: { nav: 'Navegación principal', care: 'Atención', network: 'Red', process: 'Cómo funciona', traceability: 'Trazabilidad', waitlist: 'Lista de espera', access: 'Acceder', menu: 'Abrir menú', close: 'Cerrar menú', language: 'View in English', technical: 'Detalles técnicos' },
  en: { nav: 'Main navigation', care: 'Care', network: 'Network', process: 'How it works', traceability: 'Traceability', waitlist: 'Waiting lists', access: 'Sign in', menu: 'Open menu', close: 'Close menu', language: 'Ver en español', technical: 'Technical details' },
};

export default function Navbar({ onAccess, showTechnicalDetails, onToggleTechnicalDetails }: NavbarProps) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const text = copy[language];

  return (
    <header className="tl-relieve-header">
      <nav className="tl-relieve-container tl-relieve-nav" aria-label={text.nav} onKeyDown={event => {
        if (event.key === 'Escape' && isOpen) {
          setIsOpen(false);
          toggle.current?.focus();
        }
      }}>
        <a className="tl-relieve-brand" href="#inicio" aria-label={BRAND_TITLE} onClick={() => setIsOpen(false)}>
          <span className="tl-relieve-brand-name">{BRAND_NAME}</span><span>{BRAND_CHANNEL}</span>
        </a>
        <button ref={toggle} type="button" className="tl-relieve-mobile-toggle"
          aria-label={isOpen ? text.close : text.menu} aria-expanded={isOpen} aria-controls="tl-relieve-nav-links"
          onClick={() => setIsOpen(open => !open)}>
          {isOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
        <div id="tl-relieve-nav-links" className="tl-relieve-nav-links" data-open={isOpen}>
          <a href="#profesionales" onClick={() => setIsOpen(false)}>{text.care}</a>
          <a href="#red" onClick={() => setIsOpen(false)}>{text.network}</a>
          <a href="#como-funciona" onClick={() => setIsOpen(false)}>{text.process}</a>
          <a href="#trazabilidad" onClick={() => setIsOpen(false)}>{text.traceability}</a>
          <a href="#lista-de-espera" onClick={() => setIsOpen(false)}>{text.waitlist}</a>
          {onToggleTechnicalDetails && <button type="button" className="tl-relieve-technical" title={text.technical}
            aria-label={text.technical} aria-pressed={Boolean(showTechnicalDetails)} onClick={onToggleTechnicalDetails}>
            <Code2 size={17} aria-hidden="true" />
          </button>}
          <button type="button" className="tl-relieve-language" title={text.language} aria-label={text.language}
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}>
            {language === 'es' ? 'EN' : 'ES'}
          </button>
          <a href="/paciente" className="tl-relieve-button tl-relieve-button-primary" onClick={onAccess}>{text.access}</a>
        </div>
      </nav>
    </header>
  );
}
