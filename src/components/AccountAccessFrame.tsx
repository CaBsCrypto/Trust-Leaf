import type { ReactNode } from 'react';
import { BRAND_CHANNEL, BRAND_NAME, BRAND_TITLE } from '../lib/brand';
import './account-access.css';

export default function AccountAccessFrame({ title, description, onBack, children }: {
  title: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return <div className="tl-account-page">
    <header className="tl-account-top">
      <div className="tl-account-top-inner">
        <button type="button" onClick={onBack} className="tl-account-home" aria-label={`Volver al inicio de ${BRAND_TITLE}`}>
          <strong>{BRAND_NAME}</strong>
          <span>{BRAND_CHANNEL}</span>
        </button>
      </div>
    </header>
    <main className="tl-account-layout">
      <section className="tl-account-intro">
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      <section className="tl-account-card" aria-label="Estado del acceso">
        {children}
      </section>
    </main>
  </div>;
}
