/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Activity, ArrowRight, Database, Leaf, ShieldCheck, ShoppingBag, Stethoscope, UserRound, X } from 'lucide-react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Footer from './components/Footer';
import MockupPortal, { PortalView } from './components/MockupPortal';
import {
  trustDataStore,
  type ActorRegistrationStatus,
  type DispensaryApplication,
  type DoctorApplication,
  type PersistenceSource,
} from './lib/trustData';
import {
  listenAdminAuth,
  signInAdmin,
  signOutAdmin,
  type AdminAuthState,
} from './lib/trustAuth';

import { LanguageProvider, useLanguage } from './context/LanguageContext';

type DispensaryRegistrationStatus = ActorRegistrationStatus;
type DispensaryRegistration = DispensaryApplication;
type DoctorRegistration = DoctorApplication;
type ActorRole = 'patient' | 'doctor' | 'dispensary' | 'admin';

interface TrustSession {
  role: ActorRole;
  email: string;
  name: string;
  mode: 'demo' | 'email';
  createdAt: string;
}

// Future hardening: these local registration records should move to Supabase
// with encrypted documents and an Agent 402 verification result. Admin approval
// should then write only the actor wallet + metadata hash to the Stellar registry.

const PATIENT_VIEWS: PortalView[] = ['overview', 'profile', 'doctors', 'prescriptions', 'dispensaries', 'pickups', 'history', 'traveler'];
const DOCTOR_VIEWS: PortalView[] = ['doctors'];
const DISPENSARY_VIEWS: PortalView[] = ['dispensaries', 'history', 'pickups'];
const TRUST_SESSION_KEY = 'trust_leaf_session';
const DEFAULT_PATIENT_WALLET = 'GBOVHFJQXZR5LMODPMKM766SHK5D7XOPZUHUYRPHENQKWDQI33DSWRJ6';
const DEFAULT_DOCTOR_WALLET = 'GD2MXRXHYBSSY7CXQWAYN5S7OHAUVEULPHV4SYQA3542GIQLUGJ57VNX';
const DEFAULT_DISPENSARY_WALLET = 'GCJLFG6PX6OA6JBJPQP2PXBJ7SD726O4R46IMWD4GBK3CX7HCWEJZRJ6';

const ROLE_ROUTES = [
  { path: '/paciente', label: 'Paciente' },
  { path: '/medico', label: 'Médico' },
  { path: '/dispensario', label: 'Dispensario' },
  { path: '/admin', label: 'Admin' },
];

