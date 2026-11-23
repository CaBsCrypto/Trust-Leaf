import type { ReactNode } from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { BRAND_CHANNEL, BRAND_NAME } from '../lib/brand';
import './technical-frame.css';

interface TechnicalFrameProps {
  onBack: () => void;
  badge: string;
  compact?: boolean;
  mainId?: string;
  children: ReactNode;
}

export default function TechnicalFrame({
  onBack, badge, compact, mainId = 'technical-main', children,
}: TechnicalFrameProps) {
  return (
    <div className="tl-technical" data-compact={compact || undefined}>
      <a className="tl-technical-skip" href={`#${mainId}`}>Saltar al contenido</a>
      <header className="tl-technical-header">
        <div className="tl-technical-container tl-technical-header-content">
          <p className="tl-technical-brand"><strong>{BRAND_NAME}</strong><span>{BRAND_CHANNEL}</span></p>
          <span className="tl-technical-badge">{badge}</span>
          <button type="button" className="tl-technical-back" onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" /> Volver
          </button>
        </div>
      </header>
      <main id={mainId} className="tl-technical-container tl-technical-main" tabIndex={-1}>{children}</main>
    </div>
  );
}

export function TechnicalIntro({ title, label, icon: Icon, children, aside }: {
  title: string;
  label: string;
  icon: LucideIcon;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="tl-technical-intro" aria-labelledby="technical-page-title" data-with-aside={aside ? true : undefined}>
      <div className="tl-technical-intro-copy">
        <div className="tl-technical-intro-kicker">
          <span className="tl-technical-icon"><Icon size={22} aria-hidden="true" /></span>
          <span>{label}</span>
        </div>
        <h1 id="technical-page-title">{title}</h1>
        {children}
      </div>
      {aside}
    </section>
  );
}
