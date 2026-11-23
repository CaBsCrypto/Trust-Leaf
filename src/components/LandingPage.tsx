import type { MouseEvent } from 'react';
import { ArrowRight, CalendarDays, FileText, HeartPulse, PackageCheck, Stethoscope, UserRound } from 'lucide-react';
import Hero from './Hero';
import Navbar from './Navbar';
import DispensaryTraceability from './DispensaryTraceability';
import CannabisWaitlists from './CannabisWaitlists';
import { useLanguage } from '../context/LanguageContext';
import { BRAND_NAME } from '../lib/brand';
import './cannabis-landing.css';

const copy = {
  es: {
    skip: 'Saltar al contenido',
    process: 'Cómo funciona',
    processSteps: [
      ['Consulta', 'Conoce el recorrido de atención y conversa con un profesional sobre tu situación.'],
      ['Receta', 'Cuando corresponde una indicación médica, la receta acompaña tu atención.'],
      ['Continuidad', 'Consulta tus tratamientos y los próximos pasos de tu cuidado en tu portal.'],
    ],
    network: 'Una atención que continúa',
    networkDescription: 'Pacientes, profesionales y dispensarios participan en momentos distintos del cuidado. Cada perfil cuenta con su propio espacio y sus accesos.',
    portals: 'Accede a tu espacio',
    roles: [
      ['Pacientes', 'Consulta tus citas, tratamientos y seguimiento.'],
      ['Profesionales', 'Accede a tu agenda y a las herramientas de atención.'],
      ['Dispensarios', 'Accede al inventario y a las entregas autorizadas de tu organización.'],
    ],
    admin: 'Administración',
    ecosystem: `Parte del ecosistema ${BRAND_NAME}`,
    demo: 'Demostración de verificación',
  },
  en: {
    skip: 'Skip to content',
    process: 'How it works',
    processSteps: [
      ['Consultation', 'Learn how care works and talk with a professional about your situation.'],
      ['Prescription', 'When a prescription is appropriate, it becomes part of your care.'],
      ['Continuity', 'Review your treatment and next steps in the patient portal.'],
    ],
    network: 'Care that continues',
    networkDescription: 'Patients, professionals, and dispensaries contribute at different points in your care. Each has a dedicated space and access.',
    portals: 'Go to your portal',
    roles: [
      ['Patients', 'Review your appointments, treatments, and follow-up.'],
      ['Professionals', 'Open your schedule and care tools.'],
      ['Dispensaries', 'Access your organisation’s inventory and authorised deliveries.'],
    ],
    admin: 'Administration',
    ecosystem: `Part of the ${BRAND_NAME} ecosystem`,
    demo: 'Verification demo',
  },
};

const steps = [CalendarDays, FileText, HeartPulse];
const portals = [
  { path: '/paciente', Icon: UserRound },
  { path: '/medico', Icon: Stethoscope },
  { path: '/dispensario', Icon: PackageCheck },
];

interface LandingPageProps {
  onNavigate: (path: string) => void;
  showTechnicalDetails?: boolean;
  onToggleTechnicalDetails?: () => void;
}

export default function LandingPage({ onNavigate, showTechnicalDetails = false, onToggleTechnicalDetails }: LandingPageProps) {
  const { language } = useLanguage();
  const text = copy[language];

  const navigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(path);
  };

  return (
    <div id="inicio" className="tl-relieve" lang={language}>
      <a className="tl-relieve-skip" href="#contenido">{text.skip}</a>
      <Navbar onAccess={event => navigate(event, '/paciente')} showTechnicalDetails={showTechnicalDetails} onToggleTechnicalDetails={onToggleTechnicalDetails} />
      <main id="contenido" tabIndex={-1}>
        <Hero onAccess={event => navigate(event, '/paciente')} />

        <section id="como-funciona" className="tl-relieve-container tl-relieve-process" aria-labelledby="tl-relieve-process-title" tabIndex={-1}>
          <h2 id="tl-relieve-process-title">{text.process}</h2>
          <ol>
            {text.processSteps.map(([title, description], index) => {
              const Icon = steps[index];
              return (
                <li key={index}>
                  <span className="tl-relieve-icon"><Icon size={25} aria-hidden="true" /></span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </li>
              );
            })}
          </ol>
        </section>

        <section id="red" className="tl-relieve-network" aria-labelledby="tl-relieve-network-title" tabIndex={-1}>
          <div className="tl-relieve-container">
            <h2 id="tl-relieve-network-title">{text.network}</h2>
            <p>{text.networkDescription}</p>
          </div>
        </section>

        <DispensaryTraceability />
        <CannabisWaitlists />

        <section id="profesionales" className="tl-relieve-container tl-relieve-portals" aria-labelledby="tl-relieve-portals-title" tabIndex={-1}>
          <h2 id="tl-relieve-portals-title">{text.portals}</h2>
          <ul>
            {portals.map(({ path, Icon }, index) => (
              <li key={path}>
                <a href={path} onClick={event => navigate(event, path)}>
                  <span className="tl-relieve-icon"><Icon size={23} aria-hidden="true" /></span>
                  <span><strong>{text.roles[index][0]}</strong><span>{text.roles[index][1]}</span></span>
                  <ArrowRight className="tl-relieve-role-arrow" size={19} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="tl-relieve-footer">
        <div className="tl-relieve-container">
          <span className="tl-relieve-brand-name">{BRAND_NAME}</span>
          <p>{text.ecosystem}</p>
          <div>
            {showTechnicalDetails && <a href="/demo/receipt-pilot" onClick={event => navigate(event, '/demo/receipt-pilot')}>{text.demo}</a>}
            <a href="/admin" onClick={event => navigate(event, '/admin')}>{text.admin}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
