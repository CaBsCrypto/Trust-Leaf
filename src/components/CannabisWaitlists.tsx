import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ChevronRight, PackageCheck, Stethoscope, UserRound, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { CANNABIS_WAITLIST_PATH, CANNABIS_WAITLIST_REVIEW_MODE, waitlistAudiences, type WaitlistAudience } from '../lib/waitlist';
import './cannabis-waitlists.css';

const details = {
  patient: { anchor: 'lista-de-espera-paciente', icon: UserRound },
  doctor: { anchor: 'lista-de-espera-medico', icon: Stethoscope },
  dispensary: { anchor: 'lista-de-espera-dispensario', icon: PackageCheck },
};

const copy = {
  es: {
    title: 'Listas de espera',
    previewNotice: 'Vista local. Usa un correo de prueba. La inscripción se conserva en este equipo.',
    inactiveNotice: 'Inscripciones aún sin habilitar.',
    close: 'Cerrar',
    labels: { patient: 'Pacientes', doctor: 'Médicos', dispensary: 'Dispensarios' },
    email: 'Correo electrónico',
    submit: 'Inscribirme',
    sending: 'Registrando…',
    error: 'No pudimos registrar tu correo. Intenta de nuevo.',
    success: 'Tu correo quedó registrado.',
    audiences: {
      patient: { title: 'Lista de espera para pacientes', description: 'Para recibir novedades sobre el acceso a consulta y seguimiento.', success: 'Inscripción de prueba registrada para pacientes.' },
      doctor: { title: 'Lista de espera para médicos', description: 'Para recibir novedades sobre el piloto y las herramientas de atención.', success: 'Inscripción de prueba registrada para médicos.' },
      dispensary: { title: 'Lista de espera para dispensarios', description: 'Para conocer el piloto de dispensación, inventario y trazabilidad.', success: 'Inscripción de prueba registrada para dispensarios.' },
    },
  },
  en: {
    title: 'Waiting lists',
    previewNotice: 'Local preview. Use a test email. Your signup is stored on this device.',
    inactiveNotice: 'Signups are currently unavailable.',
    close: 'Close',
    labels: { patient: 'Patients', doctor: 'Physicians', dispensary: 'Dispensaries' },
    email: 'Email address',
    submit: 'Join list',
    sending: 'Registering…',
    error: 'We could not register your email. Please try again.',
    success: 'Your email has been registered.',
    audiences: {
      patient: { title: 'Waiting list for patients', description: 'Get updates about access to consultations and follow-up care.', success: 'Test signup registered for patients.' },
      doctor: { title: 'Waiting list for physicians', description: 'Get updates about the pilot and tools for clinical care.', success: 'Test signup registered for physicians.' },
      dispensary: { title: 'Waiting list for dispensaries', description: 'Learn about the dispensing, inventory and traceability pilot.', success: 'Test signup registered for dispensaries.' },
    },
  },
};

function WaitlistDialog({ audience, localReview, text, onClose }: { audience: WaitlistAudience; localReview: boolean; text: (typeof copy)[keyof typeof copy]; onClose: () => void }) {
  const field = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const audienceText = text.audiences[audience];

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      emailInput.current?.focus();
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;
    const form = event.currentTarget;
    const email = new FormData(form).get('email');
    if (typeof email !== 'string') return;

    setState('sending');
    try {
      const response = await fetch(CANNABIS_WAITLIST_PATH, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, email: email.trim() }), cache: 'no-store',
      });
      if (!response.ok || (await response.json()).registered !== true) throw new Error('SIGNUP_UNAVAILABLE');
      form.reset();
      setState('success');
    } catch {
      setState('error');
    }
  }

  return (
    <dialog ref={dialog} className="tl-waitlist-dialog" aria-labelledby={`${field}-title`} aria-describedby={`${field}-description`} onClose={onClose}>
      <div className="tl-waitlist-dialog-header">
        <h3 id={`${field}-title`}>{audienceText.title}</h3>
        <button className="tl-waitlist-close" type="button" aria-label={text.close} onClick={() => dialog.current?.close()}><X size={22} aria-hidden="true" /></button>
      </div>
      <p id={`${field}-description`}>{audienceText.description}</p>
      <form aria-busy={state === 'sending'} onSubmit={submit}>
        <label htmlFor={field}>{text.email}</label>
        <div className="tl-waitlist-fields">
          <input ref={emailInput} id={field} type="email" name="email" autoComplete="email" maxLength={254} required disabled={state === 'sending'} onChange={() => { if (state !== 'idle') setState('idle'); }} />
          <button className="tl-relieve-button tl-relieve-button-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? text.sending : text.submit}</button>
        </div>
        {state === 'success' && <p role="status" className="tl-waitlist-feedback">{localReview ? audienceText.success : text.success}</p>}
        {state === 'error' && <p role="alert" className="tl-waitlist-feedback tl-waitlist-error">{text.error}</p>}
      </form>
    </dialog>
  );
}

export default function CannabisWaitlists() {
  const { language } = useLanguage();
  const [activeAudience, setActiveAudience] = useState<WaitlistAudience | null>(null);
  const text = copy[language];
  const localReview = import.meta.env.DEV && import.meta.env.MODE === CANNABIS_WAITLIST_REVIEW_MODE
    && ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  const production = import.meta.env.PROD && import.meta.env.VITE_CANNABIS_WAITLIST_ENABLED === 'true'
    && window.location.origin === 'https://cannabis.trustleaf.org';
  const enabled = localReview || production;

  return (
    <section id="lista-de-espera" className="tl-relieve-container tl-waitlists" aria-labelledby="tl-waitlists-title" tabIndex={-1}>
      <h2 id="tl-waitlists-title">{text.title}</h2>
      {localReview && <p>{text.previewNotice}</p>}
      {!enabled && <p>{text.inactiveNotice}</p>}
      <div className="tl-waitlist-cards">
        {waitlistAudiences.map(audience => {
          const { anchor, icon: Icon } = details[audience];
          return (
            <article key={audience} id={anchor} className="tl-waitlist-card">
              <button className="tl-waitlist-trigger" type="button" aria-haspopup="dialog" disabled={!enabled} onClick={() => setActiveAudience(audience)}>
                <span className="tl-relieve-icon"><Icon size={22} aria-hidden="true" /></span>
                <span>{text.labels[audience]}</span>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>
      {activeAudience && <WaitlistDialog audience={activeAudience} localReview={localReview} text={text} onClose={() => setActiveAudience(null)} />}
    </section>
  );
}