const PATIENT_ROUTE_VIEWS: Record<string, PortalView> = {
  '/paciente': 'overview',
  '/paciente/cuenta': 'profile',
  '/paciente/recetas': 'prescriptions',
  '/paciente/dispensarios': 'dispensaries',
  '/paciente/retiros': 'pickups',
  '/paciente/historial': 'history',
  '/paciente/viajero': 'traveler',
};

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function AppContent() {
  const { t } = useLanguage();
  const [path, setPath] = useState(() => window.location.pathname);
  const [dispensaryRegistrations, setDispensaryRegistrations] = useState<DispensaryRegistration[]>(() => {
    const saved = localStorage.getItem('trust_dispensary_registrations');
    return saved ? JSON.parse(saved) : [];
  });
  const [doctorRegistrations, setDoctorRegistrations] = useState<DoctorRegistration[]>(() => {
    const saved = localStorage.getItem('trust_doctor_registrations');
    return saved ? JSON.parse(saved) : [];
  });
  const [registrationSource, setRegistrationSource] = useState<PersistenceSource>('local-demo');
  const [session, setSession] = useState<TrustSession | null>(() => {
    try {
      const saved = localStorage.getItem(TRUST_SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>({
    mode: 'checking',
    user: null,
  });

  const startSession = (role: ActorRole, input: { email: string; name: string; mode?: TrustSession['mode'] }) => {
    const nextSession: TrustSession = {
      role,
      email: input.email,
      name: input.name,
      mode: input.mode ?? 'email',
      createdAt: new Date().toISOString(),
    };
    if (role === 'patient' && nextSession.mode === 'demo') {
      localStorage.setItem(
        'trust_wallet_setup',
        JSON.stringify({
          primaryMethod: 'demo',
          hasFreighterBackup: false,
          walletLabel: 'Paciente demo testnet',
          contractAccount: DEFAULT_PATIENT_WALLET,
          freighterAddress: DEFAULT_PATIENT_WALLET,
          networkLabel: 'Stellar Testnet',
        }),
      );
      localStorage.setItem('trust_doctor_patient_address', DEFAULT_PATIENT_WALLET);
      localStorage.setItem('trust_has_rx', 'true');
      localStorage.setItem('trust_latest_prescription_id', '1');
      localStorage.setItem('trust_dispense_prescription_id', '1');
    }
    localStorage.setItem(TRUST_SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const endSession = () => {
    localStorage.removeItem(TRUST_SESSION_KEY);
    setSession(null);
    if (adminAuth.user) {
      void signOutAdmin();
    }
  };

  const hasRoleSession = (role: ActorRole) => session?.role === role;

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath);
    setPath(window.location.pathname);
  };

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => listenAdminAuth(setAdminAuth), []);

  const refreshActorRegistrations = async () => {
    const [doctorResult, dispensaryResult] = await Promise.all([
      trustDataStore.loadDoctorApplications(),
      trustDataStore.loadDispensaryApplications(),
    ]);

    setDoctorRegistrations(doctorResult.records);
    setDispensaryRegistrations(dispensaryResult.records);
    setRegistrationSource(
      doctorResult.source === 'supabase' || dispensaryResult.source === 'supabase'
        ? 'supabase'
        : doctorResult.source === 'firebase' || dispensaryResult.source === 'firebase'
          ? 'firebase'
        : 'local-demo',
    );
  };

  useEffect(() => {
    void refreshActorRegistrations();
  }, []);

  useEffect(() => {
    if (adminAuth.mode === 'authorized') {
      void refreshActorRegistrations();
    }
  }, [adminAuth.mode]);

  const submitDoctorRegistration = (input: Omit<DoctorRegistration, 'id' | 'status' | 'submittedAt' | 'onchainStatus'>) => {
    void trustDataStore.createDoctorApplication(input).then((source) => {
      setRegistrationSource(source);
      return refreshActorRegistrations();
    });
  };

  const addDoctorManually = (input: Omit<DoctorRegistration, 'id' | 'status' | 'submittedAt' | 'reviewedAt' | 'onchainStatus'>) => {
    void trustDataStore.createApprovedDoctor(input).then((source) => {
      setRegistrationSource(source);
      return refreshActorRegistrations();
    });
  };

  const submitDispensaryRegistration = (input: Omit<DispensaryRegistration, 'id' | 'status' | 'submittedAt' | 'onchainStatus'>) => {
    void trustDataStore.createDispensaryApplication(input).then((source) => {
      setRegistrationSource(source);
      return refreshActorRegistrations();
    });
  };

  const addDispensaryManually = (input: Omit<DispensaryRegistration, 'id' | 'status' | 'submittedAt' | 'reviewedAt' | 'onchainStatus'>) => {
    void trustDataStore.createApprovedDispensary(input).then((source) => {
      setRegistrationSource(source);
      return refreshActorRegistrations();
    });
  };

  const reviewDispensaryRegistration = (id: string, status: Extract<DispensaryRegistrationStatus, 'approved' | 'rejected' | 'needs_review'>) => {
    void trustDataStore.reviewDispensaryApplication(id, status).then((source) => {
      setRegistrationSource(source);
      return refreshActorRegistrations();
    });
  };

  const reviewDoctorRegistration = (id: string, status: Extract<DispensaryRegistrationStatus, 'approved' | 'rejected' | 'needs_review'>) => {
    void trustDataStore.reviewDoctorApplication(id, status).then((source) => {
      setRegistrationSource(source);
      return refreshActorRegistrations();
    });
  };

  const registerDoctorOnchain = async (request: DoctorRegistration) => {
    const response = await fetch('/api/stellar/admin/register-doctor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorAddress: request.wallet }),
    });
    const payload = await response.json();
    if (!response.ok) {
      await trustDataStore.updateDoctorOnchainStatus(request.id, 'failed', undefined, payload.message);
      await refreshActorRegistrations();
      throw new Error(payload.message || 'No fue posible registrar el medico en Testnet.');
    }

    const source = await trustDataStore.updateDoctorOnchainStatus(
      request.id,
      'registered',
      payload.txHash,
      `DoctorRegistry Testnet: ${payload.txHash}`,
    );
    setRegistrationSource(source);
    await refreshActorRegistrations();
    return payload;
  };

  const registerDispensaryOnchain = async (request: DispensaryRegistration) => {
    const response = await fetch('/api/stellar/admin/register-dispensary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispensaryAddress: request.wallet }),
    });
    const payload = await response.json();
    if (!response.ok) {
      await trustDataStore.updateDispensaryOnchainStatus(request.id, 'failed', undefined, payload.message);
      await refreshActorRegistrations();
      throw new Error(payload.message || 'No fue posible registrar el dispensario en Testnet.');
    }

    const source = await trustDataStore.updateDispensaryOnchainStatus(
      request.id,
      'registered',
      payload.txHash,
      `DispensaryRegistry Testnet: ${payload.txHash}`,
    );
    setRegistrationSource(source);
    await refreshActorRegistrations();
    return payload;
  };

  const patientView = PATIENT_ROUTE_VIEWS[path];
  const approvedDoctorRegistrations = doctorRegistrations.filter((request) => request.status === 'approved');
  const approvedDispensaryRegistrations = dispensaryRegistrations.filter((request) => request.status === 'approved');
  const currentDoctorRegistration =
    approvedDoctorRegistrations.find((request) =>
      session?.role === 'doctor'
      && (request.contact === session.email || request.name === session.name),
    ) ?? null;
  const currentDispensaryRegistration =
    approvedDispensaryRegistrations.find((request) =>
      session?.role === 'dispensary'
      && (request.contact === session.email || request.name === session.name),
    ) ?? null;
  const doctorCanOperate =
    session?.role === 'doctor' && (session.mode === 'demo' || Boolean(currentDoctorRegistration));
  const dispensaryCanOperate =
    session?.role === 'dispensary' && (session.mode === 'demo' || Boolean(currentDispensaryRegistration));

  if (patientView) {
    if (!hasRoleSession('patient')) {
      return (
        <AuthGate
          role="patient"
          title="Entra como paciente"
          description="Tu cuenta Trust Leaf sera el punto de control para ficha clinica, recetas, permisos y trazabilidad. Las fees de red quedan patrocinadas por Trust Leaf."
          primaryAction="Entrar al portal"
          demoAction="Entrar con paciente demo"
          defaultEmail="paciente@trustleaf.test"
          defaultName="Paciente demo"
          onBack={() => navigate('/')}
          onStart={startSession}
        />
      );
    }

    return (
      <MockupPortal
        isOpen
        onClose={() => navigate('/')}
        initialView={patientView}
        allowedViews={PATIENT_VIEWS}
        pageMode
        roleLabel="Portal Paciente"
      />
    );
  }

  if (path === '/medico') {
    if (!hasRoleSession('doctor')) {
      return (
        <AuthGate
          role="doctor"
          title="Cuenta profesional"
          description="Primero el medico crea su cuenta y solicita alta. La wallet puede conectarse ahora o quedar como credencial gestionada por Trust Leaf al aprobar."
          primaryAction="Crear cuenta y solicitar alta"
          demoAction="Entrar como medico demo"
          defaultEmail="medico@trustleaf.test"
          defaultName="Dra. Sofia Lagos"
          onBack={() => navigate('/')}
          onStart={startSession}
        />
      );
    }

    return (
      <DoctorRegistrationRoute
        onBack={() => navigate('/')}
        onNavigate={navigate}
        doctorRegistrations={doctorRegistrations}
        canOperate={doctorCanOperate}
        onSubmitDoctorRegistration={submitDoctorRegistration}
      />
    );
  }

  if (path === '/medico/operacion') {
    if (!hasRoleSession('doctor')) {
      return (
        <AuthGate
          role="doctor"
          title="Acceso medico aprobado"
          description="El panel profesional queda disponible cuando admin aprueba la cuenta y registra la credencial medica. En demo puedes entrar como medico ya aprobado."
          primaryAction="Entrar al panel"
          demoAction="Entrar como medico demo aprobado"
          defaultEmail="medico@trustleaf.test"
          defaultName="Dra. Sofia Lagos"
          onBack={() => navigate('/medico')}
          onStart={startSession}
        />
      );
    }

    if (!doctorCanOperate) {
      return (
        <OperationalPendingRoute
          roleLabel="Medico"
          title="Tu panel medico espera aprobacion"
          description="Primero completa la solicitud profesional. Luego admin aprueba la licencia y registra la credencial medica en Testnet para emitir recetas verificables."
          primaryAction="Volver a mi solicitud"
          secondaryAction="Ir a admin demo"
          onPrimary={() => navigate('/medico')}
          onSecondary={() => navigate('/admin')}
          onBack={() => navigate('/')}
        />
      );
    }

    return (
      <MockupPortal
        isOpen
        onClose={() => navigate('/medico')}
        initialView="doctors"
        allowedViews={DOCTOR_VIEWS}
        pageMode
        roleLabel="Portal Médico"
      />
    );
  }

  if (path === '/dispensario') {
    if (!hasRoleSession('dispensary')) {
      return (
        <AuthGate
          role="dispensary"
          title="Cuenta de dispensario"
          description="El dispensario crea cuenta, solicita alta y luego admin habilita la credencial operativa. La wallet puede conectarse o ser gestionada por Trust Leaf."
          primaryAction="Crear cuenta y solicitar alta"
          demoAction="Entrar como dispensario demo"
          defaultEmail="dispensario@trustleaf.test"
          defaultName="Green Leaf Center"
          onBack={() => navigate('/')}
          onStart={startSession}
        />
      );
    }

    return (
      <DispensaryRegistrationRoute
        onBack={() => navigate('/')}
        onNavigate={navigate}
        dispensaryRegistrations={dispensaryRegistrations}
        canOperate={dispensaryCanOperate}
        onSubmitDispensaryRegistration={submitDispensaryRegistration}
      />
    );
  }

  if (path === '/dispensario/operacion' || path === '/dispensario/historial' || path === '/dispensario/retiros') {
    if (!hasRoleSession('dispensary')) {
      return (
        <AuthGate
          role="dispensary"
          title="Acceso operativo"
          description="El panel de inventario y entregas queda disponible para dispensarios aprobados. En demo puedes entrar como operador ya validado."
          primaryAction="Entrar al panel"
          demoAction="Entrar como dispensario demo aprobado"
          defaultEmail="dispensario@trustleaf.test"
          defaultName="Green Leaf Center"
          onBack={() => navigate('/dispensario')}
          onStart={startSession}
        />
      );
    }

    if (!dispensaryCanOperate) {
      return (
        <OperationalPendingRoute
          roleLabel="Dispensario"
          title="Operacion bloqueada hasta quedar live"
          description="El dispensario puede solicitar alta, pero no deberia validar recetas ni registrar retiros hasta que admin lo apruebe y deje su credencial lista en Testnet."
          primaryAction="Volver a mi solicitud"
          secondaryAction="Ir a admin demo"
          onPrimary={() => navigate('/dispensario')}
          onSecondary={() => navigate('/admin')}
          onBack={() => navigate('/')}
        />
      );
    }

    return (
      <MockupPortal
        isOpen
        onClose={() => navigate('/dispensario')}
        initialView={
          path === '/dispensario/historial'
            ? 'history'
            : path === '/dispensario/retiros'
              ? 'pickups'
              : 'dispensaries'
        }
        allowedViews={DISPENSARY_VIEWS}
        pageMode
        roleLabel="Portal Dispensario"
      />
    );
  }

  if (path === '/admin') {
    const hasDemoAdminSession = session?.role === 'admin' && session.mode === 'demo';
    const hasRealAdminSession = adminAuth.mode === 'authorized';
    const adminRouteSession: TrustSession | null = hasRealAdminSession
      ? {
          role: 'admin',
          email: adminAuth.user?.email ?? 'admin@trustleaf.org',
          name: adminAuth.user?.displayName ?? 'Admin Trust Leaf',
          mode: 'email',
          createdAt: new Date().toISOString(),
        }
      : session;

    if (!hasDemoAdminSession && !hasRealAdminSession) {
      return (
        <AdminAuthGate
          authState={adminAuth}
          onBack={() => navigate('/')}
          onDemo={() =>
            startSession('admin', {
              email: 'admin@trustleaf.test',
              name: 'Admin Trust Leaf',
              mode: 'demo',
            })
          }
        />
      );
    }

    return (
      <AdminRoute
        onBack={() => navigate('/')}
        session={adminRouteSession}
        onSignOut={endSession}
        doctorRegistrations={doctorRegistrations}
        registrations={dispensaryRegistrations}
        registrationSource={registrationSource}
        onReviewDoctorRegistration={reviewDoctorRegistration}
        onReviewRegistration={reviewDispensaryRegistration}
        onAddDoctorManually={addDoctorManually}
        onAddDispensaryManually={addDispensaryManually}
        onRegisterDoctorOnchain={registerDoctorOnchain}
        onRegisterDispensaryOnchain={registerDispensaryOnchain}
      />
    );
  }

  if (path === '/mvp') {
    return <MvpStatusRoute onBack={() => navigate('/')} onNavigate={navigate} />;
  }

  return (
    <div className="min-h-screen selection:bg-brand-gold/30 selection:text-brand-green-deep relative overflow-hidden bg-brand-ivory">
      <Navbar onPortalClick={() => navigate('/paciente')} />
      <main>
        <Hero onStartClick={() => navigate('/paciente')} />
        <NetworkPreview onNavigate={navigate} />
        <ProfessionalAccess onNavigate={navigate} />
        
        <section className="px-6 py-14 md:px-12 md:py-18">
           <div className="mx-auto grid max-w-6xl grid-cols-1 overflow-hidden rounded-3xl border border-brand-green-deep/10 bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
              <div className="p-8 md:p-12">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Siguiente paso</p>
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="mt-3 text-4xl font-serif leading-tight text-brand-green-deep md:text-6xl"
                >
                   {t.closure.title}
                </motion.h2>
                <p className="mt-5 max-w-xl text-sm font-medium leading-relaxed text-brand-green-mid/70 md:text-base">
                   {t.closure.desc}
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                     onClick={() => navigate('/paciente')}
                     className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-green-deep px-8 py-4 text-base font-bold text-brand-ivory shadow-xl transition-all hover:bg-brand-green-mid active:scale-95"
                  >
                    {t.closure.cta}
                    <ArrowRight size={18} />
                  </button>
                  <button
                     onClick={() => navigate('/medico')}
                     className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-green-deep/10 bg-brand-neutral px-8 py-4 text-base font-bold text-brand-green-deep transition-all hover:border-brand-gold/50"
                  >
                    Soy profesional
                  </button>
                </div>
              </div>

              <div className="bg-brand-green-deep p-6 text-brand-ivory md:p-8">
                <div className="grid h-full grid-cols-1 gap-3">
                  {[
                    ['Paciente', 'Crear expediente privado y buscar médico validado.', <UserRound size={18} />],
                    ['Médico', 'Solicitar alta, configurar agenda y emitir receta.', <Stethoscope size={18} />],
                    ['Dispensario', 'Postular inventario y registrar entregas trazables.', <ShoppingBag size={18} />],
                  ].map(([title, desc, icon]) => (
                    <button
                      key={title as string}
                      onClick={() => navigate(title === 'Paciente' ? '/paciente' : title === 'Médico' ? '/medico' : '/dispensario')}
                      className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold text-brand-green-deep">
                        {icon}
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-brand-ivory/62">{desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
           </div>
        </section>
      </main>
      <Footer />
      </div>
  );
}

function NetworkPreview({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [selectedDetail, setSelectedDetail] = useState<null | {
    title: string;
    desc: string;
    action: string;
    path: string;
    icon: ReactNode;
    eyebrow: string;
    invite: string;
    points: string[];
  }>(null);

  const flowSteps = [
    {
      title: 'Expediente privado',
      desc: 'Únete para controlar tu historial, recetas y accesos privados.',
      action: 'Unirme como paciente',
      path: '/paciente',
      icon: <Activity size={20} />,
      eyebrow: 'Paciente',
      invite: 'Crea tu espacio privado para agendar con médicos, recibir recetas y revisar dispensarios autorizados.',
      points: [
        'Historial clínico portable con síntomas, exámenes y tratamiento.',
        'Acceso por consentimiento temporal para médicos o validadores.',
        'Hashes verificables sin publicar diagnóstico ni documentos completos.',
      ],
    },
    {
      title: 'Receta verificable',
      desc: 'Postula como profesional y opera recetas verificables.',
      action: 'Registrarme como médico',
      path: '/medico',
      icon: <Stethoscope size={20} />,
      eyebrow: 'Médico',
      invite: 'Solicita alta profesional para que el equipo admin revise licencia, especialidad y wallet antes de habilitar tu panel.',
      points: [
        'Agenda y seguimiento de pacientes desde el panel profesional.',
        'Emisión de receta vinculada a wallet y evidencia autorizada.',
        'Dosis, vigencia y saldo disponible listos para validación.',
      ],
    },
    {
      title: 'Entrega trazable',
      desc: 'Suma tu dispensario para validar recetas y operar inventario.',
      action: 'Unir mi dispensario',
      path: '/dispensario',
      icon: <ShoppingBag size={20} />,
      eyebrow: 'Dispensario',
      invite: 'Postula tu dispensario para operar inventario, validar recetas y registrar entregas cuando admin apruebe el acceso.',
      points: [
        'Inventario por producto, lote y formato medicinal.',
        'Validación de receta vigente sin exponer historia clínica.',
        'Registro de entrega parcial para no quemar todo el tratamiento.',
      ],
    },
  ];

  return (
    <section id="red" className="relative overflow-hidden bg-white py-12 md:py-16">
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src="https://images.pexels.com/photos/7667731/pexels-photo-7667731.jpeg?auto=compress&cs=tinysrgb&w=1800"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-[0.09]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/88 to-brand-neutral/70" />
      </div>
      <div className="container relative mx-auto px-6 md:px-12">
        <div className="mb-8 max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Red Trust Leaf</p>
          <h2 className="mt-2 text-3xl font-serif text-brand-green-deep md:text-5xl">
            Privacidad clínica, receta verificable y medicina trazable.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-brand-green-mid/70 md:text-base">
            La plataforma separa lo que ve cada actor: el paciente controla sus datos, el médico valida el tratamiento y el dispensario confirma solo lo necesario para entregar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {flowSteps.map((item) => (
            <button
              key={item.title}
              onClick={() => setSelectedDetail(item)}
              className="group rounded-2xl border border-brand-green-deep/10 bg-white/82 p-5 text-left shadow-sm backdrop-blur-sm transition-colors hover:border-brand-gold/50 hover:bg-white"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-green-deep text-brand-gold">
                {item.icon}
              </div>
              <h3 className="text-xl font-bold text-brand-green-deep">{item.title}</h3>
              <p className="mt-2 min-h-[64px] text-sm leading-relaxed text-brand-green-mid/70">{item.desc}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-green-deep group-hover:text-brand-gold">
                {item.action}
                <ArrowRight size={15} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedDetail && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-brand-green-deep/75 p-4 backdrop-blur-sm"
          onClick={() => setSelectedDetail(null)}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-brand-green-deep/10 bg-brand-neutral/60 p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">{selectedDetail.eyebrow}</p>
                <h3 className="mt-2 text-3xl font-serif text-brand-green-deep">{selectedDetail.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-brand-green-mid/70">{selectedDetail.desc}</p>
                <p className="mt-4 rounded-2xl border border-brand-gold/20 bg-white/70 p-4 text-sm font-bold leading-relaxed text-brand-green-deep">
                  {selectedDetail.invite}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="rounded-full p-2 text-brand-green-mid hover:bg-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 p-6">
              {selectedDetail.points.map((point) => (
                <div key={point} className="flex gap-3 rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/50 p-4">
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-brand-gold" />
                  <p className="text-sm leading-relaxed text-brand-green-deep">{point}</p>
                </div>
              ))}
              <button
                onClick={() => onNavigate(selectedDetail.path)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory"
              >
                {selectedDetail.action}
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}

function MvpStatusRoute({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate: (path: string) => void;
}) {
  const [readiness, setReadiness] = useState<any | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadReadiness = async () => {
      try {
        const response = await fetch('/api/stellar/readiness');
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'No fue posible leer readiness.');
        }
        if (!cancelled) {
          setReadiness(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setReadinessError(error instanceof Error ? error.message : 'No fue posible leer readiness.');
        }
      }
    };

    void loadReadiness();

    return () => {
      cancelled = true;
    };
  }, []);

  const demoSteps = [
    ['1', 'Admin', '/admin', 'Aprobar medico/dispensario y registrar wallets en Testnet.'],
    ['2', 'Medico', '/medico/operacion', 'Emitir receta con vigencia, cupo y hash clinico.'],
    ['3', 'Paciente', '/paciente/recetas', 'Ver receta activa, saldo, vencimiento y QR conceptual.'],
    ['4', 'Dispensario', '/dispensario/operacion', 'Validar receta, elegir lote y registrar retiro parcial.'],
  ];
  const checks = [
    ['Contratos', Boolean(readiness?.capabilities?.readContracts), 'Lectura de contratos activa.'],
    ['Admin signer', Boolean(readiness?.signers?.admin?.configured), 'Puede registrar actores en Testnet.'],
    ['Medico signer', Boolean(readiness?.capabilities?.issuePrescriptions), 'Puede emitir recetas demo Testnet.'],
    ['Dispensario signer', Boolean(readiness?.capabilities?.dispensePrescriptions), 'Puede registrar retiros parciales.'],
    ['Passkeys', Boolean(readiness?.capabilities?.passkeyRelay && readiness?.capabilities?.passkeyDiscovery), 'Pendiente para wallet paciente real.'],
  ];

  return (
    <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
      <header className="sticky top-0 z-40 border-b border-brand-green-deep/10 bg-[#edf2ee]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <button onClick={onBack} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
              <Leaf size={20} />
            </span>
            <span className="text-lg font-bold">Trust Leaf</span>
          </button>
          <button
            onClick={() => onNavigate('/paciente')}
            className="rounded-full bg-brand-green-deep px-4 py-2 text-sm font-bold text-brand-ivory"
          >
            Abrir demo
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-12">
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.82fr]">
          <div className="rounded-[32px] bg-brand-green-deep p-7 text-brand-ivory shadow-2xl md:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">SCRUM status</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-serif leading-tight md:text-6xl">
              MVP demo rapido listo para revisar por roles.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-brand-ivory/70 md:text-base">
              Esta vista resume el estado operativo, las rutas de prueba y los pendientes que no bloquean la demo pero si importan antes de piloto.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['Produccion', 'www.trustleaf.org'],
                ['Red', readiness?.network ?? 'Stellar Testnet'],
                ['Sprint', 'Demo MVP semanal'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/80">{label}</p>
                  <p className="mt-1 break-all text-sm font-bold text-brand-ivory">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Readiness</p>
            <h2 className="mt-2 text-2xl font-serif">Estado tecnico</h2>
            <div className="mt-5 space-y-3">
              {checks.map(([label, done, desc]) => (
                <div key={label as string} className={`rounded-2xl border p-4 ${done ? 'border-green-100 bg-green-50' : 'border-amber-100 bg-amber-50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-brand-green-deep">{label}</p>
                    <span className={`rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${done ? 'text-green-700' : 'text-amber-700'}`}>
                      {done ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/65">{desc}</p>
                </div>
              ))}
            </div>
            {readinessError && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                {readinessError}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[32px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">QA grabable</p>
              <h2 className="mt-2 text-2xl font-serif">Ruta recomendada de prueba</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-green-mid/65">
                Usa estos accesos en orden. El objetivo es demostrar permisos, receta verificable y retiro parcial sin revelar ficha clinica completa.
              </p>
            </div>
            <a
              href="/api/stellar/readiness"
              className="rounded-2xl border border-brand-green-deep/10 bg-brand-neutral px-4 py-3 text-xs font-bold text-brand-green-deep"
            >
              Ver JSON readiness
            </a>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            {demoSteps.map(([step, label, path, desc]) => (
              <button
                key={path}
                onClick={() => onNavigate(path)}
                className="group rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/70 p-4 text-left transition-colors hover:border-brand-gold/50 hover:bg-white"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green-deep text-sm font-bold text-brand-ivory">
                  {step}
                </span>
                <p className="mt-4 text-base font-bold text-brand-green-deep">{label}</p>
                <p className="mt-2 min-h-[54px] text-xs leading-relaxed text-brand-green-mid/65">{desc}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-brand-green-deep group-hover:text-brand-gold">
                  Abrir {label}
                  <ArrowRight size={14} />
                </span>
              </button>
            ))}
          </div>
        </section>

        {readiness && (
          <section className="rounded-[32px] border border-brand-green-deep/10 bg-[#fbf7ef] p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Contratos activos</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ['DoctorRegistry', readiness.contracts.registryContractId],
                ['DispensaryRegistry', readiness.contracts.dispensaryRegistryContractId],
                ['Prescription', readiness.contracts.prescriptionContractId],
                ['DispenseRecord', readiness.contracts.dispenseRecordContractId],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                  <p className="mt-2 break-all font-mono text-xs text-brand-green-deep">{value}</p>
                </div>
              ))}
            </div>
            {readiness.missing?.length ? (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-white p-4 text-sm leading-relaxed text-amber-800">
                Pendiente para piloto: {readiness.missing.join(', ')}.
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}

function ProfessionalAccess({ onNavigate }: { onNavigate: (path: string) => void }) {
  const entries = [
    {
      path: '/paciente',
      label: 'Pacientes',
      desc: 'Entrar al portal, buscar médico y revisar recetas.',
      icon: <UserRound size={18} />,
    },
    {
      path: '/medico',
      label: 'Médicos',
      desc: 'Solicitar alta o entrar al panel de emision.',
      icon: <Stethoscope size={18} />,
    },
    {
      path: '/dispensario',
      label: 'Dispensarios',
      desc: 'Solicitar alta, validar receta y registrar entregas.',
      icon: <ShoppingBag size={18} />,
    },
    {
      path: '/admin',
      label: 'Admin',
      desc: 'Revisar solicitudes y estado operacional.',
      icon: <ShieldCheck size={18} />,
    },
    {
      path: '/mvp',
      label: 'MVP',
      desc: 'Checklist SCRUM, readiness y ruta de demo.',
      icon: <Database size={18} />,
    },
  ];

  return (
    <section id="profesionales" className="relative z-10 px-6 py-10 md:px-12">
      <div className="mx-auto max-w-6xl rounded-2xl border border-brand-green-deep/10 bg-white/86 p-5 shadow-sm backdrop-blur-md md:p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.8fr_1.7fr] lg:items-start">
          <div className="max-w-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Accesos separados</p>
            <h3 className="mt-2 text-2xl font-serif text-brand-green-deep">Cada rol tiene su propio camino.</h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
              Cada actor entra por su propio flujo y ve solo sus herramientas.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {entries.map((entry) => (
              <button
                key={entry.path}
                onClick={() => onNavigate(entry.path)}
                className="group flex min-h-[150px] flex-col items-start justify-between rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/70 p-4 text-left transition-colors hover:border-brand-gold/50 hover:bg-white"
              >
                <span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
                    {entry.icon}
                  </span>
                  <span className="mt-4 block text-base font-bold text-brand-green-deep">{entry.label}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-brand-green-mid/65">{entry.desc}</span>
                </span>
                <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-brand-green-deep group-hover:text-brand-gold">
                  Entrar
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AuthGate({
  role,
  title,
  description,
  primaryAction,
  demoAction,
  defaultEmail,
  defaultName,
  onBack,
  onStart,
}: {
  role: ActorRole;
  title: string;
  description: string;
  primaryAction: string;
  demoAction: string;
  defaultEmail: string;
  defaultName: string;
  onBack: () => void;
  onStart: (role: ActorRole, input: { email: string; name: string; mode?: TrustSession['mode'] }) => void;
}) {
  const [form, setForm] = useState({
    email: defaultEmail,
    name: defaultName,
  });

  const roleLabel = {
    patient: 'Paciente',
    doctor: 'Medico',
    dispensary: 'Dispensario',
    admin: 'Admin',
  }[role];

  const walletTiming = {
    patient: 'La cuenta se crea al entrar. Luego puedes activar passkey o Freighter desde Mi Cuenta.',
    doctor: 'La credencial profesional se vincula durante la solicitud o se crea automaticamente cuando admin aprueba.',
    dispensary: 'La credencial operativa se vincula durante el alta o se crea automaticamente al quedar aprobado.',
    admin: 'Admin usa una cuenta separada. La wallet pagadora y las secrets viven en backend, no en el navegador.',
  }[role];

  const submit = (mode: TrustSession['mode']) => {
    if (!form.email.trim() || !form.name.trim()) return;
    onStart(role, {
      email: form.email.trim(),
      name: form.name.trim(),
      mode,
    });
  };

  return (
    <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
      <header className="border-b border-brand-green-deep/10 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <button onClick={onBack} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
              <Leaf size={20} />
            </span>
            <span className="text-lg font-bold">Trust Leaf</span>
          </button>
          <span className="rounded-full border border-brand-green-deep/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid">
            {roleLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-5 py-10 md:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[32px] bg-brand-green-deep p-7 text-brand-ivory md:p-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">Acceso Trust Leaf</p>
          <h1 className="mt-6 text-4xl font-serif leading-tight md:text-5xl">{title}</h1>
          <p className="mt-5 text-sm leading-relaxed text-brand-ivory/70">{description}</p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">Wallet / credencial</p>
            <p className="mt-2 text-sm leading-relaxed text-brand-ivory/70">{walletTiming}</p>
          </div>
        </section>

        <section className="rounded-[32px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Acceso privado</p>
          <h2 className="mt-2 text-2xl font-serif">Sesion de trabajo</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
            Cada actor entra a su propio panel. La siguiente iteracion conecta este acceso con Auth y politicas por rol.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3">
            <label>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Nombre</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </label>
            <label>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => submit('email')}
              className="rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
            >
              {primaryAction}
            </button>
            <button
              type="button"
              onClick={() => submit('demo')}
              className="rounded-2xl border border-brand-green-deep/10 bg-[#fbf7ef] px-5 py-4 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-gold/10"
            >
              {demoAction}
            </button>
          </div>

        </section>
      </main>
    </div>
  );
}

function OperationalPendingRoute({
  roleLabel,
  title,
  description,
  primaryAction,
  secondaryAction,
  onPrimary,
  onSecondary,
  onBack,
}: {
  roleLabel: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
      <header className="border-b border-brand-green-deep/10 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <button onClick={onBack} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
              <Leaf size={20} />
            </span>
            <span className="text-lg font-bold">Trust Leaf</span>
          </button>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">
            Pendiente
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-5 py-10 md:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[32px] bg-brand-green-deep p-7 text-brand-ivory md:p-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">{roleLabel}</p>
          <h1 className="mt-6 text-4xl font-serif leading-tight md:text-5xl">{title}</h1>
          <p className="mt-5 text-sm leading-relaxed text-brand-ivory/70">{description}</p>
        </section>

        <section className="rounded-[32px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Control de acceso</p>
          <h2 className="mt-2 text-2xl font-serif">Antes de operar</h2>
          <div className="mt-5 space-y-3 text-sm text-brand-green-mid/70">
            <div className="rounded-2xl bg-brand-neutral p-4">1. Solicitud enviada por el actor.</div>
            <div className="rounded-2xl bg-brand-neutral p-4">2. Admin revisa datos, licencia o registro legal.</div>
            <div className="rounded-2xl bg-brand-neutral p-4">3. Admin aprueba y registra la wallet en Stellar Testnet.</div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onPrimary}
              className="rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
            >
              {primaryAction}
            </button>
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-2xl border border-brand-green-deep/10 bg-[#fbf7ef] px-5 py-4 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-gold/10"
            >
              {secondaryAction}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function AdminAuthGate({
  authState,
  onBack,
  onDemo,
}: {
  authState: AdminAuthState;
  onBack: () => void;
  onDemo: () => void;
}) {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.email.trim() || !form.password.trim()) {
      setError('Ingresa email y password del admin allowlist.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signInAdmin(form.email.trim(), form.password);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'No fue posible iniciar sesion admin.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
      <header className="border-b border-brand-green-deep/10 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <button onClick={onBack} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
              <Leaf size={20} />
            </span>
            <span className="text-lg font-bold">Trust Leaf</span>
          </button>
          <span className="rounded-full border border-brand-green-deep/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid">
            Admin
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-5 py-10 md:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[32px] bg-brand-green-deep p-7 text-brand-ivory md:p-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">Acceso protegido</p>
          <h1 className="mt-6 text-4xl font-serif leading-tight md:text-5xl">Admin aprueba actores antes de tocar Testnet.</h1>
          <p className="mt-5 text-sm leading-relaxed text-brand-ivory/70">
            El panel admin real usa Firebase Auth y allowlist en `appAdministrators`. El modo demo queda disponible solo para grabaciones controladas.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-3">
            {[
              ['Auth', authState.mode === 'checking' ? 'Verificando sesion' : 'Firebase email/password'],
              ['Allowlist', 'Documento appAdministrators/{uid}'],
              ['On-chain', 'Registro manual y auditable en Stellar Testnet'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/80">{label}</p>
                <p className="mt-1 text-sm font-bold text-brand-ivory">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Sesion admin</p>
          <h2 className="mt-2 text-2xl font-serif">Entrar con cuenta allowlist</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
            Si aun no existe el usuario admin o su documento allowlist, usa demo para revisar el flujo sin hacer pasar demo por produccion.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3">
            <label>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Email admin</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </label>
            <label>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </label>
          </div>

          {(error || authState.error || authState.mode === 'not-admin') && (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {error || authState.error || 'La cuenta inicio sesion, pero no esta en appAdministrators.'}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy || authState.mode === 'checking'}
              className="rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid disabled:cursor-wait disabled:opacity-60"
            >
              {busy || authState.mode === 'checking' ? 'Verificando...' : 'Entrar admin real'}
            </button>
            <button
              type="button"
              onClick={onDemo}
              className="rounded-2xl border border-brand-green-deep/10 bg-[#fbf7ef] px-5 py-4 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-gold/10"
            >
              Entrar admin demo
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function AdminRoute({
  onBack,
  session,
  onSignOut,
  doctorRegistrations,
  registrations,
  registrationSource,
  onReviewDoctorRegistration,
  onReviewRegistration,
  onAddDoctorManually,
  onAddDispensaryManually,
  onRegisterDoctorOnchain,
  onRegisterDispensaryOnchain,
}: {
  onBack: () => void;
  session: TrustSession | null;
  onSignOut: () => void;
  doctorRegistrations: DoctorRegistration[];
  registrations: DispensaryRegistration[];
  registrationSource: PersistenceSource;
  onReviewDoctorRegistration: (id: string, status: Extract<DispensaryRegistrationStatus, 'approved' | 'rejected' | 'needs_review'>) => void;
  onReviewRegistration: (id: string, status: Extract<DispensaryRegistrationStatus, 'approved' | 'rejected' | 'needs_review'>) => void;
  onAddDoctorManually: (input: Omit<DoctorRegistration, 'id' | 'status' | 'submittedAt' | 'reviewedAt' | 'onchainStatus'>) => void;
  onAddDispensaryManually: (input: Omit<DispensaryRegistration, 'id' | 'status' | 'submittedAt' | 'reviewedAt' | 'onchainStatus'>) => void;
  onRegisterDoctorOnchain: (request: DoctorRegistration) => Promise<unknown>;
  onRegisterDispensaryOnchain: (request: DispensaryRegistration) => Promise<unknown>;
}) {
  const pending = registrations.filter((request) => request.status === 'pending');
  const approved = registrations.filter((request) => request.status === 'approved');
  const pendingDoctors = doctorRegistrations.filter((request) => request.status === 'pending');
  const approvedDoctors = doctorRegistrations.filter((request) => request.status === 'approved');
  const [registryModal, setRegistryModal] = useState<'doctors' | 'dispensaries' | null>(null);
  const [manualDoctor, setManualDoctor] = useState({
    name: 'Dra. Sofia Lagos',
    licenseId: 'MED-CL-20441',
    specialty: 'Medicina cannábica',
    contact: 'sofia@trustleaf.org',
    wallet: 'GDOCMANUALTRUSTLEAFTESTNET000000000000000000000',
  });
  const [manualDispensary, setManualDispensary] = useState({
    name: 'Green Leaf Center',
    legalId: 'DSP-CL-8821',
    address: 'Av. Principal 123',
    contact: 'operaciones@greenleaf.test',
    wallet: 'GDISPMANUALTRUSTLEAFTESTNET00000000000000000000',
  });
  const [onchainAction, setOnchainAction] = useState<string | null>(null);
  const [onchainNotice, setOnchainNotice] = useState<string | null>(null);

  const runOnchainAction = async (
    key: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setOnchainAction(key);
    setOnchainNotice(null);
    try {
      await action();
      setOnchainNotice(successMessage);
    } catch (error) {
      setOnchainNotice(error instanceof Error ? error.message : 'No fue posible completar la accion on-chain.');
    } finally {
      setOnchainAction(null);
    }
  };

  const addManualDoctor = () => {
    if (!manualDoctor.name || !manualDoctor.licenseId || !manualDoctor.specialty || !manualDoctor.contact || !manualDoctor.wallet) {
      return;
    }

    onAddDoctorManually(manualDoctor);
  };

  const addManualDispensary = () => {
    if (!manualDispensary.name || !manualDispensary.legalId || !manualDispensary.address || !manualDispensary.contact || !manualDispensary.wallet) {
      return;
    }

    onAddDispensaryManually(manualDispensary);
  };

  const prepareAdminDemo = () => {
    pendingDoctors.forEach((request) => onReviewDoctorRegistration(request.id, 'approved'));
    pending.forEach((request) => onReviewRegistration(request.id, 'approved'));

    if (approvedDoctors.length === 0 && pendingDoctors.length === 0) {
      onAddDoctorManually(manualDoctor);
    }

    if (approved.length === 0 && pending.length === 0) {
      onAddDispensaryManually(manualDispensary);
    }
  };

  return (
    <div className="min-h-screen bg-brand-ivory text-brand-green-deep">
      <div className="border-b border-brand-green-deep/10 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Trust Leaf</p>
            <h1 className="text-2xl md:text-3xl font-serif">Admin Operacional</h1>
            <p className="mt-1 text-xs text-brand-green-mid/60">
              Persistencia: {registrationSource === 'supabase' ? 'Supabase' : registrationSource === 'firebase' ? 'Firebase' : 'Demo local'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <span className="hidden rounded-xl border border-brand-green-deep/10 bg-brand-neutral px-3 py-2 text-xs font-bold text-brand-green-mid md:inline-flex">
                {session.email}
              </span>
            )}
            <button
              onClick={onSignOut}
              className="px-4 py-2 rounded-xl border border-brand-green-deep/10 bg-white text-sm font-bold text-brand-green-deep hover:bg-brand-neutral transition-colors"
            >
              Salir
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-brand-green-deep text-brand-ivory text-sm font-bold hover:bg-brand-green-mid transition-colors"
            >
              Volver al landing
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <section className="rounded-3xl border border-brand-green-deep/10 bg-[#fbf7ef] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Centro de control</p>
              <h2 className="mt-2 text-3xl font-serif">Preparar red para demo</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brand-green-mid/70">
                Admin puede aprobar solicitudes reales o crear actores verificados manualmente. Para grabar, deja al menos un medico y un dispensario live antes de mostrar el flujo paciente.
              </p>
            </div>
            <button
              type="button"
              onClick={prepareAdminDemo}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-all hover:bg-brand-green-mid active:scale-95"
            >
              Preparar demo admin
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              ['Medicos live', approvedDoctors.length],
              ['Dispensarios live', approved.length],
              ['Solicitudes medico', pendingDoctors.length],
              ['Solicitudes dispensario', pending.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                <p className="mt-1 text-2xl font-bold text-brand-green-deep">{value}</p>
              </div>
            ))}
          </div>
          {onchainNotice && (
            <div className="mt-5 rounded-2xl border border-brand-gold/30 bg-white px-4 py-3 text-sm text-brand-green-mid">
              {onchainNotice}
            </div>
          )}
        </section>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ['DoctorRegistry', 'Médicos autorizados para emitir recetas.'],
            ['DispensaryRegistry', 'Dispensarios autorizados para consumir recetas.'],
            ['Prescription + DispenseRecord', 'Recetas y entregas auditables en Testnet.'],
          ].map(([title, desc]) => (
            <div key={title} className="bg-white border border-brand-green-deep/10 rounded-2xl p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Contrato</p>
              <h2 className="text-xl font-bold mb-2">{title}</h2>
              <p className="text-sm text-brand-green-mid/70">{desc}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-white border border-brand-green-deep/10 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Solicitudes</p>
                <h2 className="text-2xl font-serif mb-2">Registro de médicos</h2>
                <p className="text-sm text-brand-green-mid/70 max-w-2xl">
                  Revisa licencias, aprueba médicos y habilita el POV profesional para emitir recetas.
                  En el siguiente paso esta aprobación se conectará con DoctorRegistry.
                </p>
              </div>
              <span className="rounded-full bg-brand-neutral px-3 py-1 text-xs font-bold text-brand-green-mid">
                {pendingDoctors.length} pendientes
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {doctorRegistrations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/40 p-6 text-sm text-brand-green-mid/70">
                  <p>Aún no hay solicitudes. Los médicos pueden entrar a `/medico`, pero admin también puede cargar uno manualmente.</p>
                  <button
                    onClick={() => setRegistryModal('doctors')}
                    className="mt-4 rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory"
                  >
                    Agregar médico manual
                  </button>
                </div>
              )}

              {doctorRegistrations.map((request) => (
                <div key={request.id} className="rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/60 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-lg font-bold">{request.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                          request.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : request.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <p className="text-xs text-brand-green-mid/70">{request.specialty}</p>
                      <p className="mt-2 text-xs font-mono text-brand-green-mid/60 break-all">{request.wallet}</p>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-brand-green-mid/70 sm:grid-cols-2">
                        <span>Licencia: <strong>{request.licenseId}</strong></span>
                        <span>Contacto: <strong>{request.contact}</strong></span>
                      </div>
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onReviewDoctorRegistration(request.id, 'approved')}
                          className="rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory hover:bg-brand-green-mid"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => onReviewDoctorRegistration(request.id, 'rejected')}
                          className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                        >
                          Rechazar
                        </button>
                        <button
                          onClick={() => onReviewDoctorRegistration(request.id, 'needs_review')}
                          className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50"
                        >
                          Pedir revision
                        </button>
                      </div>
                    )}
                    {request.status === 'approved' && (
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid">
                          On-chain: {request.onchainStatus}
                        </span>
                        {request.onchainStatus !== 'registered' && (
                          <button
                            onClick={() =>
                              runOnchainAction(
                                `doctor-${request.id}`,
                                () => onRegisterDoctorOnchain(request),
                                'Medico registrado en DoctorRegistry Testnet.',
                              )
                            }
                            disabled={onchainAction === `doctor-${request.id}`}
                            className="rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory hover:bg-brand-green-mid disabled:cursor-wait disabled:opacity-60"
                          >
                            {onchainAction === `doctor-${request.id}` ? 'Registrando...' : 'Registrar Testnet'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRegistryModal('doctors')}
            className="bg-brand-green-deep text-left text-brand-ivory border border-brand-green-deep/10 rounded-2xl p-6 transition-transform active:scale-[0.99]"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Medical network</p>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-serif mb-4">{approvedDoctors.length} médicos live</h2>
              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-ivory/70">
                Ver detalle
              </span>
            </div>
            <div className="space-y-3">
              {approvedDoctors.length === 0 ? (
                <p className="text-sm text-brand-ivory/60">Cuando apruebes o agregues un médico, aparecerá aquí como autorizado.</p>
              ) : (
                approvedDoctors.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-bold">{request.name}</p>
                    <p className="mt-1 text-xs text-brand-ivory/60">{request.specialty}</p>
                  </div>
                ))
              )}
            </div>
          </button>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-white border border-brand-green-deep/10 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Solicitudes</p>
                <h2 className="text-2xl font-serif mb-2">Registro de dispensarios</h2>
                <p className="text-sm text-brand-green-mid/70 max-w-2xl">
                  Revisa la solicitud, aprueba el ingreso y el dispensario queda visible como autorizado en esta demo.
                  El siguiente paso sera ejecutar `add_dispensary` on-chain con la cuenta admin.
                </p>
              </div>
              <span className="rounded-full bg-brand-neutral px-3 py-1 text-xs font-bold text-brand-green-mid">
                {pending.length} pendientes
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {registrations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/40 p-6 text-sm text-brand-green-mid/70">
                  <p>Aún no hay solicitudes. Los dispensarios pueden entrar a `/dispensario`, pero admin también puede cargar uno manualmente.</p>
                  <button
                    onClick={() => setRegistryModal('dispensaries')}
                    className="mt-4 rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory"
                  >
                    Agregar dispensario manual
                  </button>
                </div>
              )}

              {registrations.map((request) => (
                <div key={request.id} className="rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/60 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-lg font-bold">{request.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                          request.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : request.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <p className="text-xs text-brand-green-mid/70">{request.address}</p>
                      <p className="mt-2 text-xs font-mono text-brand-green-mid/60 break-all">{request.wallet}</p>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-brand-green-mid/70 sm:grid-cols-2">
                        <span>Registro legal: <strong>{request.legalId}</strong></span>
                        <span>Contacto: <strong>{request.contact}</strong></span>
                      </div>
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onReviewRegistration(request.id, 'approved')}
                          className="rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory hover:bg-brand-green-mid"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => onReviewRegistration(request.id, 'rejected')}
                          className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                        >
                          Rechazar
                        </button>
                        <button
                          onClick={() => onReviewRegistration(request.id, 'needs_review')}
                          className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50"
                        >
                          Pedir revision
                        </button>
                      </div>
                    )}
                    {request.status === 'approved' && (
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid">
                          On-chain: {request.onchainStatus}
                        </span>
                        {request.onchainStatus !== 'registered' && (
                          <button
                            onClick={() =>
                              runOnchainAction(
                                `dispensary-${request.id}`,
                                () => onRegisterDispensaryOnchain(request),
                                'Dispensario registrado en DispensaryRegistry Testnet.',
                              )
                            }
                            disabled={onchainAction === `dispensary-${request.id}`}
                            className="rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory hover:bg-brand-green-mid disabled:cursor-wait disabled:opacity-60"
                          >
                            {onchainAction === `dispensary-${request.id}` ? 'Registrando...' : 'Registrar Testnet'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRegistryModal('dispensaries')}
            className="bg-brand-green-deep text-left text-brand-ivory border border-brand-green-deep/10 rounded-2xl p-6 transition-transform active:scale-[0.99]"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Live network</p>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-serif mb-4">{approved.length} dispensarios live</h2>
              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-ivory/70">
                Ver detalle
              </span>
            </div>
            <div className="space-y-3">
              {approved.length === 0 ? (
                <p className="text-sm text-brand-ivory/60">Cuando apruebes o agregues un dispensario, aparecer? aqu? como autorizado.</p>
              ) : (
                approved.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-bold">{request.name}</p>
                    <p className="mt-1 text-xs text-brand-ivory/60">{request.address}</p>
                  </div>
                ))
              )}
            </div>
          </button>
        </section>

        <section className="rounded-2xl border border-brand-green-deep/10 bg-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Agentes 402</p>
              <h2 className="text-2xl font-serif mb-2">Privacidad verificable</h2>
              <p className="max-w-3xl text-sm leading-relaxed text-brand-green-mid/70">
                Los agentes validan información sensible sin exponer documentos completos. El resultado que viaja a Stellar es una wallet autorizada, estado verificable y hash de metadata.
              </p>
            </div>
            <span className="rounded-full bg-brand-neutral px-3 py-1 text-xs font-bold text-brand-green-mid">
              Arquitectura privada
            </span>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ['Compliance Agent', 'Verifica licencias, documentos y estado profesional antes de aprobar actores.'],
              ['Prescription Agent', 'Valida receta, vigencia y consumo sin revelar diagnóstico o notas clínicas.'],
              ['Eligibility Agent', 'Responde si el paciente puede acceder según permisos privados y jurisdicción.'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-brand-green-deep/10 bg-brand-neutral/40 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
                  <ShieldCheck size={16} />
                </div>
                <h3 className="text-sm font-bold text-brand-green-deep">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-brand-green-mid/65">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      {registryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-green-deep/75 p-4 backdrop-blur-md">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-brand-green-deep/10 p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">
                  {registryModal === 'doctors' ? 'Medical network' : 'Live network'}
                </p>
                <h2 className="mt-2 text-2xl font-serif">
                  {registryModal === 'doctors' ? 'Médicos autorizados' : 'Dispensarios autorizados'}
                </h2>
                <p className="mt-2 max-w-xl text-sm text-brand-green-mid/65">
                  Revisa actores ya aprobados o agrega manualmente un actor validado por admin.
                </p>
              </div>
              <button onClick={() => setRegistryModal(null)} className="rounded-full p-2 hover:bg-brand-neutral">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {registryModal === 'doctors' ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-3">
                    {approvedDoctors.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/40 p-5 text-sm text-brand-green-mid/70">
                        Aún no hay médicos live. Agrega uno manualmente para preparar el demo.
                      </div>
                    ) : (
                      approvedDoctors.map((doctor) => (
                        <div key={doctor.id} className="rounded-2xl border border-brand-green-deep/10 bg-brand-neutral/40 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-brand-green-deep">{doctor.name}</p>
                              <p className="mt-1 text-xs text-brand-green-mid/65">{doctor.specialty}</p>
                            </div>
                            <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-green-700">Live</span>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-brand-green-mid/70">
                            <span>Licencia: <strong>{doctor.licenseId}</strong></span>
                            <span>Contacto: <strong>{doctor.contact}</strong></span>
                            <span className="break-all font-mono">{doctor.wallet}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/70 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">Alta manual</p>
                    <div className="mt-4 space-y-3">
                      {[
                        ['name', 'Nombre médico'],
                        ['licenseId', 'Licencia'],
                        ['specialty', 'Especialidad'],
                        ['contact', 'Contacto'],
                        ['wallet', 'Wallet Stellar'],
                      ].map(([key, label]) => (
                        <label key={key} className="block">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</span>
                          <input
                            value={manualDoctor[key as keyof typeof manualDoctor]}
                            onChange={(event) => setManualDoctor((current) => ({ ...current, [key]: event.target.value }))}
                            className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40"
                          />
                        </label>
                      ))}
                      <button onClick={addManualDoctor} className="w-full rounded-xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory">
                        Agregar médico autorizado
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-3">
                    {approved.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/40 p-5 text-sm text-brand-green-mid/70">
                        Aún no hay dispensarios live. Agrega uno manualmente para preparar el demo.
                      </div>
                    ) : (
                      approved.map((dispensary) => (
                        <div key={dispensary.id} className="rounded-2xl border border-brand-green-deep/10 bg-brand-neutral/40 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-brand-green-deep">{dispensary.name}</p>
                              <p className="mt-1 text-xs text-brand-green-mid/65">{dispensary.address}</p>
                            </div>
                            <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-green-700">Live</span>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-brand-green-mid/70">
                            <span>Registro legal: <strong>{dispensary.legalId}</strong></span>
                            <span>Contacto: <strong>{dispensary.contact}</strong></span>
                            <span className="break-all font-mono">{dispensary.wallet}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/70 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">Alta manual</p>
                    <div className="mt-4 space-y-3">
                      {[
                        ['name', 'Nombre dispensario'],
                        ['legalId', 'Registro legal'],
                        ['address', 'Dirección'],
                        ['contact', 'Contacto'],
                        ['wallet', 'Wallet Stellar'],
                      ].map(([key, label]) => (
                        <label key={key} className="block">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</span>
                          <input
                            value={manualDispensary[key as keyof typeof manualDispensary]}
                            onChange={(event) => setManualDispensary((current) => ({ ...current, [key]: event.target.value }))}
                            className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40"
                          />
                        </label>
                      ))}
                      <button onClick={addManualDispensary} className="w-full rounded-xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory">
                        Agregar dispensario autorizado
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DispensaryRegistrationRoute({
  onBack,
  onNavigate,
  dispensaryRegistrations,
  canOperate,
  onSubmitDispensaryRegistration,
}: {
  onBack: () => void;
  onNavigate: (path: string) => void;
  dispensaryRegistrations: DispensaryRegistration[];
  canOperate: boolean;
  onSubmitDispensaryRegistration: (input: Omit<DispensaryRegistration, 'id' | 'status' | 'submittedAt' | 'onchainStatus'>) => void;
}) {
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    legalId: '',
    address: '',
    contact: '',
    wallet: '',
  });
  const latestRegistration = dispensaryRegistrations[0];
  const approved = dispensaryRegistrations.filter((request) => request.status === 'approved');

  const submitRegistration = () => {
    if (!registrationForm.name || !registrationForm.legalId || !registrationForm.address || !registrationForm.contact) {
      return;
    }

    onSubmitDispensaryRegistration({
      ...registrationForm,
      wallet: registrationForm.wallet || DEFAULT_DISPENSARY_WALLET,
    });
    setRegistrationForm({
      name: '',
      legalId: '',
      address: '',
      contact: '',
      wallet: '',
    });
  };

  return (
    <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
      <header className="sticky top-0 z-40 border-b border-brand-green-deep/10 bg-[#edf2ee]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <button onClick={onBack} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
              <Leaf size={20} />
            </span>
            <span className="text-lg font-bold">Trust Leaf</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('/dispensario/operacion')}
              className={`rounded-full px-4 py-2 text-sm font-bold active:scale-95 ${
                canOperate
                  ? 'bg-brand-green-deep text-brand-ivory'
                  : 'border border-brand-green-deep/10 bg-white text-brand-green-deep'
              }`}
            >
              {canOperate ? 'Operar' : 'Ver estado'}
            </button>
            <button
              onClick={() => onNavigate('/admin')}
              className="hidden rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-green-deep md:block"
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:grid-cols-[0.95fr_1.05fr] md:px-8 md:py-12">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-brand-green-deep/10 bg-brand-green-deep p-7 text-brand-ivory shadow-2xl md:p-10"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">Registro de dispensario</p>
          <h1 className="mt-8 text-4xl font-serif leading-tight md:text-6xl">Primero solicita el alta. Después operas.</h1>
          <p className="mt-6 text-sm leading-relaxed text-brand-ivory/70 md:text-base">
            El dispensario completa su solicitud, Trust Leaf revisa desde admin y, al aprobar, queda listo para validar recetas y registrar entregas. La credencial Stellar puede conectarse ahora o crearse al aprobar.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['Pendiente', dispensaryRegistrations.filter((item) => item.status === 'pending').length],
              ['Live', approved.length],
              ['Red', 'Testnet'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/80">{label}</p>
                <p className="mt-2 text-sm font-bold text-brand-ivory">{value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-4"
        >
          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Solicitud</p>
                <h2 className="mt-2 text-2xl font-serif">Datos para revisión admin</h2>
              </div>
              {latestRegistration && (
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  latestRegistration.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : latestRegistration.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}>
                  {latestRegistration.status === 'approved' ? 'Live' : latestRegistration.status}
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['name', 'Nombre comercial'],
                ['legalId', 'Registro sanitario / legal'],
                ['address', 'Dirección operativa'],
                ['contact', 'Contacto responsable'],
                ['wallet', 'Wallet/Credencial Stellar del dispensario (opcional)'],
              ].map(([key, label]) => (
                <label key={key} className={key === 'wallet' ? 'sm:col-span-2' : ''}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">{label}</span>
                  <input
                    value={registrationForm[key as keyof typeof registrationForm]}
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                  {key === 'wallet' && (
                    <button
                      type="button"
                      onClick={() => setRegistrationForm((current) => ({ ...current, wallet: DEFAULT_DISPENSARY_WALLET }))}
                      className="mt-2 rounded-xl border border-brand-green-deep/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-green-deep"
                    >
                      Usar credencial gestionada Trust Leaf
                    </button>
                  )}
                </label>
              ))}
            </div>

            <button
              onClick={submitRegistration}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green-deep px-5 py-3 text-sm font-bold text-brand-ivory hover:bg-brand-green-mid active:scale-95"
            >
              Enviar solicitud al admin <ArrowRight size={16} />
            </button>
          </div>

          <div className={`rounded-[24px] border p-5 ${
            canOperate
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]">
              {canOperate ? 'Estado live' : 'Pendiente de aprobacion'}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              {canOperate
                ? 'Este dispensario ya puede entrar al panel operativo, validar recetas y registrar retiros en Testnet.'
                : 'La solicitud puede enviarse ahora, pero el panel operativo queda bloqueado hasta que admin apruebe el alta.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={() => onNavigate('/dispensario/operacion')}
              className="group flex items-center justify-between rounded-2xl border border-brand-green-deep/10 bg-white p-5 text-left shadow-sm hover:border-brand-gold/40"
            >
              <span className="flex items-center gap-3 font-bold"><ShieldCheck size={18} /> Operación</span>
              <ArrowRight size={18} className="text-brand-gold group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => onNavigate('/dispensario/historial')}
              className="group flex items-center justify-between rounded-2xl border border-brand-green-deep/10 bg-white p-5 text-left shadow-sm hover:border-brand-gold/40"
            >
              <span className="flex items-center gap-3 font-bold"><Database size={18} /> Historial</span>
              <ArrowRight size={18} className="text-brand-gold group-hover:translate-x-1" />
            </button>
          </div>
        </motion.section>
      </main>
    </div>
  );
}

function DoctorRegistrationRoute({
  onBack,
  onNavigate,
  doctorRegistrations,
  canOperate,
  onSubmitDoctorRegistration,
}: {
  onBack: () => void;
  onNavigate: (path: string) => void;
  doctorRegistrations: DoctorRegistration[];
  canOperate: boolean;
  onSubmitDoctorRegistration: (input: Omit<DoctorRegistration, 'id' | 'status' | 'submittedAt' | 'onchainStatus'>) => void;
}) {
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    licenseId: '',
    specialty: '',
    contact: '',
    wallet: '',
  });
  const latestRegistration = doctorRegistrations[0];
  const approved = doctorRegistrations.filter((request) => request.status === 'approved');

  const submitRegistration = () => {
    if (!registrationForm.name || !registrationForm.licenseId || !registrationForm.specialty || !registrationForm.contact) {
      return;
    }

    onSubmitDoctorRegistration({
      ...registrationForm,
      wallet: registrationForm.wallet || DEFAULT_DOCTOR_WALLET,
    });
    setRegistrationForm({
      name: '',
      licenseId: '',
      specialty: '',
      contact: '',
      wallet: '',
    });
  };

  return (
    <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
      <header className="sticky top-0 z-40 border-b border-brand-green-deep/10 bg-[#edf2ee]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <button onClick={onBack} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
              <Leaf size={20} />
            </span>
            <span className="text-lg font-bold">Trust Leaf</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('/medico/operacion')}
              className={`rounded-full px-4 py-2 text-sm font-bold active:scale-95 ${
                canOperate
                  ? 'bg-brand-green-deep text-brand-ivory'
                  : 'border border-brand-green-deep/10 bg-white text-brand-green-deep'
              }`}
            >
              {canOperate ? 'Emitir receta' : 'Ver estado'}
            </button>
            <button
              onClick={() => onNavigate('/admin')}
              className="hidden rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-green-deep md:block"
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:grid-cols-[0.95fr_1.05fr] md:px-8 md:py-12">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-brand-green-deep/10 bg-brand-green-deep p-7 text-brand-ivory shadow-2xl md:p-10"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">Registro médico</p>
          <h1 className="mt-8 text-4xl font-serif leading-tight md:text-6xl">Primero solicita el alta. Después emites recetas.</h1>
          <p className="mt-6 text-sm leading-relaxed text-brand-ivory/70 md:text-base">
            El medico presenta licencia y especialidad. Puede conectar wallet ahora o dejar que Trust Leaf cree una credencial profesional al aprobar el alta.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['Pendiente', doctorRegistrations.filter((item) => item.status === 'pending').length],
              ['Live', approved.length],
              ['Red', 'Testnet'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/80">{label}</p>
                <p className="mt-2 text-sm font-bold text-brand-ivory">{value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-4"
        >
          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Solicitud</p>
                <h2 className="mt-2 text-2xl font-serif">Datos para revisión admin</h2>
              </div>
              {latestRegistration && (
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  latestRegistration.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : latestRegistration.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}>
                  {latestRegistration.status === 'approved' ? 'Live' : latestRegistration.status}
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['name', 'Nombre profesional'],
                ['licenseId', 'Licencia / registro médico'],
                ['specialty', 'Especialidad'],
                ['contact', 'Contacto responsable'],
                ['wallet', 'Wallet/Credencial Stellar del medico (opcional)'],
              ].map(([key, label]) => (
                <label key={key} className={key === 'wallet' ? 'sm:col-span-2' : ''}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">{label}</span>
                  <input
                    value={registrationForm[key as keyof typeof registrationForm]}
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                  {key === 'wallet' && (
                    <button
                      type="button"
                      onClick={() => setRegistrationForm((current) => ({ ...current, wallet: DEFAULT_DOCTOR_WALLET }))}
                      className="mt-2 rounded-xl border border-brand-green-deep/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-green-deep"
                    >
                      Usar credencial gestionada Trust Leaf
                    </button>
                  )}
                </label>
              ))}
            </div>

            <button
              onClick={submitRegistration}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green-deep px-5 py-3 text-sm font-bold text-brand-ivory hover:bg-brand-green-mid active:scale-95"
            >
              Enviar solicitud al admin <ArrowRight size={16} />
            </button>
          </div>

          <div className={`rounded-[24px] border p-5 ${
            canOperate
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]">
              {canOperate ? 'Credencial activa' : 'Pendiente de aprobacion'}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              {canOperate
                ? 'Este medico ya puede entrar al panel profesional y emitir recetas verificables en Testnet.'
                : 'La solicitud puede enviarse ahora, pero la emision de recetas queda bloqueada hasta que admin apruebe la credencial.'}
            </p>
          </div>

          <button
            onClick={() => onNavigate('/medico/operacion')}
            className="group flex w-full items-center justify-between rounded-2xl border border-brand-green-deep/10 bg-white p-5 text-left shadow-sm hover:border-brand-gold/40"
          >
            <span className="flex items-center gap-3 font-bold"><Stethoscope size={18} /> Ir al panel médico</span>
            <ArrowRight size={18} className="text-brand-gold group-hover:translate-x-1" />
          </button>
        </motion.section>
      </main>
    </div>
  );
}

function RoleRoutePage({
  role,
  eyebrow,
  title,
  description,
  accent,
  defaultView,
  allowedViews,
  roleLabel,
  actions,
  metrics,
  onBack,
  onNavigate,
  dispensaryRegistrations = [],
  onSubmitDispensaryRegistration,
}: {
  role: string;
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  defaultView: PortalView;
  allowedViews: PortalView[];
  roleLabel: string;
  actions: Array<{ label: string; view: PortalView; icon: ReactNode }>;
  metrics: Array<[string, string]>;
  onBack: () => void;
  onNavigate: (path: string) => void;
  dispensaryRegistrations?: DispensaryRegistration[];
  onSubmitDispensaryRegistration?: (input: Omit<DispensaryRegistration, 'id' | 'status' | 'submittedAt'>) => void;
}) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [initialView, setInitialView] = useState<PortalView>(defaultView);
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    legalId: '',
    address: '',
    contact: '',
    wallet: '',
  });
  const latestRegistration = dispensaryRegistrations[0];

  const openWorkspace = (view: PortalView) => {
    setInitialView(view);
    setWorkspaceOpen(true);
  };

  const submitRegistration = () => {
    if (!onSubmitDispensaryRegistration) {
      return;
    }

    if (!registrationForm.name || !registrationForm.legalId || !registrationForm.address || !registrationForm.contact || !registrationForm.wallet) {
      return;
    }

    onSubmitDispensaryRegistration(registrationForm);
    setRegistrationForm({
      name: '',
      legalId: '',
      address: '',
      contact: '',
      wallet: '',
    });
  };

  return (
    <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
      <header className="sticky top-0 z-40 border-b border-brand-green-deep/10 bg-[#edf2ee]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <button onClick={onBack} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
              <Leaf size={20} />
            </span>
            <span className="text-lg font-bold">Trust Leaf</span>
          </button>
          <nav className="hidden items-center gap-2 md:flex">
            {ROLE_ROUTES.map((item) => (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  item.label === role
                    ? 'bg-brand-green-deep text-brand-ivory'
                    : 'text-brand-green-mid/60 hover:bg-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => openWorkspace(defaultView)}
            className="rounded-full bg-brand-gold px-4 py-2 text-sm font-bold text-brand-green-deep shadow-sm active:scale-95"
          >
            Abrir
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-12">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-brand-green-deep/10 bg-brand-green-deep p-7 text-brand-ivory shadow-2xl md:p-10"
        >
          <div className="mb-10 flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">{eyebrow}</p>
            <span className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-gold">
              {accent}
            </span>
          </div>
          <h1 className="max-w-3xl text-4xl font-serif leading-tight md:text-6xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-brand-ivory/70 md:text-base">{description}</p>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/80">{label}</p>
                <p className="mt-2 text-sm font-bold text-brand-ivory">{value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-4"
        >
          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Acciones del rol</p>
            <h2 className="mt-2 text-2xl font-serif">Workspace enfocado</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
              Cada botón abre solo las herramientas necesarias para este POV. Menos ruido visual, más operación real.
            </p>
          </div>

          {actions.map((action, index) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 + index * 0.04 }}
              onClick={() => openWorkspace(action.view)}
              className="group flex w-full items-center justify-between rounded-2xl border border-brand-green-deep/10 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-gold/40 hover:shadow-lg"
            >
              <span className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-neutral text-brand-green-deep group-hover:bg-brand-green-deep group-hover:text-brand-ivory">
                  {action.icon}
                </span>
                <span className="font-bold">{action.label}</span>
              </span>
              <ArrowRight size={18} className="text-brand-gold transition-transform group-hover:translate-x-1" />
            </motion.button>
          ))}

          {onSubmitDispensaryRegistration && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="rounded-[28px] border border-brand-green-deep/10 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Registro</p>
                  <h2 className="mt-2 text-2xl font-serif">Solicitar alta como dispensario</h2>
                </div>
                {latestRegistration && (
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                    latestRegistration.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : latestRegistration.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {latestRegistration.status === 'approved' ? 'Live' : latestRegistration.status}
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ['name', 'Nombre comercial'],
                  ['legalId', 'Registro sanitario / legal'],
                  ['address', 'Dirección operativa'],
                  ['contact', 'Contacto responsable'],
                  ['wallet', 'Wallet Stellar del dispensario'],
                ].map(([key, label]) => (
                  <label key={key} className={key === 'wallet' ? 'sm:col-span-2' : ''}>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">{label}</span>
                    <input
                      value={registrationForm[key as keyof typeof registrationForm]}
                      onChange={(event) =>
                        setRegistrationForm((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                    />
                  </label>
                ))}
              </div>

              <button
                onClick={submitRegistration}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green-deep px-5 py-3 text-sm font-bold text-brand-ivory hover:bg-brand-green-mid active:scale-95"
              >
                Enviar solicitud al admin <ArrowRight size={16} />
              </button>

              <p className="mt-3 text-xs leading-relaxed text-brand-green-mid/60">
                Esta solicitud queda preparada para revisión del admin. En producción se enviará al backend y, tras aprobación, ejecutará `add_dispensary` en Soroban.
              </p>
            </motion.div>
          )}
        </motion.section>
      </main>

      <MockupPortal
        isOpen={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        initialView={initialView}
        allowedViews={allowedViews}
        roleLabel={roleLabel}
      />
    </div>
  );
}


