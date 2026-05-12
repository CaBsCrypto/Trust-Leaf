/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Activity, ArrowRight, Database, FileText, Leaf, Lock, Package, ShieldCheck, ShoppingBag, Stethoscope, UserRound } from 'lucide-react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Solution from './components/Solution';
import Problem from './components/Problem';
import Process from './components/Process';
import Ecosystem from './components/Ecosystem';
import TrustDetail from './components/TrustDetail';
import FAQ from './components/FAQ';
import Metrics from './components/Metrics';
import PartnerCTA from './components/PartnerCTA';
import Footer from './components/Footer';
import MockupPortal, { PortalView } from './components/MockupPortal';

import { LanguageProvider, useLanguage } from './context/LanguageContext';

type DispensaryRegistrationStatus = 'pending' | 'approved' | 'rejected';

interface DispensaryRegistration {
  id: string;
  name: string;
  legalId: string;
  address: string;
  contact: string;
  wallet: string;
  status: DispensaryRegistrationStatus;
  submittedAt: string;
  reviewedAt?: string;
}

interface DoctorRegistration {
  id: string;
  name: string;
  licenseId: string;
  specialty: string;
  contact: string;
  wallet: string;
  status: DispensaryRegistrationStatus;
  submittedAt: string;
  reviewedAt?: string;
}

// Future hardening: these local registration records should move to Supabase
// with encrypted documents and an Agent 402 verification result. Admin approval
// should then write only the actor wallet + metadata hash to the Stellar registry.

const PATIENT_VIEWS: PortalView[] = ['overview', 'doctors', 'prescriptions', 'dispensaries', 'pickups', 'history', 'traveler'];
const DOCTOR_VIEWS: PortalView[] = ['doctors'];
const DISPENSARY_VIEWS: PortalView[] = ['dispensaries', 'history', 'pickups'];

const ROLE_ROUTES = [
  { path: '/paciente', label: 'Paciente' },
  { path: '/medico', label: 'Medico' },
  { path: '/dispensario', label: 'Dispensario' },
  { path: '/admin', label: 'Admin' },
];

