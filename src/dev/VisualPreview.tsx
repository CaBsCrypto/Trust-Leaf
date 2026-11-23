import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';
import LandingPage from '../components/LandingPage';
import { LanguageProvider } from '../context/LanguageContext';
import OperationsWorkspace from '../features/operations/OperationsWorkspace';
import { TrustLeafPrivyContext, type TrustLeafPrivyIdentity } from '../components/privyIdentityContext';
import type { PilotSnapshot } from '../features/operations/contracts';
import '../index.css';
import '../styles/trustleaf-theme.css';
import '../visual-refresh.css';

// This entry is used only by the excluded visual-preview.html document.
// It neither changes the application's auth gates nor imports production credentials.
if (!import.meta.env.DEV || !['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('LOCAL_VISUAL_PREVIEW_ONLY');
window.Buffer = Buffer;
const doctorView = new URLSearchParams(location.search).get('view') === 'doctor';
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
const times = ['09:00', '10:00', '11:30', '14:00', '15:30'];
const snapshot: PilotSnapshot = {
  synthetic: true, joined: true, role: 'doctor', actorRef: 'visual-doctor',
  bookings: times.map((time, i) => ({ booking_ref: `CONS-DEMO-${i + 1}`, patient_ref: `TL-00${482 + i}-synthetic`, doctor_ref: 'visual-doctor', starts_at: `${day}T${time}:00-03:00`, ends_at: `${day}T${time.slice(0, 2)}:${time.endsWith('30') ? '50' : '30'}:00-03:00`, state: 'confirmed' })),
  encounters: [
    { booking_ref: 'CONS-DEMO-1', doctor_ref: 'visual-doctor', patient_ref: 'TL-00482-synthetic', state: 'completed', version: 2 },
    { booking_ref: 'CONS-DEMO-2', doctor_ref: 'visual-doctor', patient_ref: 'TL-00483-synthetic', state: 'active', version: 1 },
  ], notes: [], treatments: [],
};
const identity: TrustLeafPrivyIdentity = {
  enabled: true, ready: true, authenticated: true, tokenReady: true, subject: 'visual-local-only', email: 'medico@trustleaf.test',
  async getIdentityToken() { return 'synthetic-local-preview'; },
  async beginLogin() {}, async logout() {},
};
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    if (doctorView && (init?.method ?? 'GET') === 'GET') {
      if (url.pathname === '/api/operations-pilot') return Response.json(snapshot);
      if (url.pathname === '/api/agenda') return Response.json({ role: 'doctor', slots: snapshot.bookings!.map(b => ({ slotRef: `slot-${b.booking_ref}`, doctorRef: b.doctor_ref, startsAt: b.starts_at, endsAt: b.ends_at, state: 'booked', version: 1, bookingRef: b.booking_ref, bookingState: b.state })) });
    }
    return Response.json({ code: 'LOCAL_VISUAL_PREVIEW_READ_ONLY' }, { status: 503 });
  }
  if (doctorView && url.origin !== location.origin) return Response.json({ code: 'LOCAL_VISUAL_PREVIEW_ONLY' }, { status: 503 });
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(<>
  {doctorView
    ? <TrustLeafPrivyContext.Provider value={identity}><OperationsWorkspace email="medico@trustleaf.test" /></TrustLeafPrivyContext.Provider>
    : <LanguageProvider><LandingPage onNavigate={path => location.assign(path.startsWith('/medico') ? '/visual-preview.html?view=doctor' : path)} /></LanguageProvider>}
  <nav className="tl-local-review" aria-label="Revisión visual local">
    <span>VISTA LOCAL · DATOS SINTÉTICOS</span>
    <a href="/visual-preview.html" aria-current={!doctorView ? 'page' : undefined}>Inicio</a>
    <a href="/visual-preview.html?view=doctor" aria-current={doctorView ? 'page' : undefined}>Dashboard médico</a>
  </nav>
</>);
