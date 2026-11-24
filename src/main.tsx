import {lazy, StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import { Buffer } from 'buffer';
import './index.css';
import './styles/trustleaf-theme.css';
import PrivySessionBoundary from './components/PrivySessionBoundary';
import { TrustLeafPrivyProvider } from './components/TrustLeafPrivyProvider';

const PILOT_FLOW_ROUTE = '/demo/pilot-flow';
const PilotFlowPage = lazy(() => import('./features/pilot-flow/PilotFlowPage'));
const FichaPilot = lazy(() => import('./features/ficha-pilot/FichaPilot'));
const FichaIdentityRebind = lazy(() => import('./features/ficha-pilot/FichaIdentityRebind'));
const LegacyApp = lazy(() => import('./App.tsx'));

function returnFromPilotFlow() {
  if (window.history.length > 1) window.history.back();
  else window.location.assign('/');
}

function RootRoute() {
  const path = window.location.pathname;
  if (path === PILOT_FLOW_ROUTE) {
    return <PilotFlowPage onBack={returnFromPilotFlow} />;
  }
  if (path.startsWith('/pilot/')) return <PrivySessionBoundary><FichaPilot path={path} /></PrivySessionBoundary>;
  return <LegacyApp />;
}

function Entry() {
  if (/^\/pilot\/migrar-cuenta\/?$/.test(window.location.pathname)) return <FichaIdentityRebind />;
  return <TrustLeafPrivyProvider><RootRoute /></TrustLeafPrivyProvider>;
}

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-[#f2f5f1]" />}>
      <Entry />
    </Suspense>
  </StrictMode>,
);
