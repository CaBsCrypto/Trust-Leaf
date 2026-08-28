import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowRight, Leaf, ShieldCheck } from 'lucide-react';

const PrescriptionVerifier = lazy(() => import('./components/PrescriptionVerifier'));
const ReceiptPilotFlow = lazy(() => import('./components/ReceiptPilotFlow'));
const TrustAuthorizationReview = lazy(() => import('./components/TrustAuthorizationReview'));

const SAFE_DEMO_ROUTES = new Set([
  '/paciente', '/paciente/cuenta', '/paciente/recetas', '/paciente/dispensarios', '/paciente/retiros', '/paciente/historial', '/paciente/viajero',
  '/medico', '/medico/operacion',
  '/dispensario', '/dispensario/operacion', '/dispensario/historial', '/dispensario/retiros',
  '/admin', '/mvp',
]);

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function Loading() {
  return <div className="min-h-screen bg-[#edf2ee]" aria-label="Cargando demostración" />;
}

function SyntheticDemoNotice({ path }: { path: string }) {
  return <main className="min-h-screen bg-[#edf2ee] px-5 py-12 text-brand-green-deep"><section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green-deep text-brand-ivory"><ShieldCheck size={23}/></div>
    <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-brand-green-mid">Demo sintética · operaciones deshabilitadas</p>
    <h1 className="mt-2 text-3xl font-bold">Esta ruta no admite datos ni acciones clínicas</h1>
    <p className="mt-4 text-sm leading-6 text-brand-green-mid">El portal histórico, las cargas de archivos, los formularios y la persistencia local están aislados de la superficie pública. Esta candidata sólo permite revisar fixtures sintéticos y evidencia técnica de lectura.</p>
    <p className="mt-3 rounded-xl bg-brand-neutral p-3 text-xs">Ruta solicitada: <code>{path}</code>. No se guardó ni se solicitó información personal, clínica o de recetas.</p>
    <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => navigate('/demo/pilot-flow')} className="inline-flex items-center gap-2 rounded-xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory">Abrir flujo sintético <ArrowRight size={16}/></button><button type="button" onClick={() => navigate('/')} className="rounded-xl border border-brand-green-deep/20 px-4 py-3 text-sm font-bold">Inicio</button></div>
  </section></main>;
}

function Landing() {
  return <main className="min-h-screen bg-[#edf2ee] text-brand-green-deep"><section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 md:px-12"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-green-deep text-brand-ivory"><Leaf size={22}/></span><span className="text-xl font-bold">Trust Leaf</span></div><p className="mt-16 text-xs font-bold uppercase tracking-[.22em] text-brand-green-mid">Demostración técnica sintética</p><h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">Revisión segura de receipts y estados técnicos.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-brand-green-mid">Esta superficie no recibe datos personales o clínicos, no emite recetas ni ejecuta transacciones. Permite revisar fixtures sintéticos y evidencia pública mínima.</p><div className="mt-9 flex flex-wrap gap-3"><button type="button" onClick={() => navigate('/demo/pilot-flow')} className="inline-flex items-center gap-2 rounded-xl bg-brand-green-deep px-5 py-3 font-bold text-brand-ivory">Revisar flujo por rol <ArrowRight size={17}/></button><button type="button" onClick={() => navigate('/demo/trust-registry')} className="rounded-xl border border-brand-green-deep/20 px-5 py-3 font-bold">Cadena de autorización</button></div><p className="mt-12 text-xs text-brand-green-mid">Demo/no uso clínico. Las mutaciones y submissions Testnet permanecen deshabilitadas.</p></section></main>;
}

export default function PublicDemoApp() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => { const update = () => setPath(window.location.pathname); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  if (path === '/demo/pilot-flow') return <Suspense fallback={<Loading/>}><ReceiptPilotFlow onBack={() => navigate('/')} onVerify={(token) => navigate(`/verify/${encodeURIComponent(token)}`)} /></Suspense>;
  if (path === '/demo/receipt-pilot') return <Suspense fallback={<Loading/>}><ReceiptPilotFlow onBack={() => navigate('/')} onVerify={(token) => navigate(`/verify/${encodeURIComponent(token)}`)} /></Suspense>;
  if (path === '/demo/trust-registry') return <Suspense fallback={<Loading/>}><TrustAuthorizationReview onBack={() => navigate('/demo/pilot-flow')} /></Suspense>;
  if (path.startsWith('/verify/')) return <Suspense fallback={<Loading/>}><PrescriptionVerifier id={decodeURIComponent(path.slice('/verify/'.length))} onBack={() => navigate('/demo/pilot-flow')} /></Suspense>;
  if (SAFE_DEMO_ROUTES.has(path)) return <SyntheticDemoNotice path={path}/>;
  return <Landing/>;
}
