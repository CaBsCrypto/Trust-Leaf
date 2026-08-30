import {lazy, StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import { Buffer } from 'buffer';
import './index.css';

const PILOT_FLOW_ROUTE = '/demo/pilot-flow';
const PilotFlowPage = lazy(() => import('./features/pilot-flow/PilotFlowPage'));
const LegacyApp = lazy(() => import('./App.tsx'));

function returnFromPilotFlow() {
  if (window.history.length > 1) window.history.back();
  else window.location.assign('/');
}

function RootRoute() {
  if (window.location.pathname === PILOT_FLOW_ROUTE) {
    return <PilotFlowPage onBack={returnFromPilotFlow} />;
  }
  return <LegacyApp />;
}

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-[#f2f5f1]" />}>
      <RootRoute />
    </Suspense>
  </StrictMode>,
);