const PATIENT_ROUTE_VIEWS: Record<string, PortalView> = {
  '/paciente': 'overview',
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

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath);
    setPath(window.location.pathname);
  };

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    localStorage.setItem('trust_dispensary_registrations', JSON.stringify(dispensaryRegistrations));
  }, [dispensaryRegistrations]);

  useEffect(() => {
    localStorage.setItem('trust_doctor_registrations', JSON.stringify(doctorRegistrations));
  }, [doctorRegistrations]);

  const submitDoctorRegistration = (input: Omit<DoctorRegistration, 'id' | 'status' | 'submittedAt'>) => {
    const request: DoctorRegistration = {
      ...input,
      id: `doc-req-${Date.now()}`,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    setDoctorRegistrations((current) => [request, ...current]);
  };

  const submitDispensaryRegistration = (input: Omit<DispensaryRegistration, 'id' | 'status' | 'submittedAt'>) => {
    const request: DispensaryRegistration = {
      ...input,
      id: `disp-req-${Date.now()}`,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    setDispensaryRegistrations((current) => [request, ...current]);
  };

  const reviewDispensaryRegistration = (id: string, status: Extract<DispensaryRegistrationStatus, 'approved' | 'rejected'>) => {
    setDispensaryRegistrations((current) =>
      current.map((request) =>
        request.id === id
          ? { ...request, status, reviewedAt: new Date().toISOString() }
          : request,
      ),
    );
  };

  const reviewDoctorRegistration = (id: string, status: Extract<DispensaryRegistrationStatus, 'approved' | 'rejected'>) => {
    setDoctorRegistrations((current) =>
      current.map((request) =>
        request.id === id
          ? { ...request, status, reviewedAt: new Date().toISOString() }
          : request,
      ),
    );
  };

  const patientView = PATIENT_ROUTE_VIEWS[path];
  if (patientView) {
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
    return (
      <DoctorRegistrationRoute
        onBack={() => navigate('/')}
        onNavigate={navigate}
        doctorRegistrations={doctorRegistrations}
        onSubmitDoctorRegistration={submitDoctorRegistration}
      />
    );
  }

  if (path === '/medico/operacion') {
    return (
      <MockupPortal
        isOpen
        onClose={() => navigate('/medico')}
        initialView="doctors"
        allowedViews={DOCTOR_VIEWS}
        pageMode
        roleLabel="Portal Medico"
      />
    );
  }

  if (path === '/dispensario') {
    return (
      <DispensaryRegistrationRoute
        onBack={() => navigate('/')}
        onNavigate={navigate}
        dispensaryRegistrations={dispensaryRegistrations}
        onSubmitDispensaryRegistration={submitDispensaryRegistration}
      />
    );
  }

  if (path === '/dispensario/operacion' || path === '/dispensario/historial' || path === '/dispensario/retiros') {
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
    return (
      <AdminRoute
        onBack={() => navigate('/')}
        doctorRegistrations={doctorRegistrations}
        registrations={dispensaryRegistrations}
        onReviewDoctorRegistration={reviewDoctorRegistration}
        onReviewRegistration={reviewDispensaryRegistration}
      />
    );
  }

  return (
    <div className="min-h-screen selection:bg-brand-gold/30 selection:text-brand-green-deep relative overflow-hidden bg-brand-ivory">
      <Navbar onPortalClick={() => navigate('/paciente')} />
      <main>
        <Hero onStartClick={() => navigate('/paciente')} />
        <MvpSnapshot onNavigate={navigate} />
        <ProfessionalAccess onNavigate={navigate} />
        <Ecosystem />
        <Problem />
        <Solution />
        <Metrics />
        <Process />
        <TrustDetail />
        <PartnerCTA />
        <FAQ />
        
        {/* Closure Section */}
        <section className="py-16 md:py-20 text-center px-6">
           <div className="max-w-2xl mx-auto text-brand-green-deep">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl sm:text-4xl md:text-6xl font-serif mb-6 md:mb-8 leading-tight"
              >
                 {t.closure.title}
              </motion.h2>
              <p className="text-brand-green-mid/70 mb-10 md:mb-12 leading-relaxed text-sm md:text-base max-w-lg mx-auto font-medium px-4">
                 {t.closure.desc}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 px-6 md:px-0">
                <button 
                   onClick={() => navigate('/paciente')}
                   className="w-full sm:w-auto px-10 py-5 font-bold bg-brand-green-deep text-brand-ivory rounded-2xl md:rounded-full hover:bg-brand-green-mid transition-all shadow-xl active:scale-95 text-lg"
                >
                  {t.closure.cta}
                </button>
              </div>
           </div>
        </section>
      </main>
      <Footer />
      </div>
  );
}

function MvpSnapshot({ onNavigate }: { onNavigate: (path: string) => void }) {
  const flowSteps = [
    {
      step: '01',
      title: 'Paciente prepara su expediente',
      desc: 'Sintomas, examenes y tratamiento viven cifrados. Comparte solo lo necesario con acceso 402.',
      action: 'Ver paciente',
      path: '/paciente/historial',
      icon: <UserRound size={20} />,
    },
    {
      step: '02',
      title: 'Medico valida y receta',
      desc: 'Agenda una consulta, revisa evidencia privada y emite una receta vinculada al paciente.',
      action: 'Panel medico',
      path: '/medico/operacion',
      icon: <Stethoscope size={20} />,
    },
    {
      step: '03',
      title: 'Dispensario entrega por lote',
      desc: 'Valida tratamiento vigente, registra producto, cantidad y prueba de entrega sin exponer diagnostico.',
      action: 'Operar stock',
      path: '/dispensario/operacion',
      icon: <ShoppingBag size={20} />,
    },
  ];

  const trustLayer = [
    ['Acceso 402 privado', 'El paciente autoriza vistas temporales de su informacion sensible.', <Lock size={18} />],
    ['Pruebas on-chain', 'Stellar guarda integridad, estado y trazabilidad, no diagnosticos.', <Database size={18} />],
    ['Credencial medica', 'Documentos verificables para medicos y aliados segun regulacion local.', <FileText size={18} />],
  ];

  return (
    <section className="bg-white py-14 md:py-20">
      <div className="container mx-auto px-6 md:px-12">
        <div className="mb-9 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">MVP en vivo</p>
            <h2 className="mt-2 max-w-3xl text-3xl font-serif text-brand-green-deep md:text-5xl">
              Un flujo privado desde la consulta hasta la entrega.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-brand-green-mid/70 md:text-base">
              Trust Leaf separa cada rol para que el paciente conserve control, el medico valide evidencia y el dispensario entregue medicina trazable.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/paciente/historial')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-green-deep px-5 py-3 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
          >
            Ver expediente privado
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[420px] overflow-hidden rounded-2xl bg-brand-green-deep">
            <img
              src="https://images.pexels.com/photos/7773107/pexels-photo-7773107.jpeg?auto=compress&cs=tinysrgb&w=1400"
              alt="Flores de cannabis medicinal en contenedor de vidrio"
              className="absolute inset-0 h-full w-full object-cover opacity-80"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-green-deep via-brand-green-deep/45 to-brand-green-deep/10" />
            <div className="relative z-10 flex min-h-[420px] flex-col justify-end p-6 text-brand-ivory md:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Prueba verificable</p>
              <h3 className="mt-2 max-w-md text-3xl font-serif md:text-4xl">Cada entrega conserva origen, lote y cantidad.</h3>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-ivory/70">
                La trazabilidad se puede auditar sin publicar diagnosticos, notas clinicas ni documentos completos.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2 text-xs font-bold">
                {['Flores', 'Aceites', 'Extractos'].map((item) => (
                  <div key={item} className="border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">{item}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/60 p-4 md:p-5">
            <div className="grid grid-cols-1 gap-3">
              {flowSteps.map((item) => (
                <div key={item.step} className="group rounded-xl border border-brand-green-deep/10 bg-white p-4 transition-colors hover:border-brand-gold/50">
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-green-deep text-brand-gold">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">{item.step}</p>
                        <button
                          onClick={() => onNavigate(item.path)}
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-brand-green-deep hover:text-brand-gold"
                        >
                          {item.action}
                          <ArrowRight size={13} />
                        </button>
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-brand-green-deep">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-brand-green-mid/70">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-brand-green-deep p-3 text-brand-ivory md:grid-cols-3">
              {trustLayer.map(([title, desc, icon]) => (
                <div key={title as string} className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-brand-gold">{icon}</div>
                  <div>
                    <p className="text-xs font-bold">{title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-brand-ivory/60">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfessionalAccess({ onNavigate }: { onNavigate: (path: string) => void }) {
  const entries = [
    {
      path: '/medico',
      label: 'Medicos',
      desc: 'Solicitar alta o entrar al panel de emision.',
      icon: <Stethoscope size={18} />,
    },
    {
      path: '/dispensario',
      label: 'Dispensarios',
      desc: 'Solicitar alta, validar RX y registrar entregas.',
      icon: <ShoppingBag size={18} />,
    },
    {
      path: '/admin',
      label: 'Admin',
      desc: 'Revisar solicitudes y estado operacional.',
      icon: <ShieldCheck size={18} />,
    },
  ];

  return (
    <section className="px-6 py-10 md:px-12 relative z-10">
      <div className="mx-auto max-w-5xl rounded-2xl border border-brand-green-deep/10 bg-white/80 p-3 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="px-3 py-2 md:max-w-xs">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Acceso profesional</p>
            <p className="mt-1 text-xs text-brand-green-mid/60">
              Entradas separadas para actores operativos. Pacientes continúan por el portal principal.
            </p>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            {entries.map((entry) => (
              <button
                key={entry.path}
                onClick={() => onNavigate(entry.path)}
                className="group flex min-h-[86px] items-center justify-between gap-3 rounded-xl border border-brand-green-deep/10 bg-brand-ivory/70 px-4 py-3 text-left transition-colors hover:border-brand-gold/50 hover:bg-white"
              >
                <span className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-green-deep text-brand-ivory">
                    {entry.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-brand-green-deep">{entry.label}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-brand-green-mid/60">{entry.desc}</span>
                  </span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-brand-gold transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AdminRoute({
  onBack,
  doctorRegistrations,
  registrations,
  onReviewDoctorRegistration,
  onReviewRegistration,
}: {
  onBack: () => void;
  doctorRegistrations: DoctorRegistration[];
  registrations: DispensaryRegistration[];
  onReviewDoctorRegistration: (id: string, status: Extract<DispensaryRegistrationStatus, 'approved' | 'rejected'>) => void;
  onReviewRegistration: (id: string, status: Extract<DispensaryRegistrationStatus, 'approved' | 'rejected'>) => void;
}) {
  const pending = registrations.filter((request) => request.status === 'pending');
  const approved = registrations.filter((request) => request.status === 'approved');
  const pendingDoctors = doctorRegistrations.filter((request) => request.status === 'pending');
  const approvedDoctors = doctorRegistrations.filter((request) => request.status === 'approved');

  return (
    <div className="min-h-screen bg-brand-ivory text-brand-green-deep">
      <div className="border-b border-brand-green-deep/10 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-gold">Trust Leaf</p>
            <h1 className="text-2xl md:text-3xl font-serif">Admin Operacional</h1>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-brand-green-deep text-brand-ivory text-sm font-bold hover:bg-brand-green-mid transition-colors"
          >
            Volver al landing
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ['DoctorRegistry', 'Medicos autorizados para emitir recetas.'],
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

        <section className="rounded-2xl border border-brand-green-deep/10 bg-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Agentes 402</p>
              <h2 className="text-2xl font-serif mb-2">Privacidad verificable</h2>
              <p className="max-w-3xl text-sm leading-relaxed text-brand-green-mid/70">
                Los agentes validan informacion sensible sin exponer documentos completos. El resultado que viaja a Stellar es una wallet autorizada, estado verificable y hash de metadata.
              </p>
            </div>
            <span className="rounded-full bg-brand-neutral px-3 py-1 text-xs font-bold text-brand-green-mid">
              MVP conceptual
            </span>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ['Compliance Agent', 'Verifica licencias, documentos y estado profesional antes de aprobar actores.'],
              ['Prescription Agent', 'Valida RX, vigencia y consumo sin revelar diagnostico o notas clinicas.'],
              ['Eligibility Agent', 'Responde si el paciente puede acceder segun permisos privados y jurisdiccion.'],
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

        <section className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-white border border-brand-green-deep/10 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Solicitudes</p>
                <h2 className="text-2xl font-serif mb-2">Registro de medicos</h2>
                <p className="text-sm text-brand-green-mid/70 max-w-2xl">
                  Revisa licencias, aprueba medicos y habilita el POV profesional para emitir recetas.
                  En el siguiente paso esta aprobacion se conectara con DoctorRegistry.
                </p>
              </div>
              <span className="rounded-full bg-brand-neutral px-3 py-1 text-xs font-bold text-brand-green-mid">
                {pendingDoctors.length} pendientes
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {doctorRegistrations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/40 p-6 text-sm text-brand-green-mid/70">
                  Aun no hay solicitudes. Entra a `/medico` y completa el formulario de registro.
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
                      <div className="flex gap-2">
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
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brand-green-deep text-brand-ivory border border-brand-green-deep/10 rounded-2xl p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Medical network</p>
            <h2 className="text-2xl font-serif mb-4">{approvedDoctors.length} medicos live</h2>
            <div className="space-y-3">
              {approvedDoctors.length === 0 ? (
                <p className="text-sm text-brand-ivory/60">Cuando apruebes una solicitud, aparecera aqui como medico autorizado.</p>
              ) : (
                approvedDoctors.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-bold">{request.name}</p>
                    <p className="mt-1 text-xs text-brand-ivory/60">{request.specialty}</p>
                  </div>
                ))
              )}
            </div>
          </div>
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
                  Aun no hay solicitudes. Entra a `/dispensario` y completa el formulario de registro.
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
                      <div className="flex gap-2">
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
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brand-green-deep text-brand-ivory border border-brand-green-deep/10 rounded-2xl p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Live network</p>
            <h2 className="text-2xl font-serif mb-4">{approved.length} dispensarios live</h2>
            <div className="space-y-3">
              {approved.length === 0 ? (
                <p className="text-sm text-brand-ivory/60">Cuando apruebes una solicitud, aparecera aqui como autorizada.</p>
              ) : (
                approved.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-bold">{request.name}</p>
                    <p className="mt-1 text-xs text-brand-ivory/60">{request.address}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function DispensaryRegistrationRoute({
  onBack,
  onNavigate,
  dispensaryRegistrations,
  onSubmitDispensaryRegistration,
}: {
  onBack: () => void;
  onNavigate: (path: string) => void;
  dispensaryRegistrations: DispensaryRegistration[];
  onSubmitDispensaryRegistration: (input: Omit<DispensaryRegistration, 'id' | 'status' | 'submittedAt'>) => void;
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('/dispensario/operacion')}
              className="rounded-full bg-brand-green-deep px-4 py-2 text-sm font-bold text-brand-ivory active:scale-95"
            >
              Operar
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
          <h1 className="mt-8 text-4xl font-serif leading-tight md:text-6xl">Primero solicita el alta. Despues operas.</h1>
          <p className="mt-6 text-sm leading-relaxed text-brand-ivory/70 md:text-base">
            El dispensario completa su solicitud, Trust Leaf revisa desde admin y, al aprobar, queda listo para validar recetas y registrar entregas.
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
                ['address', 'Direccion operativa'],
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
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={() => onNavigate('/dispensario/operacion')}
              className="group flex items-center justify-between rounded-2xl border border-brand-green-deep/10 bg-white p-5 text-left shadow-sm hover:border-brand-gold/40"
            >
              <span className="flex items-center gap-3 font-bold"><ShieldCheck size={18} /> Operacion</span>
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
  onSubmitDoctorRegistration,
}: {
  onBack: () => void;
  onNavigate: (path: string) => void;
  doctorRegistrations: DoctorRegistration[];
  onSubmitDoctorRegistration: (input: Omit<DoctorRegistration, 'id' | 'status' | 'submittedAt'>) => void;
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
    if (!registrationForm.name || !registrationForm.licenseId || !registrationForm.specialty || !registrationForm.contact || !registrationForm.wallet) {
      return;
    }

    onSubmitDoctorRegistration(registrationForm);
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
              className="rounded-full bg-brand-green-deep px-4 py-2 text-sm font-bold text-brand-ivory active:scale-95"
            >
              Emitir RX
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
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">Registro medico</p>
          <h1 className="mt-8 text-4xl font-serif leading-tight md:text-6xl">Primero solicita el alta. Despues emites RX.</h1>
          <p className="mt-6 text-sm leading-relaxed text-brand-ivory/70 md:text-base">
            El medico presenta licencia, especialidad y wallet. Admin revisa y habilita el acceso profesional para emitir recetas verificables.
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
                <h2 className="mt-2 text-2xl font-serif">Datos para revision admin</h2>
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
                ['licenseId', 'Licencia / registro medico'],
                ['specialty', 'Especialidad'],
                ['contact', 'Contacto responsable'],
                ['wallet', 'Wallet Stellar del medico'],
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
          </div>

          <button
            onClick={() => onNavigate('/medico/operacion')}
            className="group flex w-full items-center justify-between rounded-2xl border border-brand-green-deep/10 bg-white p-5 text-left shadow-sm hover:border-brand-gold/40"
          >
            <span className="flex items-center gap-3 font-bold"><Stethoscope size={18} /> Ir al panel medico</span>
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
              Cada boton abre solo las herramientas necesarias para este POV. Menos ruido visual, mas operacion real.
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
                  ['address', 'Direccion operativa'],
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
                En el MVP esta solicitud se guarda localmente para validar UX. En produccion se enviara al backend y, tras aprobacion, ejecutara `add_dispensary` en Soroban.
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


