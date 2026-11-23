import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle } from 'lucide-react';
import { BRAND_CHANNEL, BRAND_NAME } from '../../lib/brand';
import type { PilotRole } from './contracts';

interface WorkspaceFrameProps {
  role?: PilotRole;
  title: string;
  email: string;
  membershipLabel?: string;
  embedded: boolean;
  toolbar: ReactNode;
  dialog: ReactNode;
  children: ReactNode;
}

export function WorkspaceFrame({
  role, title, email, membershipLabel, embedded, toolbar, dialog, children,
}: WorkspaceFrameProps) {
  const Heading = embedded ? 'h3' : 'h1';

  return (
    <section className={`tl-operations op-care ${role ? 'op-' + role : ''} ${embedded ? '' : 'tl-operations-page'}`}>
      <header className="op-header">
        <div className="op-workspace-identity">
          <p className="op-brand"><strong>{BRAND_NAME}</strong><span>{BRAND_CHANNEL}</span></p>
          <Heading className="op-workspace-title">{title}</Heading>
          <p className="op-email">{email}</p>
          {membershipLabel && <p className="op-email op-workspace-membership">{membershipLabel}</p>}
        </div>
        <div className="op-toolbar" role="group" aria-label="Acciones del panel">
          {toolbar}
        </div>
      </header>
      {dialog}
      <div className="op-content">{children}</div>
    </section>
  );
}

const noticeIcons = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
  loading: LoaderCircle,
} as const;

export function WorkspaceNotice({ kind, children }: { kind: keyof typeof noticeIcons; children: ReactNode }) {
  const Icon = noticeIcons[kind];
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={`op-workspace-notice op-${kind}`}>
      <Icon aria-hidden="true" size={19} />
      <span>{children}</span>
    </p>
  );
}
