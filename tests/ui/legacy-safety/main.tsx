import React, { Component, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import MockupPortal, { type PortalView } from '../../../src/components/MockupPortal';
import { LanguageProvider } from '../../../src/context/LanguageContext';
import { TrustLeafPrivyContext, disabledPrivyIdentity } from '../../../src/components/privyIdentityContext';
import './style.css';

type Session = { role: string; email: string; name: string; mode: 'demo' | 'email'; createdAt: string };
const role = new URLSearchParams(location.search).get('role') ?? 'patient';
const initialView = new URLSearchParams(location.search).get('view') as PortalView | null;
const labels = { patient: 'Portal Paciente', dispensary: 'Portal Dispensario', doctor: 'Portal M\u00e9dico' };
const views: Record<string, PortalView[]> = {
  patient: ['overview', 'doctors', 'prescriptions', 'dispensaries', 'history'],
  dispensary: ['dispensaries', 'history', 'pickups'], doctor: ['doctors'],
};
if (!Object.hasOwn(labels, role)) throw new Error('UNKNOWN_SYNTHETIC_ROLE');
if (initialView && !views[role].includes(initialView)) throw new Error('UNKNOWN_SYNTHETIC_VIEW');

class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    (window as any).__legacyRenderError = { name: error.name, message: error.message };
  }
  render() { return this.state.failed ? <p data-testid="fixture-render-error">Synthetic render failure</p> : this.props.children; }
}

function Fixture() {
  const [session, setSession] = useState<Session | null>({ role, email: `${role}-a@example.test`,
    name: `Synthetic ${role} A`, mode: 'email', createdAt: '2026-10-04T12:00:00.000Z' });
  const [identity, setIdentity] = useState({ subject: `did:privy:legacy-${role}-a`, authenticated: true, ready: true,
    enabled: new URLSearchParams(location.search).has('privy') });
  const [revision, setRevision] = useState(0);
  const [technical, setTechnical] = useState(new URLSearchParams(location.search).has('technical'));
  useEffect(() => {
    const change = (event: Event) => {
      const next = (event as CustomEvent).detail;
      if (Object.hasOwn(next, 'session')) setSession(next.session);
      if (next.identity) setIdentity(current => ({ ...current, ...next.identity }));
      if (Object.hasOwn(next, 'technical')) setTechnical(next.technical);
      setRevision(current => current + 1);
    };
    window.addEventListener('legacy-fixture-change', change);
    (window as any).__legacyFixtureListening = true;
    return () => window.removeEventListener('legacy-fixture-change', change);
  }, []);
  useLayoutEffect(() => {
    (window as any).__legacyHost = { session, identity, revision };
  }, [session, identity, revision]);
  const logout = () => {
    setSession(null); setIdentity(current => ({ ...current, subject: '', authenticated: false, ready: true }));
    setRevision(current => current + 1);
  };
  const currentRole = session?.role ?? role;
  return <TrustLeafPrivyContext.Provider value={{ ...disabledPrivyIdentity, ...identity,
    email: session?.email, tokenReady: true, getIdentityToken: async () => identity.authenticated ? 'SYNTHETIC_ID_TOKEN' : null,
    logout: async () => logout() }}>
    <LanguageProvider><MotionConfig reducedMotion="always" transition={{ duration: 0 }}>
      <RenderBoundary><MockupPortal isOpen pageMode onClose={() => {}} onSignOut={logout}
        session={session} roleLabel={labels[currentRole]} allowedViews={views[currentRole]}
        initialView={initialView ?? (role === 'doctor' ? 'doctors' : role === 'dispensary' ? 'dispensaries' : 'overview')}
        showTechnicalDetails={technical} professionalRoleVerified={false}/></RenderBoundary>
    </MotionConfig></LanguageProvider>
  </TrustLeafPrivyContext.Provider>;
}

createRoot(document.getElementById('root')!).render(<Fixture/>);
