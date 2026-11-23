import type { MouseEventHandler } from 'react';
import { ArrowRight, ClipboardList, FileText } from 'lucide-react';
import botanicalRelief from '../assets/relieve-botanico.png';
import { useLanguage } from '../context/LanguageContext';

const copy = {
  es: {
    title: 'Tu cuidado, parte de tu historia.',
    description: 'Atención especializada en cannabis, con un enfoque de consulta y seguimiento.',
    process: 'Conocer el proceso',
    access: 'Acceder',
    record: 'Ficha clínica',
    episode: 'Atención cannabis',
    prescription: 'Receta médica',
    caption: 'Ejemplo ilustrativo. Una receta vinculada a la atención en la ficha clínica.',
  },
  en: {
    title: 'Your care is part of your story.',
    description: 'Specialist cannabis care, with a focus on consultation and follow-up.',
    process: 'Explore the process',
    access: 'Sign in',
    record: 'Clinical record',
    episode: 'Cannabis care',
    prescription: 'Medical prescription',
    caption: 'Illustrative example. A prescription linked to an episode of care in the clinical record.',
  },
};

function Lines({ count }: { count: number }) {
  return <div className="tl-relieve-lines">{Array.from({ length: count }, (_, index) => <i key={index} />)}</div>;
}

export default function Hero({ onAccess }: { onAccess: MouseEventHandler<HTMLAnchorElement> }) {
  const { language } = useLanguage();
  const text = copy[language];

  return (
    <section className="tl-relieve-hero" aria-labelledby="tl-relieve-title">
      <div className="tl-relieve-container tl-relieve-hero-layout">
        <div className="tl-relieve-hero-copy">
          <h1 id="tl-relieve-title">{text.title}</h1>
          <p>{text.description}</p>
          <div className="tl-relieve-hero-actions">
            <a className="tl-relieve-button tl-relieve-button-primary" href="#como-funciona">
              {text.process}<ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="tl-relieve-button tl-relieve-button-outline" href="/paciente" onClick={onAccess}>{text.access}</a>
          </div>
        </div>
        <figure className="tl-relieve-figure">
          <div className="tl-relieve-document-scene" aria-hidden="true">
            <div className="tl-relieve-ribbon" />
            <div className="tl-relieve-document tl-relieve-record">
              <div className="tl-relieve-document-title"><span className="tl-relieve-icon"><ClipboardList aria-hidden="true" /></span>{text.record}</div>
              <div className="tl-relieve-timeline">
                <div><Lines count={2} /></div>
                <div><span className="tl-relieve-episode">{text.episode}</span></div>
                <div><Lines count={2} /></div>
                <div><Lines count={1} /></div>
              </div>
            </div>
            <div className="tl-relieve-document tl-relieve-prescription">
              <div className="tl-relieve-document-title"><span className="tl-relieve-icon"><FileText aria-hidden="true" /></span>{text.prescription}</div>
              <Lines count={4} />
              <img className="tl-relieve-leaf" src={botanicalRelief} alt="" width="400" height="400" decoding="async" fetchPriority="high" />
            </div>
            <div className="tl-relieve-link-line"><span /></div>
          </div>
          <figcaption>{text.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}
