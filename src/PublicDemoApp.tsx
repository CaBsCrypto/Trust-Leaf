import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Leaf, QrCode, ShieldCheck, Stethoscope, Store, UserRound } from 'lucide-react';
import ThreeUserCard from './components/ThreeUserCard';

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
  return <main className="min-h-screen bg-[#edf2ee] text-brand-green-deep"><section className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1.15fr_.85fr] md:px-12"><div><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-green-deep text-brand-ivory"><Leaf size={22}/></span><span className="text-xl font-bold">Trust Leaf</span></div><p className="mt-16 text-xs font-bold uppercase tracking-[.22em] text-brand-green-mid">Demostración técnica sintética</p><h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">Explora el recorrido técnico con una tarjeta demo interactiva.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-brand-green-mid">No recibe datos personales o clínicos, no emite recetas ni ejecuta transacciones. Sólo muestra fixtures y evidencia técnica de lectura.</p><div className="mt-9 flex flex-wrap gap-3"><button type="button" onClick={() => navigate('/demo/pilot-flow')} className="inline-flex items-center gap-2 rounded-xl bg-brand-green-deep px-5 py-3 font-bold text-brand-ivory">Revisar flujo por rol <ArrowRight size={17}/></button><button type="button" onClick={() => navigate('/demo/trust-registry')} className="rounded-xl border border-brand-green-deep/20 px-5 py-3 font-bold">Cadena de autorización</button></div><p className="mt-12 text-xs text-brand-green-mid">Demo/no uso clínico. Mutaciones y submissions Testnet deshabilitadas.</p></div><ThreeUserCard onNavigate={navigate}/></section><Ecosystem/><Process/><Faq/><Cta/></main>;
}

function Ecosystem() { const items = [{ icon: UserRound, label: 'Paciente demo' }, { icon: Stethoscope, label: 'Profesional demo' }, { icon: Store, label: 'Dispensario demo' }, { icon: ShieldCheck, label: 'Datos sintéticos' }]; return <section className="border-y border-brand-green-deep/10 bg-white py-14"><div className="mx-auto max-w-6xl px-6 md:px-12"><p className="text-center text-xs font-bold uppercase tracking-[.2em] text-brand-green-mid">Ecosistema de revisión</p><div className="mt-7 flex flex-wrap justify-center gap-3">{items.map(({ icon: Icon, label }) => <div key={label} className="flex items-center gap-2 rounded-2xl border border-brand-green-deep/10 bg-brand-neutral px-4 py-3 text-sm font-bold"><Icon size={17}/>{label}</div>)}</div></div></section>; }
function Process() { const steps = [{ title: 'Explorar', body: 'Selecciona un rol sintético en la tarjeta.' }, { title: 'Revisar', body: 'Consulta estados y evidencia de sólo lectura.' }, { title: 'Verificar', body: 'El QR público muestra únicamente el estado mínimo.' }]; return <section className="mx-auto max-w-6xl px-6 py-20 md:px-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-brand-green-mid">Recorrido</p><h2 className="mt-3 max-w-2xl text-3xl font-bold md:text-4xl">Un flujo claro, sin operaciones clínicas.</h2><div className="mt-9 grid gap-4 md:grid-cols-3">{steps.map((step, index) => <article key={step.title} className="rounded-3xl bg-white p-6 shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green-deep text-sm font-bold text-brand-ivory">0{index + 1}</span><h3 className="mt-5 text-xl font-bold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-brand-green-mid">{step.body}</p></article>)}</div></section>; }
function Faq() { const questions = [['¿Es una receta?', 'No. Es una demostración técnica y no acredita validez clínica o legal.'], ['¿Qué muestra el QR?', 'Sólo una constancia sintética mínima: existencia, coincidencia y estado.'], ['¿Puede ejecutar acciones?', 'No. Emisión, dispensación y submissions Testnet permanecen bloqueadas.']]; return <section className="bg-white py-20"><div className="mx-auto max-w-4xl px-6 md:px-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-brand-green-mid">Preguntas frecuentes</p><h2 className="mt-3 text-3xl font-bold md:text-4xl">Límites explícitos de esta demo</h2><div className="mt-8 space-y-3">{questions.map(([question, answer]) => <details key={question} className="rounded-2xl border border-brand-green-deep/10 p-5"><summary className="cursor-pointer font-bold">{question}</summary><p className="mt-3 text-sm leading-6 text-brand-green-mid">{answer}</p></details>)}</div></div></section>; }
function Cta() { return <section className="bg-brand-green-deep px-6 py-20 text-brand-ivory"><div className="mx-auto max-w-4xl text-center"><QrCode className="mx-auto text-brand-gold" size={30}/><p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">Revisión controlada</p><h2 className="mt-3 text-3xl font-bold md:text-4xl">Abre el flujo sintético por rol.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-brand-ivory/75">Sin cuentas reales, datos clínicos, pagos ni transacciones.</p><button type="button" onClick={() => navigate('/demo/pilot-flow')} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-3 font-bold text-brand-green-deep">Explorar la demo <ArrowRight size={17}/></button></div></section>; }

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
