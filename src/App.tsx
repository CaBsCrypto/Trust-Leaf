/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Activity, ArrowRight, Database, Leaf, ShieldCheck, ShoppingBag, Stethoscope, UserRound, X, Fingerprint, Key, Check, Clock, Lock, Copy, ExternalLink, FileText } from 'lucide-react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Footer from './components/Footer';
import type { PortalView } from './components/MockupPortal';
import {
  trustDataStore,
  type ActorRegistrationStatus,
  type DispensaryApplication,
  type DoctorApplication,
  type PersistenceSource,
} from './lib/trustData';
import {
  ensureActorAuthSession,
  listenAdminAuth,
  signInAdmin,
  signOutAdmin,
  signInWithGoogle,
  type AdminAuthState,
} from './lib/trustAuth';
import { getFirebaseRuntimeStatus, db } from './lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { shortenAddress, stellarConfig } from './lib/stellar/config';
import { connectFreighterOnTestnet } from './lib/stellar/freighter';
import { connectOrCreatePasskeyWallet, getPasskeyAvailability, connectPasskeyWallet as apiConnectPasskeyWallet } from './lib/stellar/passkeys';
import { passkeyService } from './lib/stellar/passkeyService';
import { validateRut, formatRut } from './lib/stellar/chileHelpers';
import WalletOnboarding, { type WalletSetupState } from './components/WalletOnboarding';

import { LanguageProvider, useLanguage } from './context/LanguageContext';

const MockupPortal = lazy(() => import('./components/MockupPortal'));

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

const PATIENT_VIEWS: PortalView[] = ['overview', 'doctors', 'prescriptions', 'dispensaries', 'history'];
const DOCTOR_VIEWS: PortalView[] = ['doctors'];
const DISPENSARY_VIEWS: PortalView[] = ['dispensaries', 'history', 'pickups'];
const TRUST_SESSION_KEY = 'trust_leaf_session';
const DEFAULT_PATIENT_WALLET = 'GBOVHFJQXZR5LMODPMKM766SHK5D7XOPZUHUYRPHENQKWDQI33DSWRJ6';
const DEFAULT_DOCTOR_WALLET = 'GD2MXRXHYBSSY7CXQWAYN5S7OHAUVEULPHV4SYQA3542GIQLUGJ57VNX';
const DEFAULT_DISPENSARY_WALLET = 'GCJLFG6PX6OA6JBJPQP2PXBJ7SD726O4R46IMWD4GBK3CX7HCWEJZRJ6';

function seedDemoPatientState() {
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

const ROLE_ROUTES = [
  { path: '/paciente', label: 'Paciente' },
  { path: '/medico', label: 'Médico' },
  { path: '/dispensario', label: 'Dispensario' },
  { path: '/admin', label: 'Admin' },
];

const PATIENT_ROUTE_VIEWS: Record<string, PortalView> = {
  '/paciente': 'overview',
  '/paciente/cuenta': 'overview',
  '/paciente/recetas': 'prescriptions',
  '/paciente/dispensarios': 'dispensaries',
  '/paciente/retiros': 'history',
  '/paciente/historial': 'history',
  '/paciente/viajero': 'history',
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

  const [patientProfile, setPatientProfile] = useState<{
    uid: string;
    name: string;
    stellarPublicKey: string;
  } | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [walletSetup, setWalletSetup] = useState<WalletSetupState>({
    primaryMethod: null,
    hasFreighterBackup: false,
    walletLabel: 'Trust Leaf Smart Wallet',
    contractAccount: 'CAX7...LEAF',
    networkLabel: stellarConfig.networkLabel,
  });
  const [walletBusy, setWalletBusy] = useState<'passkey' | 'freighter' | 'backup' | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletHint, setWalletHint] = useState<string | null>(
    'Tu cuenta queda lista para controlar recetas, permisos y trazabilidad.',
  );
  const [passkeyAvailability, setPasskeyAvailability] = useState({ available: false, reason: '' });

  useEffect(() => {
    const res = getPasskeyAvailability();
    setPasskeyAvailability({
      available: res.available,
      reason: res.reason ?? '',
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (session && session.mode === 'email' && adminAuth.user) {
      setCheckingProfile(true);
      const userRef = doc(db, 'users', adminAuth.user.uid);
      getDoc(userRef)
        .then(async (snapshot) => {
          if (cancelled) return;
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.stellarPublicKey) {
              const profile = {
                uid: adminAuth.user!.uid,
                name: data.name || adminAuth.user!.displayName || 'Usuario de Google',
                stellarPublicKey: data.stellarPublicKey,
              };
              setPatientProfile(profile);
              const primaryMethod = data.primaryMethod || 'demo';
              const walletLabel = data.walletLabel || (primaryMethod === 'passkey' ? 'Smart Passkey' : primaryMethod === 'freighter' ? 'Freighter Wallet' : 'Usuario Google Piloto');
              const hasFreighterBackup = !!data.hasFreighterBackup;

              setWalletSetup({
                primaryMethod,
                hasFreighterBackup,
                walletLabel,
                contractAccount: data.stellarPublicKey,
                networkLabel: 'Stellar Testnet',
              });
              localStorage.setItem(
                'trust_wallet_setup',
                JSON.stringify({
                  primaryMethod,
                  hasFreighterBackup,
                  walletLabel,
                  contractAccount: data.stellarPublicKey,
                  freighterAddress: data.stellarPublicKey,
                  networkLabel: 'Stellar Testnet',
                }),
              );
            } else {
              setPatientProfile(null);
            }
          } else {
            // Document does not exist yet. If Doctor or Dispensary is approved, auto-create its mapping in 'users'!
            const approvedDocs = doctorRegistrations.filter((r) => r.status === 'approved');
            const approvedDisps = dispensaryRegistrations.filter((r) => r.status === 'approved');
            const currentReg = session.role === 'doctor'
              ? approvedDocs.find((r) => r.contact === session.email || r.name === session.name)
              : session.role === 'dispensary'
                ? approvedDisps.find((r) => r.contact === session.email || r.name === session.name)
                : null;

            if (currentReg && currentReg.wallet) {
              try {
                const profileData = {
                  uid: adminAuth.user!.uid,
                  name: currentReg.name || adminAuth.user!.displayName || 'Usuario de Google',
                  stellarPublicKey: currentReg.wallet,
                  primaryMethod: 'demo',
                  walletLabel: session.role === 'doctor' ? 'Credencial Profesional Médica' : 'Credencial Operativa Dispensario',
                  createdAt: new Date().toISOString(),
                };
                await setDoc(userRef, profileData);
                const profile = {
                  uid: adminAuth.user!.uid,
                  name: profileData.name,
                  stellarPublicKey: profileData.stellarPublicKey,
                };
                setPatientProfile(profile);
                setWalletSetup({
                  primaryMethod: 'demo',
                  hasFreighterBackup: false,
                  walletLabel: profileData.walletLabel,
                  contractAccount: profileData.stellarPublicKey,
                  networkLabel: 'Stellar Testnet',
                });
                localStorage.setItem(
                  'trust_wallet_setup',
                  JSON.stringify({
                    primaryMethod: 'demo',
                    hasFreighterBackup: false,
                    walletLabel: profileData.walletLabel,
                    contractAccount: profileData.stellarPublicKey,
                    freighterAddress: profileData.stellarPublicKey,
                    networkLabel: 'Stellar Testnet',
                  }),
                );
              } catch (err) {
                console.error('Error auto-creating user mapping doc:', err);
              }
            } else {
              setPatientProfile(null);
            }
          }
        })
        .catch((err) => {
          console.error('Error loading patient profile:', err);
        })
        .finally(() => {
          if (!cancelled) setCheckingProfile(false);
        });
    } else {
      setPatientProfile(null);
      setCheckingProfile(false);
    }
    return () => {
      cancelled = true;
    };
  }, [session, adminAuth.user, doctorRegistrations, dispensaryRegistrations]);

  const connectPasskeyWallet = async (attachment?: 'platform' | 'cross-platform') => {
    setWalletBusy('passkey');
    setWalletError(null);
    try {
      const userLabel = adminAuth.user?.displayName || adminAuth.user?.email || 'Paciente Piloto';
      const res = await connectOrCreatePasskeyWallet(userLabel, { authenticatorAttachment: attachment });
      setWalletSetup({
        primaryMethod: 'passkey',
        hasFreighterBackup: false,
        walletLabel: 'Passkey Smart Wallet',
        contractAccount: res.contractId,
        networkLabel: 'Stellar Testnet',
      });
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Error al conectar Passkey.');
    } finally {
      setWalletBusy(null);
    }
  };

  const connectFreighterWallet = async () => {
    setWalletBusy('freighter');
    setWalletError(null);
    try {
      const address = await connectFreighterOnTestnet();
      setWalletSetup({
        primaryMethod: 'freighter',
        hasFreighterBackup: false,
        walletLabel: 'Freighter Wallet',
        contractAccount: address,
        networkLabel: 'Stellar Testnet',
      });
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Error al conectar Freighter.');
    } finally {
      setWalletBusy(null);
    }
  };

  const connectDemoPatientWallet = async () => {
    setWalletSetup({
      primaryMethod: 'demo',
      hasFreighterBackup: false,
      walletLabel: 'Paciente Demo Testnet',
      contractAccount: DEFAULT_PATIENT_WALLET,
      networkLabel: 'Stellar Testnet',
    });
  };

  const handlePasskeySignIn = (role: ActorRole) => async () => {
    const roleLabel = role === 'doctor' ? 'Médico' : role === 'dispensary' ? 'Dispensario' : 'Paciente';
    const userLabel = `${roleLabel} Passkey`;
    const res = await connectOrCreatePasskeyWallet(userLabel);
    if (!res || !res.contractId) {
      throw new Error('Fallo al conectar con Passkey.');
    }
    
    startSession(role, {
      email: `passkey@trustleaf.${role}`,
      name: res.userLabel || `${roleLabel} Passkey`,
      mode: 'email',
    });
    
    if (role === 'patient') {
      setPatientProfile({
        uid: `passkey-${res.contractId}`,
        name: res.userLabel || 'Paciente Passkey',
        stellarPublicKey: res.contractId,
      });
    }

    setWalletSetup({
      primaryMethod: 'passkey',
      hasFreighterBackup: false,
      walletLabel: res.userLabel || 'Passkey Smart Wallet',
      contractAccount: res.contractId,
      networkLabel: 'Stellar Testnet',
    });
    
    localStorage.setItem(
      'trust_wallet_setup',
      JSON.stringify({
        primaryMethod: 'passkey',
        hasFreighterBackup: false,
        walletLabel: res.userLabel || 'Passkey Smart Wallet',
        contractAccount: res.contractId,
        freighterAddress: res.contractId,
        networkLabel: 'Stellar Testnet',
      }),
    );
  };

  const linkFreighterBackup = async () => {
    if (walletSetup.primaryMethod !== 'passkey') return;
    setWalletBusy('backup');
    setWalletError(null);
    try {
      setWalletSetup((curr) => ({
        ...curr,
        hasFreighterBackup: true,
      }));
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Error al vincular Freighter.');
    } finally {
      setWalletBusy(null);
    }
  };

  const resetWalletSetup = async () => {
    setWalletBusy('passkey');
    setWalletError(null);
    try {
      // 1. Limpiar base de datos híbrida local y credenciales
      passkeyService.clearAll();
      
      // 2. Limpiar todo el estado de local storage relacionado con demos y pilotos
      localStorage.removeItem('trust_wallet_setup');
      localStorage.removeItem('trust_doctor_patient_address');
      localStorage.removeItem('trust_has_rx');
      localStorage.removeItem('trust_latest_prescription_id');
      localStorage.removeItem('trust_dispense_prescription_id');
      localStorage.removeItem('activePickups');
      localStorage.removeItem('gp_passkey_accounts');

      // 3. Reiniciar estado local
      setWalletSetup({
        primaryMethod: null,
        hasFreighterBackup: false,
        walletLabel: 'Trust Leaf Smart Wallet',
        contractAccount: 'CAX7...LEAF',
        networkLabel: stellarConfig.networkLabel,
      });
      setPatientProfile(null);
      
      // 4. Limpiar Firestore
      if (adminAuth.user) {
        const userRef = doc(db, 'users', adminAuth.user.uid);
        await deleteDoc(userRef);
      }
      setWalletHint('Billetera desvinculada. Configura una nueva identidad.');
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Error al desvincular billetera.');
    } finally {
      setWalletBusy(null);
    }
  };

  const startSession = (role: ActorRole, input: { email: string; name: string; mode?: TrustSession['mode'] }) => {
    const nextSession: TrustSession = {
      role,
      email: input.email,
      name: input.name,
      mode: input.mode ?? 'email',
      createdAt: new Date().toISOString(),
    };
    if (role === 'patient' && nextSession.mode === 'demo') {
      seedDemoPatientState();
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

  useEffect(() => {
    if (session?.role === 'patient' && session.mode === 'demo') {
      seedDemoPatientState();
    }
  }, [session?.mode, session?.role]);

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

    // Refrescar automáticamente cada 5 segundos para que la interfaz se actualice al ser aprobada por el admin
    const interval = setInterval(() => {
      void refreshActorRegistrations();
    }, 5000);

    return () => clearInterval(interval);
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

  const revokeDoctorOnchain = async (request: DoctorRegistration) => {
    if (request.onchainStatus === 'registered') {
      const response = await fetch('/api/stellar/admin/revoke-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorAddress: request.wallet }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'No fue posible revocar el médico en Testnet.');
      }
      await trustDataStore.updateDoctorOnchainStatus(
        request.id,
        'pending',
        undefined,
        `Revocado on-chain. Tx: ${payload.txHash}`
      );
    }
    const source = await trustDataStore.reviewDoctorApplication(request.id, 'rejected', 'Aprobación revocada por el administrador.');
    setRegistrationSource(source);
    await refreshActorRegistrations();
  };

  const revokeDispensaryOnchain = async (request: DispensaryRegistration) => {
    if (request.onchainStatus === 'registered') {
      const response = await fetch('/api/stellar/admin/revoke-dispensary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispensaryAddress: request.wallet }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'No fue posible revocar el dispensario en Testnet.');
      }
      await trustDataStore.updateDispensaryOnchainStatus(
        request.id,
        'pending',
        undefined,
        `Revocado on-chain. Tx: ${payload.txHash}`
      );
    }
    const source = await trustDataStore.reviewDispensaryApplication(request.id, 'rejected', 'Aprobación revocada por el administrador.');
    setRegistrationSource(source);
    await refreshActorRegistrations();
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
          demoAction="Entrar con paciente de prueba"
          defaultEmail="paciente@trustleaf.test"
          defaultName="Paciente de prueba"
          onBack={() => navigate('/')}
          onStart={startSession}
          onPasskeySignIn={handlePasskeySignIn('patient')}
        />
      );
    }

    if (session?.mode === 'email' && adminAuth.user && !patientProfile && !checkingProfile) {
      const handleContinueOnboarding = async () => {
        if (!walletSetup.contractAccount || walletSetup.primaryMethod === null) return;
        try {
          const userRef = doc(db, 'users', adminAuth.user!.uid);
          const profileData = {
            uid: adminAuth.user!.uid,
            name: adminAuth.user!.displayName || 'Usuario de Google',
            stellarPublicKey: walletSetup.contractAccount,
            primaryMethod: walletSetup.primaryMethod,
            hasFreighterBackup: walletSetup.hasFreighterBackup,
            walletLabel: walletSetup.walletLabel,
            createdAt: new Date().toISOString(),
          };
          await setDoc(userRef, profileData);
          setPatientProfile(profileData);
          localStorage.setItem(
            'trust_wallet_setup',
            JSON.stringify({
              primaryMethod: walletSetup.primaryMethod,
              hasFreighterBackup: walletSetup.hasFreighterBackup,
              walletLabel: walletSetup.walletLabel,
              contractAccount: walletSetup.contractAccount,
              freighterAddress: walletSetup.contractAccount,
              networkLabel: 'Stellar Testnet',
            }),
          );
        } catch (err) {
          console.error("Error writing user profile:", err);
        }
      };

      return (
        <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep p-6 flex flex-col justify-center items-center">
          <div className="w-full max-w-4xl space-y-6">
            <header className="flex justify-between items-center bg-white/75 backdrop-blur-xl px-6 py-4 rounded-2xl border border-brand-green-deep/10 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
                  <Leaf size={20} />
                </span>
                <span className="text-lg font-bold">Trust Leaf Piloto</span>
              </div>
              <button onClick={endSession} className="text-sm font-bold text-brand-green-deep/60 hover:text-brand-green-deep cursor-pointer">
                Cerrar sesión
              </button>
            </header>

            <WalletOnboarding
              title="Configura tu acceso médico"
              eyebrow="Onboarding mandatorio de piloto"
              description="Conecta una billetera Stellar para crear tu expediente clínico privado. Las transacciones de la red testnet están 100% patrocinadas por Trust Leaf."
              primaryMethod={walletSetup.primaryMethod}
              hasFreighterBackup={walletSetup.hasFreighterBackup}
              walletLabel={walletSetup.walletLabel}
              contractAccount={shortenAddress(walletSetup.contractAccount, 6)}
              passkeyTitle="Smart Passkey"
              passkeyDescription="Usa tu huella o PIN facial para crear un acceso biométrico ultra seguro y sin contraseñas."
              passkeyAction="Crear con Passkey"
              freighterTitle="Billetera Freighter"
              freighterDescription="Si eres un usuario avanzado de Stellar, conecta tu billetera Freighter directamente en Testnet."
              freighterAction="Conectar Freighter"
              demoTitle="Acceso de Prueba"
              demoDescription="Identidad custodial demo preconfigurada para fines de revisión y grabación piloto."
              demoAction="Usar Demo"
              linkedLabel="Vinculado"
              backupTitle="Clave de Respaldo"
              backupDescription="Añade Freighter como respaldo a tus credenciales Passkeys para mayor redundancia de acceso."
              backupAction="Vincular Respaldo"
              statusTitle="Estado de Billetera"
              statusPrimary="Método Primario"
              statusBackup="Respaldo"
              statusAccount="Dirección Stellar"
              statusNetwork="Red"
              networkValue={walletSetup.networkLabel}
              primaryPasskeyValue="Passkey Biométrica Activa"
              primaryFreighterValue="Freighter Conectado"
              primaryDemoValue="Acceso Demo Testnet"
              primaryEmptyValue="Sin Vincular"
              backupConnectedValue="Freighter Vinculado"
              backupEmptyValue="Sin Respaldo"
              continueAction="Confirmar y Continuar al Portal"
              statusHint={passkeyAvailability.available ? walletHint : passkeyAvailability.reason}
              statusError={walletError}
              passkeyBusy={walletBusy === 'passkey'}
              freighterBusy={walletBusy === 'freighter'}
              backupBusy={walletBusy === 'backup'}
              onConnectPasskey={connectPasskeyWallet}
              onConnectFreighter={connectFreighterWallet}
              onConnectDemo={connectDemoPatientWallet}
              onLinkFreighterBackup={linkFreighterBackup}
              onContinue={handleContinueOnboarding}
              onResetWallet={resetWalletSetup}
            />
          </div>
        </div>
      );
    }

    return (
      <LazyPortal
        isOpen
        onClose={() => navigate('/')}
        initialView={patientView}
        allowedViews={PATIENT_VIEWS}
        pageMode
        roleLabel="Portal Paciente"
        onSignOut={endSession}
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
          demoAction="Entrar como medico de prueba"
          defaultEmail="medico@trustleaf.test"
          defaultName="Dra. Sofia Lagos"
          onBack={() => navigate('/')}
          onStart={startSession}
          onPasskeySignIn={handlePasskeySignIn('doctor')}
        />
      );
    }

    return (
      <DoctorRegistrationRoute
        onBack={() => navigate('/')}
        onNavigate={navigate}
        session={session}
        doctorRegistrations={doctorRegistrations}
        registrationSource={registrationSource}
        canOperate={doctorCanOperate}
        onSubmitDoctorRegistration={submitDoctorRegistration}
        onSignOut={endSession}
      />
    );
  }

  if (path === '/medico/operacion') {
    if (!hasRoleSession('doctor')) {
      return (
        <AuthGate
          role="doctor"
          title="Acceso medico aprobado"
          description="El panel profesional queda disponible cuando admin aprueba la cuenta y registra la credencial medica. Para grabacion controlada puedes entrar con un medico ya aprobado."
          primaryAction="Entrar al panel"
          demoAction="Entrar como medico aprobado"
          defaultEmail="medico@trustleaf.test"
          defaultName="Dra. Sofia Lagos"
          onBack={() => navigate('/medico')}
          onStart={startSession}
          onPasskeySignIn={handlePasskeySignIn('doctor')}
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
          secondaryAction="Ir a admin"
          onPrimary={() => navigate('/medico')}
          onSecondary={() => navigate('/admin')}
          onBack={() => navigate('/')}
        />
      );
    }

    return (
      <LazyPortal
        isOpen
        onClose={() => navigate('/medico')}
        initialView="doctors"
        allowedViews={DOCTOR_VIEWS}
        pageMode
        roleLabel="Portal Médico"
        onSignOut={endSession}
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
          demoAction="Entrar como dispensario de prueba"
          defaultEmail="dispensario@trustleaf.test"
          defaultName="Green Leaf Center"
          onBack={() => navigate('/')}
          onStart={startSession}
          onPasskeySignIn={handlePasskeySignIn('dispensary')}
        />
      );
    }

    return (
      <DispensaryRegistrationRoute
        onBack={() => navigate('/')}
        onNavigate={navigate}
        session={session}
        dispensaryRegistrations={dispensaryRegistrations}
        registrationSource={registrationSource}
        canOperate={dispensaryCanOperate}
        onSubmitDispensaryRegistration={submitDispensaryRegistration}
        onSignOut={endSession}
      />
    );
  }

  if (path === '/dispensario/operacion' || path === '/dispensario/historial' || path === '/dispensario/retiros') {
    if (!hasRoleSession('dispensary')) {
      return (
        <AuthGate
          role="dispensary"
          title="Acceso operativo"
          description="El panel de inventario y entregas queda disponible para dispensarios aprobados. Para grabacion controlada puedes entrar con un operador ya validado."
          primaryAction="Entrar al panel"
          demoAction="Entrar como dispensario aprobado"
          defaultEmail="dispensario@trustleaf.test"
          defaultName="Green Leaf Center"
          onBack={() => navigate('/dispensario')}
          onStart={startSession}
          onPasskeySignIn={handlePasskeySignIn('dispensary')}
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
          secondaryAction="Ir a admin"
          onPrimary={() => navigate('/dispensario')}
          onSecondary={() => navigate('/admin')}
          onBack={() => navigate('/')}
        />
      );
    }

    return (
      <LazyPortal
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
        onSignOut={endSession}
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
        onRevokeDoctorOnchain={revokeDoctorOnchain}
        onRevokeDispensaryOnchain={revokeDispensaryOnchain}
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
  const [passkeyHealth, setPasskeyHealth] = useState<any | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const firebaseStatus = getFirebaseRuntimeStatus();

  useEffect(() => {
    let cancelled = false;

    const loadReadiness = async () => {
      try {
        const [stellarResponse, passkeyResponse] = await Promise.all([
          fetch('/api/stellar/readiness'),
          fetch('/api/passkeys/health'),
        ]);
        const payload = await stellarResponse.json();
        const passkeyPayload = await passkeyResponse.json().catch(() => null);
        if (!stellarResponse.ok) {
          throw new Error(payload.message || 'No fue posible leer readiness.');
        }
        if (!cancelled) {
          setReadiness(payload);
          setPasskeyHealth(passkeyResponse.ok ? passkeyPayload : null);
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
    ['Firebase admin', firebaseStatus.configured, `Proyecto ${firebaseStatus.projectId || 'pendiente'} detectado para Auth + Firestore.`],
    ['Solicitudes reales', firebaseStatus.configured, 'Requiere Anonymous Auth activo para que medico/dispensario puedan crear solicitudes en Firestore.'],
    ['Admin signer', Boolean(readiness?.signers?.admin?.configured), 'Puede registrar actores en Testnet.'],
    ['Medico signer', Boolean(readiness?.capabilities?.issuePrescriptions), 'Puede emitir recetas demo Testnet.'],
    ['Dispensario signer', Boolean(readiness?.capabilities?.dispensePrescriptions), 'Puede registrar retiros parciales.'],
    [
      'Passkeys',
      Boolean(readiness?.capabilities?.passkeyRelay && readiness?.capabilities?.passkeyDiscovery && passkeyHealth?.configured),
      passkeyHealth?.configured
        ? 'Relayer passkey disponible para wallet paciente real.'
        : 'Pendiente relayer/Mercury para wallet paciente real.',
    ],
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
            Abrir portal
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-12">
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.82fr]">
          <div className="rounded-[32px] bg-brand-green-deep p-7 text-brand-ivory shadow-2xl md:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">SCRUM status</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-serif leading-tight md:text-6xl">
              MVP listo para evolucionar a piloto real.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-brand-ivory/70 md:text-base">
              Esta vista resume contratos, Firebase, passkeys y rutas por actor. La demo sigue disponible, pero el foco ahora es cerrar readiness de piloto en Testnet.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['Produccion', 'www.trustleaf.org'],
                ['Red', readiness?.network ?? 'Stellar Testnet'],
                ['Sprint', 'Piloto real Testnet'],
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
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                ['Firebase', firebaseStatus.configured ? 'Configurado' : 'Pendiente'],
                ['Anonymous Auth', firebaseStatus.configured ? 'Activar en Firebase Console' : 'Pendiente'],
                ['Admin real', firebaseStatus.configured ? 'Requiere appAdministrators/{uid}' : 'Configurar Firebase'],
                ['Passkey relayer', passkeyHealth?.configured ? 'Configurado' : 'Pendiente'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                  <p className="mt-2 text-sm font-bold text-brand-green-deep">{value}</p>
                </div>
              ))}
            </div>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

function PortalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-neutral px-6">
      <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green-deep text-brand-ivory">
          <Leaf size={22} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-gold">Trust Leaf</p>
        <p className="mt-2 text-lg font-bold text-brand-green-deep">Cargando portal...</p>
      </div>
    </div>
  );
}

function LazyPortal(props: ComponentProps<typeof MockupPortal>) {
  return (
    <Suspense fallback={<PortalLoading />}>
      <MockupPortal {...props} />
    </Suspense>
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
  onPasskeySignIn,
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
  onPasskeySignIn?: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    email: defaultEmail,
    name: defaultName,
  });
  const [busy, setBusy] = useState<TrustSession['mode'] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const submit = async (mode: TrustSession['mode']) => {
    if (!form.email.trim() || !form.name.trim()) return;
    setBusy(mode);
    setError(null);
    try {
      if (mode === 'email') {
        await ensureActorAuthSession();
      } else {
        // En modo demo, intentamos autenticar de forma silenciosa para usar Firestore,
        // pero si falla (ej. sin internet o no configurado), continuamos localmente sin bloquear el login.
        await ensureActorAuthSession().catch((err) => {
          console.warn('Silent anonymous auth failed for demo mode:', err);
        });
      }
      onStart(role, {
        email: form.email.trim(),
        name: form.name.trim(),
        mode,
      });
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'No fue posible abrir sesion segura. Puedes usar el acceso de prueba para continuar.',
      );
    } finally {
      setBusy(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy('email');
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (!user) {
        throw new Error('El inicio de sesión con Google falló.');
      }
      onStart(role, {
        email: user.email ?? '',
        name: user.displayName ?? 'Usuario de Google',
        mode: 'email',
      });
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'No fue posible abrir sesion segura con Google. Puedes usar el acceso de prueba para continuar.',
      );
    } finally {
      setBusy(null);
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

        <section className="rounded-[32px] border border-brand-green-deep/10 bg-white p-6 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Acceso privado</p>
          <h2 className="mt-2 text-2xl font-serif">Sesion de trabajo</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65 mb-6">
            Cada actor entra a su propio panel de control verificado. Las conexiones del piloto real se realizan a través de credenciales autenticadas de Google.
          </p>

          {error && (
            <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {onPasskeySignIn && (
              <button
                type="button"
                onClick={async () => {
                  setBusy('email');
                  setError(null);
                  try {
                    await onPasskeySignIn();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Error al conectar con Passkey.');
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={Boolean(busy)}
                className="flex items-center justify-center gap-3 rounded-2xl bg-brand-gold text-brand-green-deep border border-brand-gold px-5 py-4 text-sm font-bold transition-all disabled:cursor-wait disabled:opacity-60 shadow-md cursor-pointer hover:bg-brand-ivory hover:-translate-y-0.5 duration-300 group"
              >
                <Fingerprint className="h-5 w-5 text-brand-green-deep group-hover:scale-110 transition-transform" />
                {busy === 'email' ? 'Verificando Passkey...' : 'Entrar con Smart Passkey (Biométrico)'}
              </button>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={Boolean(busy)}
              className="flex items-center justify-center gap-3 rounded-2xl bg-white border border-brand-green-deep/10 px-5 py-4 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-neutral disabled:cursor-wait disabled:opacity-60 shadow-sm cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 0, 0)">
                  <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.4C21.68,11.89 21.56,11.43 21.35,11.1z" fill="#4285F4" />
                  <path d="M12,21c2.43,0 4.47,-0.8 5.96,-2.18l-2.58,-2c-0.73,0.49 -1.66,0.78 -2.63,0.78 -2.03,0 -3.75,-1.37 -4.36,-3.22H2.33v2.66C3.81,17.43 7.64,21 12,21z" fill="#34A853" />
                  <path d="M7.64,14.38c-0.16,-0.49 -0.25,-1 -0.25,-1.53s0.09,-1.04 0.25,-1.53V8.66H2.33C1.79,9.73 1.48,10.93 1.48,12s0.31,2.27 0.85,3.34L7.64,14.38z" fill="#FBBC05" />
                  <path d="M12,5.38c1.32,0 2.51,0.45 3.44,1.35l2.58,-2.58C16.46,2.69 14.43,2 12,2 7.64,2 3.81,5.57 2.33,9.34l3.05,2.38C5.99,6.75 7.71,5.38 12,5.38z" fill="#EA4335" />
                </g>
              </svg>
              {busy === 'email' ? 'Autenticando...' : 'Iniciar sesión con Google'}
            </button>
            
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-brand-green-deep/10"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-wider text-brand-green-mid/45">o modo demo</span>
              <div className="flex-grow border-t border-brand-green-deep/10"></div>
            </div>

            <button
              type="button"
              onClick={() => submit('demo')}
              disabled={Boolean(busy)}
              className="rounded-2xl border border-brand-green-deep/10 bg-[#fbf7ef] px-5 py-4 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-gold/10 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
            >
              {busy === 'demo' ? 'Entrando...' : demoAction}
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Seguro que quieres restablecer los accesos de prueba? Esto limpiará la caché local del navegador para que puedas registrar nuevas llaves desde cero con Google Password Manager.")) {
                  localStorage.clear();
                  passkeyService.clearAll();
                  window.location.reload();
                }
              }}
              className="mt-3 text-center text-xs font-bold text-brand-green-mid/45 hover:text-red-600 transition-colors cursor-pointer"
            >
              Limpiar accesos locales y reiniciar llaves
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
        <section className="rounded-[32px] bg-brand-green-deep p-7 text-brand-ivory md:p-9 shadow-xl flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">{roleLabel}</p>
            <h1 className="mt-6 text-4xl font-serif leading-tight md:text-5xl">{title}</h1>
            <p className="mt-5 text-sm leading-relaxed text-brand-ivory/70">{description}</p>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 hidden md:block">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/70">Seguridad criptográfica</p>
            <p className="mt-2 text-xs leading-relaxed text-brand-ivory/55">
              Tu identidad y firmas se validan mediante contratos Soroban inteligentes de forma descentralizada.
            </p>
          </div>
        </section>

        <section className="rounded-[32px] border border-brand-green-deep/10 bg-white p-8 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Control de acceso</p>
            <h2 className="mt-2 text-2xl font-serif">Proceso de validación</h2>
            
            {/* Elegant Premium Stepper */}
            <div className="mt-8 relative border-l-2 border-brand-green-deep/10 pl-6 ml-4 space-y-8">
              {/* Step 1 - Completed */}
              <div className="relative">
                <span className="absolute -left-10 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200">
                  <Check size={16} className="stroke-[3]" />
                </span>
                <div>
                  <h3 className="font-bold text-brand-green-deep text-sm">1. Solicitud enviada</h3>
                  <p className="mt-1 text-xs text-brand-green-mid/70">
                    Tus credenciales y datos de registro fueron registrados correctamente en la plataforma.
                  </p>
                </div>
              </div>

              {/* Step 2 - Active pending */}
              <div className="relative animate-[pulse_2.5s_infinite]">
                <span className="absolute -left-10 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm border border-amber-200">
                  <Clock size={16} className="animate-[spin_12s_linear_infinite]" />
                </span>
                <div>
                  <h3 className="font-bold text-brand-green-deep text-sm">2. Revisión administrativa</h3>
                  <p className="mt-1 text-xs text-brand-green-mid/70">
                    El administrador está verificando tus registros oficiales y la validez de tu licencia médica.
                  </p>
                </div>
              </div>

              {/* Step 3 - Locked pending */}
              <div className="relative opacity-65">
                <span className="absolute -left-10 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-neutral text-brand-green-mid/50 border border-brand-green-deep/10">
                  <Lock size={14} />
                </span>
                <div>
                  <h3 className="font-bold text-brand-green-deep/60 text-sm">3. Alta en Stellar Testnet</h3>
                  <p className="mt-1 text-xs text-brand-green-mid/50">
                    Tu wallet digital será vinculada on-chain para permitir la firma auditable de recetas médicas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <button
              type="button"
              onClick={onPrimary}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-all hover:bg-brand-green-mid hover:shadow-lg active:scale-[0.98] cursor-pointer"
            >
              <ArrowRight size={16} className="rotate-180" />
              {primaryAction}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firebaseStatus = getFirebaseRuntimeStatus();
  const authStatusText =
    authState.mode === 'checking'
      ? 'Verificando sesion'
      : firebaseStatus.configured
        ? 'Firebase Auth configurado'
        : 'Firebase no configurado';
  const allowlistStatusText =
    authState.mode === 'authorized'
      ? 'Allowlist validada'
      : authState.mode === 'not-admin'
        ? 'Cuenta sin allowlist'
        : 'Documento appAdministrators/{uid}';

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
            El panel admin real usa Firebase Auth y allowlist en `appAdministrators`. El acceso de grabacion queda disponible solo para revisar el flujo completo.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-3">
            {[
              ['Auth', authStatusText],
              ['Allowlist', allowlistStatusText],
              ['On-chain', 'Registro manual y auditable en Stellar Testnet'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold/80">{label}</p>
                <p className="mt-1 text-sm font-bold text-brand-ivory">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-brand-green-deep/10 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Sesión Protegida</p>
            <h2 className="mt-2 text-2xl font-serif text-brand-green-deep">Administrador de Red</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/70">
              Este portal requiere autenticación federada con Google. Solo la cuenta autorizada de administrador tiene privilegios de firma y aprobación.
            </p>

            <div className={`mt-5 rounded-2xl border p-4 text-xs leading-relaxed ${
              firebaseStatus.configured
                ? 'border-green-100 bg-green-50/80 text-green-800'
                : 'border-amber-100 bg-amber-50/80 text-amber-800'
            }`}>
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                <span className={`inline-block h-2 w-2 rounded-full ${firebaseStatus.configured ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                {firebaseStatus.configured ? 'Firebase Activo' : 'Firebase en Modo Local'}
              </div>
              <p className="mt-1.5 text-brand-green-deep/80">
                Email con permisos: <strong className="text-brand-green-deep font-semibold">cabscryptocontacto@gmail.com</strong>
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const user = await signInWithGoogle();
                    if (!user) {
                      throw new Error("Inicio de sesión cancelado o fallido.");
                    }
                    if (user.email?.toLowerCase() !== 'cabscryptocontacto@gmail.com') {
                      throw new Error("Acceso denegado: Solo cabscryptocontacto@gmail.com está autorizado.");
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Error al iniciar sesión con Google.");
                    await signOutAdmin();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy || authState.mode === 'checking'}
                className="flex items-center justify-center gap-3 rounded-2xl bg-brand-gold text-brand-green-deep border border-brand-gold px-5 py-4 text-sm font-bold shadow-md hover:bg-brand-ivory hover:-translate-y-0.5 duration-300 disabled:cursor-wait disabled:opacity-60 cursor-pointer group w-full"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 0, 0)">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.4C21.68,11.89 21.56,11.43 21.35,11.1z" fill="#4285F4" />
                    <path d="M12,21c2.43,0 4.47,-0.8 5.96,-2.18l-2.58,-2c-0.73,0.49 -1.66,0.78 -2.63,0.78 -2.03,0 -3.75,-1.37 -4.36,-3.22H2.33v2.66C3.81,17.43 7.64,21 12,21z" fill="#34A853" />
                    <path d="M7.64,14.38c-0.16,-0.49 -0.25,-1 -0.25,-1.53s0.09,-1.04 0.25,-1.53V8.66H2.33C1.79,9.73 1.48,10.93 1.48,12s0.31,2.27 0.85,3.34L7.64,14.38z" fill="#FBBC05" />
                    <path d="M12,5.38c1.32,0 2.51,0.45 3.44,1.35l2.58,-2.58C16.46,2.69 14.43,2 12,2 7.64,2 3.81,5.57 2.33,9.34l3.05,2.38C5.99,6.75 7.71,5.38 12,5.38z" fill="#EA4335" />
                  </g>
                </svg>
                {busy ? 'Verificando...' : 'Iniciar Sesión con Google'}
              </button>

              {(error || authState.error || authState.mode === 'not-admin') && (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs text-red-700 leading-relaxed">
                  <p className="font-bold uppercase tracking-wider">Acceso denegado</p>
                  <p className="mt-1">
                    {error || authState.error || 'Esta cuenta de correo no está autorizada como administrador (cabscryptocontacto@gmail.com).'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-brand-green-deep/5"></div>
              <span className="flex-shrink mx-4 text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/45">Desarrollo y Pruebas</span>
              <div className="flex-grow border-t border-brand-green-deep/5"></div>
            </div>

            <button
              type="button"
              onClick={onDemo}
              className="w-full rounded-2xl border border-dashed border-brand-green-deep/15 bg-[#fbf7ef]/50 px-5 py-3.5 text-xs font-bold text-brand-green-mid transition-all hover:bg-brand-gold/10 hover:border-brand-gold/30 hover:text-brand-green-deep active:scale-[0.99] cursor-pointer"
            >
              Entrar en Modo Grabación (Demo Local)
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
  onRevokeDoctorOnchain,
  onRevokeDispensaryOnchain,
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
  onRevokeDoctorOnchain: (request: DoctorRegistration) => Promise<unknown>;
  onRevokeDispensaryOnchain: (request: DispensaryRegistration) => Promise<unknown>;
}) {
  const pending = registrations.filter((request) => request.status === 'pending');
  const approved = registrations.filter((request) => request.status === 'approved');
  const pendingDoctors = doctorRegistrations.filter((request) => request.status === 'pending');
  const approvedDoctors = doctorRegistrations.filter((request) => request.status === 'approved');

  const activeDoctors = doctorRegistrations.filter(
    (req) => req.status === 'pending'
  );
  const activeDispensaries = registrations.filter(
    (req) => req.status === 'pending'
  );

  const resolvedDoctors = doctorRegistrations.filter(
    (req) => req.status === 'approved' || req.status === 'rejected' || req.status === 'needs_review'
  );
  const resolvedDispensaries = registrations.filter(
    (req) => req.status === 'approved' || req.status === 'rejected' || req.status === 'needs_review'
  );

  const [registryModal, setRegistryModal] = useState<'doctors' | 'dispensaries' | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedDispensaryId, setSelectedDispensaryId] = useState<string | null>(null);

  const selectedDoctor = approvedDoctors.find((d) => d.id === selectedDoctorId) ?? null;
  const selectedDispensary = approved.find((d) => d.id === selectedDispensaryId) ?? null;

  const getInitials = (name: string) => {
    if (!name) return '??';
    const clean = name.replace(/^(dr\.|dra\.|mr\.|mrs\.)\s+/i, '');
    return clean
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const [manualDoctor, setManualDoctor] = useState({
    name: 'Dra. Sofia Lagos',
    licenseId: 'MED-CL-20441',
    specialty: 'Medicina cannábica',
    contact: 'sofia@trustleaf.org',
    wallet: DEFAULT_DOCTOR_WALLET,
  });
  const [manualDispensary, setManualDispensary] = useState({
    name: 'Green Leaf Center',
    legalId: 'DSP-CL-8821',
    address: 'Av. Principal 123',
    contact: 'operaciones@greenleaf.test',
    wallet: DEFAULT_DISPENSARY_WALLET,
  });
  const [onchainAction, setOnchainAction] = useState<string | null>(null);
  const [onchainNotice, setOnchainNotice] = useState<string | null>(null);
  const approvedDoctorsPendingOnchain = approvedDoctors.filter((request) => request.onchainStatus !== 'registered');
  const approvedDispensariesPendingOnchain = approved.filter((request) => request.onchainStatus !== 'registered');
  const networkReady =
    approvedDoctors.length > 0
    && approved.length > 0
    && approvedDoctorsPendingOnchain.length === 0
    && approvedDispensariesPendingOnchain.length === 0;
  const adminSteps = [
    ['Solicitudes recibidas', doctorRegistrations.length + registrations.length > 0, 'Medicos y dispensarios pueden postular o admin puede cargarlos manualmente.'],
    ['Actores aprobados', approvedDoctors.length > 0 && approved.length > 0, 'Debe existir al menos un medico y un dispensario live.'],
    ['Registro Testnet', networkReady, 'Actores aprobados registrados en DoctorRegistry y DispensaryRegistry.'],
    ['Demo grabable', networkReady, 'Medico emite, paciente ve QR y dispensario registra retiro parcial.'],
  ] as const;
  const statusLabel = {
    pending: 'Pendiente',
    needs_review: 'Revisar',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  } satisfies Record<ActorRegistrationStatus, string>;
  const onchainLabel = {
    pending: 'Pendiente Testnet',
    registered: 'Registrado Testnet',
    failed: 'Fallo Testnet',
  } satisfies Record<DoctorRegistration['onchainStatus'], string>;
  const onchainClass = {
    pending: 'bg-amber-100 text-amber-700',
    registered: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  } satisfies Record<DoctorRegistration['onchainStatus'], string>;

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
              Persistencia: {registrationSource === 'supabase' ? 'Supabase' : registrationSource === 'firebase' ? 'Firebase' : 'Local / grabacion'}
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
              <h2 className="mt-2 text-3xl font-serif">Preparar red Testnet</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brand-green-mid/70">
                Admin puede aprobar solicitudes reales o crear actores verificados manualmente. Para grabar, deja al menos un medico y un dispensario live antes de mostrar el flujo paciente.
              </p>
            </div>
            <button
              type="button"
              onClick={prepareAdminDemo}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-all hover:bg-brand-green-mid active:scale-95"
            >
              Preparar flujo de grabacion
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
          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
            {adminSteps.map(([label, done, detail]) => (
              <div
                key={label}
                className={`rounded-2xl border p-4 ${
                  done
                    ? 'border-green-100 bg-green-50 text-green-800'
                    : 'border-amber-100 bg-white text-brand-green-mid'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${
                    done ? 'bg-white text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {done ? 'Listo' : 'Pendiente'}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed opacity-75">{detail}</p>
              </div>
            ))}
          </div>
          {(approvedDoctorsPendingOnchain.length > 0 || approvedDispensariesPendingOnchain.length > 0) && (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
              Hay actores aprobados pendientes de registro Testnet: {approvedDoctorsPendingOnchain.length} medicos y {approvedDispensariesPendingOnchain.length} dispensarios.
              La aprobacion habilita el panel operativo; el boton "Registrar Testnet" deja la credencial anclada on-chain.
            </div>
          )}
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
                  Revisa licencias, aprueba médicos y habilita el panel profesional para emitir recetas.
                  En el siguiente paso esta aprobación se conectará con DoctorRegistry.
                </p>
              </div>
              <span className="rounded-full bg-brand-neutral px-3 py-1 text-xs font-bold text-brand-green-mid">
                {pendingDoctors.length} pendientes
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {activeDoctors.length === 0 && (
                <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/40 p-6 text-sm text-brand-green-mid/70">
                  <p>Aún no hay solicitudes activas de médicos. Los médicos pueden entrar a `/medico`, pero admin también puede cargar uno manualmente.</p>
                  <button
                    onClick={() => setRegistryModal('doctors')}
                    className="mt-4 rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory"
                  >
                    Agregar médico manual
                  </button>
                </div>
              )}

              {activeDoctors.map((request) => (
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
                          {statusLabel[request.status]}
                        </span>
                      </div>
                      <p className="text-xs text-brand-green-mid/70">{request.specialty}</p>
                      <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-brand-green-deep/80 select-all">
                        <span className="bg-brand-neutral/50 px-2 py-0.5 rounded border border-brand-green-deep/5 flex items-center gap-1.5 hover:bg-brand-neutral transition-all font-mono">
                          {request.wallet.slice(0, 8)}...{request.wallet.slice(-8)}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(request.wallet);
                              setCopiedId(request.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-0.5 rounded hover:bg-brand-neutral text-brand-green-mid/60 hover:text-brand-green-deep transition-colors cursor-pointer"
                            title="Copiar wallet"
                          >
                            {copiedId === request.id ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                          </button>
                        </span>
                      </div>
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
                      </div>
                    )}
                    {request.status === 'approved' && (
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${onchainClass[request.onchainStatus]}`}>
                          {onchainLabel[request.onchainStatus]}
                        </span>
                        {request.reviewerNote && (
                          <p className="max-w-[240px] rounded-xl border border-brand-green-deep/10 bg-white px-3 py-2 text-xs leading-relaxed text-brand-green-mid/70">
                            {request.reviewerNote}
                          </p>
                        )}
                        {request.metadataHash && (
                          <p className="max-w-[240px] break-all font-mono text-[10px] text-brand-green-mid/50">
                            {request.metadataHash}
                          </p>
                        )}
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
                  Revisa la solicitud, aprueba el ingreso y el dispensario queda visible como autorizado en la red.
                  El siguiente paso sera ejecutar `add_dispensary` on-chain con la cuenta admin.
                </p>
              </div>
              <span className="rounded-full bg-brand-neutral px-3 py-1 text-xs font-bold text-brand-green-mid">
                {pending.length} pendientes
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {activeDispensaries.length === 0 && (
                <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/40 p-6 text-sm text-brand-green-mid/70">
                  <p>Aún no hay solicitudes activas de dispensarios. Los dispensarios pueden entrar a `/dispensario`, pero admin también puede cargar uno manualmente.</p>
                  <button
                    onClick={() => setRegistryModal('dispensaries')}
                    className="mt-4 rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory"
                  >
                    Agregar dispensario manual
                  </button>
                </div>
              )}

              {activeDispensaries.map((request) => (
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
                          {statusLabel[request.status]}
                        </span>
                      </div>
                      <p className="text-xs text-brand-green-mid/70">{request.address}</p>
                      <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-brand-green-deep/80 select-all">
                        <span className="bg-brand-neutral/50 px-2 py-0.5 rounded border border-brand-green-deep/5 flex items-center gap-1.5 hover:bg-brand-neutral transition-all font-mono">
                          {request.wallet.slice(0, 8)}...{request.wallet.slice(-8)}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(request.wallet);
                              setCopiedId(request.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-0.5 rounded hover:bg-brand-neutral text-brand-green-mid/60 hover:text-brand-green-deep transition-colors cursor-pointer"
                            title="Copiar wallet"
                          >
                            {copiedId === request.id ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                          </button>
                        </span>
                      </div>
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
                      </div>
                    )}
                    {request.status === 'approved' && (
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${onchainClass[request.onchainStatus]}`}>
                          {onchainLabel[request.onchainStatus]}
                        </span>
                        {request.reviewerNote && (
                          <p className="max-w-[240px] rounded-xl border border-brand-green-deep/10 bg-white px-3 py-2 text-xs leading-relaxed text-brand-green-mid/70">
                            {request.reviewerNote}
                          </p>
                        )}
                        {request.metadataHash && (
                          <p className="max-w-[240px] break-all font-mono text-[10px] text-brand-green-mid/50">
                            {request.metadataHash}
                          </p>
                        )}
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

        <section className="rounded-3xl border border-brand-green-deep/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">Auditoría</p>
              <h2 className="text-2xl font-serif mb-2">Historial de Solicitudes</h2>
              <p className="max-w-3xl text-sm leading-relaxed text-brand-green-mid/70">
                Registro histórico de solicitudes procesadas (Aprobadas on-chain, Rechazadas o devueltas para revisión).
              </p>
            </div>
            <span className="rounded-full bg-brand-neutral px-3 py-1 text-xs font-bold text-brand-green-mid">
              {resolvedDoctors.length + resolvedDispensaries.length} registros
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-brand-green-deep/10 bg-white shadow-md">
            {resolvedDoctors.length === 0 && resolvedDispensaries.length === 0 ? (
              <div className="border-t border-brand-green-deep/10 bg-brand-neutral/20 p-8 text-sm text-brand-green-mid/70 text-center">
                Aún no hay registros en el historial.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-brand-green-deep/10 bg-brand-neutral/30 text-brand-green-deep/60 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                      <th className="py-3.5 px-5 text-left font-semibold">Actor</th>
                      <th className="py-3.5 px-5 text-left font-semibold">Nombre / Contacto</th>
                      <th className="py-3.5 px-5 text-left font-semibold">Wallet</th>
                      <th className="py-3.5 px-5 text-left font-semibold">Licencia / Registro Legal</th>
                      <th className="py-3.5 px-5 text-left font-semibold">Estado Admin</th>
                      <th className="py-3.5 px-5 text-left font-semibold">Estado Stellar</th>
                      <th className="py-3.5 px-5 text-center font-semibold">Acciones</th>
                      <th className="py-3.5 px-5 text-left font-semibold">Detalle / Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-neutral/50">
                    {[
                      ...resolvedDoctors.map(req => ({ ...req, type: 'Médico' })),
                      ...resolvedDispensaries.map(req => ({ ...req, type: 'Dispensario' }))
                    ]
                      .sort((a, b) => new Date(b.reviewedAt || b.submittedAt).getTime() - new Date(a.reviewedAt || a.submittedAt).getTime())
                      .map((item) => (
                        <tr key={item.id} className="text-brand-green-deep hover:bg-brand-neutral/20 transition-colors border-b border-brand-neutral/30 last:border-b-0">
                          <td className="py-4 px-5 align-middle">
                            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap ${
                              item.type === 'Médico'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : 'bg-purple-50 text-purple-700 border border-purple-100'
                            }`}>
                              {item.type === 'Médico' ? <Stethoscope size={11} /> : <ShoppingBag size={11} />}
                              {item.type}
                            </span>
                          </td>
                          <td className="py-4 px-5 align-middle">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold bg-brand-green-deep/5 text-brand-green-deep border border-brand-green-deep/10 mr-3 shrink-0 select-none">
                                {getInitials(item.name)}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-brand-green-deep leading-tight">{item.name}</div>
                                <div className="text-xs text-brand-green-mid/60 mt-0.5 font-medium leading-none">{item.contact}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5 align-middle font-mono text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="bg-brand-neutral/50 px-2 py-1 rounded-lg text-brand-green-deep/80 select-all border border-brand-green-deep/5 flex items-center gap-1.5 hover:bg-brand-neutral transition-all font-mono text-[11px]" title={item.wallet}>
                                {item.wallet.slice(0, 8)}...{item.wallet.slice(-8)}
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.wallet);
                                    setCopiedId(item.id);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}
                                  className="p-0.5 rounded hover:bg-brand-neutral text-brand-green-mid/60 hover:text-brand-green-deep transition-colors cursor-pointer animate-none"
                                  title="Copiar dirección completa"
                                >
                                  {copiedId === item.id ? <Check size={12} className="text-emerald-600 animate-none" /> : <Copy size={12} />}
                                </button>
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-5 align-middle">
                            {'licenseId' in item ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green-deep bg-brand-neutral/35 px-1.5 py-0.5 rounded border border-brand-green-deep/5 w-fit">
                                  <FileText size={10} className="text-brand-gold" />
                                  Licencia: <strong className="text-brand-green-deep">{item.licenseId}</strong>
                                </span>
                                <span className="text-[11px] text-brand-green-mid/70 pl-0.5 font-medium">{item.specialty}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green-deep bg-brand-neutral/35 px-1.5 py-0.5 rounded border border-brand-green-deep/5 w-fit">
                                  <FileText size={10} className="text-brand-gold" />
                                  Registro: <strong className="text-brand-green-deep">{item.legalId}</strong>
                                </span>
                                <span className="text-[11px] text-brand-green-mid/70 pl-0.5 max-w-[160px] truncate block font-medium" title={item.address}>{item.address}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-5 align-middle whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                              item.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                item.status === 'approved' ? 'bg-emerald-500 animate-pulse' : item.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'
                              }`}></span>
                              {statusLabel[item.status]}
                            </span>
                          </td>
                          <td className="py-4 px-5 align-middle whitespace-nowrap">
                            {item.status === 'approved' ? (
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                item.onchainStatus === 'registered'
                                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                  : item.onchainStatus === 'failed'
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  item.onchainStatus === 'registered' ? 'bg-teal-500' : item.onchainStatus === 'failed' ? 'bg-rose-500' : 'bg-amber-500'
                                }`}></span>
                                {onchainLabel[item.onchainStatus]}
                              </span>
                            ) : (
                              <span className="text-brand-green-mid/40 pl-3 font-medium select-none">-</span>
                            )}
                          </td>
                          <td className="py-4 px-5 align-middle text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              {item.status === 'approved' && (
                                <>
                                  {item.onchainStatus !== 'registered' && (
                                    <button
                                      onClick={() =>
                                        runOnchainAction(
                                          `register-${item.type === 'Médico' ? 'doctor' : 'dispensary'}-${item.id}`,
                                          () => item.type === 'Médico' 
                                            ? onRegisterDoctorOnchain(item as any) 
                                            : onRegisterDispensaryOnchain(item as any),
                                          `${item.type} registrado en Testnet.`,
                                        )
                                      }
                                      disabled={onchainAction === `register-${item.type === 'Médico' ? 'doctor' : 'dispensary'}-${item.id}`}
                                      className="inline-flex items-center justify-center rounded-xl bg-brand-green-deep px-3 py-1.5 text-[11px] font-bold text-brand-ivory hover:bg-brand-green-mid active:scale-95 transition-all shadow-sm cursor-pointer disabled:cursor-wait disabled:opacity-60"
                                    >
                                      {onchainAction === `register-${item.type === 'Médico' ? 'doctor' : 'dispensary'}-${item.id}` ? (
                                        <span className="flex items-center gap-1">
                                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-ivory border-t-transparent"></span>
                                          Registrando...
                                        </span>
                                      ) : 'Registrar Testnet'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      runOnchainAction(
                                        `revoke-${item.type === 'Médico' ? 'doctor' : 'dispensary'}-${item.id}`,
                                        () => item.type === 'Médico'
                                          ? onRevokeDoctorOnchain(item as any)
                                          : onRevokeDispensaryOnchain(item as any),
                                        `${item.type} revocado con éxito.`,
                                      )
                                    }
                                    disabled={onchainAction === `revoke-${item.type === 'Médico' ? 'doctor' : 'dispensary'}-${item.id}`}
                                    className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 active:scale-95 transition-all cursor-pointer disabled:cursor-wait disabled:opacity-60 shadow-sm"
                                  >
                                    {onchainAction === `revoke-${item.type === 'Médico' ? 'doctor' : 'dispensary'}-${item.id}` ? (
                                      <span className="flex items-center gap-1">
                                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-600 border-t-transparent"></span>
                                        Revocando...
                                      </span>
                                    ) : 'Revocar'}
                                  </button>
                                </>
                              )}
                              {(item.status === 'rejected' || item.status === 'needs_review') && (
                                <button
                                  onClick={() =>
                                    item.type === 'Médico'
                                      ? onReviewDoctorRegistration(item.id, 'approved')
                                      : onReviewRegistration(item.id, 'approved')
                                  }
                                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer shadow-sm"
                                >
                                  Aprobar
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-5 align-middle">
                            {item.metadataHash ? (
                              <div className="flex flex-col gap-0.5">
                                <a
                                  href={`https://stellar.expert/explorer/testnet/tx/${item.metadataHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-semibold text-[11px] text-brand-gold hover:text-brand-gold/80 transition-colors w-fit"
                                >
                                  Ver en Explorer
                                  <ExternalLink size={10} className="stroke-[2.5]" />
                                </a>
                                <span className="text-[10px] text-brand-green-mid/45 font-mono truncate max-w-[120px] block" title={item.metadataHash}>
                                  {item.metadataHash.slice(0, 8)}...{item.metadataHash.slice(-8)}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-brand-green-mid/60 max-w-[150px] truncate font-medium" title={item.reviewerNote}>
                                {item.reviewerNote || (item.reviewedAt ? `Procesado el ${new Date(item.reviewedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : '')}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
      {registryModal && (
        <div
          onClick={() => {
            setRegistryModal(null);
            setSelectedDoctorId(null);
            setSelectedDispensaryId(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-green-deep/75 p-4 backdrop-blur-md cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl cursor-default"
          >
            <div className="flex items-start justify-between gap-4 border-b border-brand-green-deep/10 p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">
                  {registryModal === 'doctors' ? 'Medical network' : 'Live network'}
                </p>
                <h2 className="mt-2 text-2xl font-serif">
                  {registryModal === 'doctors' ? 'Médicos autorizados' : 'Dispensarios autorizados'}
                </h2>
                <p className="mt-2 max-w-xl text-sm text-brand-green-mid/65">
                  Selecciona un actor de la lista para ver su información completa, o usa el panel lateral para agregar un nuevo registro manual.
                </p>
              </div>
              <button
                onClick={() => {
                  setRegistryModal(null);
                  setSelectedDoctorId(null);
                  setSelectedDispensaryId(null);
                }}
                className="rounded-full p-2 hover:bg-brand-neutral"
              >
                <X size={20} />
              </button>
            </div>
 
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {registryModal === 'doctors' ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-3">
                    {approvedDoctors.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/40 p-5 text-sm text-brand-green-mid/70">
                        Aún no hay médicos live. Agrega uno manualmente para preparar la grabacion.
                      </div>
                    ) : (
                      approvedDoctors.map((doctor) => (
                        <div
                          key={doctor.id}
                          onClick={() => setSelectedDoctorId(doctor.id)}
                          className={`rounded-2xl border p-4 cursor-pointer transition-all hover:-translate-y-0.5 duration-200 ${
                            selectedDoctorId === doctor.id
                              ? 'border-brand-gold bg-brand-gold/5 shadow-sm'
                              : 'border-brand-green-deep/10 bg-brand-neutral/40 hover:bg-brand-neutral/60'
                          }`}
                        >
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
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-brand-green-deep/80 select-all mt-1">
                              <span className="bg-white/60 px-2 py-0.5 rounded border border-brand-green-deep/5 flex items-center gap-1.5 hover:bg-white transition-all font-mono">
                                {doctor.wallet.slice(0, 8)}...{doctor.wallet.slice(-8)}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(doctor.wallet);
                                    setCopiedId(doctor.id);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}
                                  className="p-0.5 rounded hover:bg-white text-brand-green-mid/60 hover:text-brand-green-deep transition-colors cursor-pointer"
                                  title="Copiar wallet"
                                >
                                  {copiedId === doctor.id ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                                </button>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/70 p-4">
                    {selectedDoctor ? (
                      <div>
                        <div className="flex items-center justify-between border-b border-brand-green-deep/10 pb-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">Detalle del médico</p>
                          <button
                            onClick={() => setSelectedDoctorId(null)}
                            className="text-xs font-bold text-brand-green-deep hover:underline cursor-pointer"
                          >
                            + Alta manual
                          </button>
                        </div>
                        <div className="mt-4 space-y-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Nombre médico</span>
                            <p className="font-bold text-brand-green-deep text-sm">{selectedDoctor.name}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Licencia</span>
                            <p className="font-bold text-brand-green-deep text-sm">{selectedDoctor.licenseId}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Especialidad</span>
                            <p className="font-bold text-brand-green-deep text-sm">{selectedDoctor.specialty}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Contacto</span>
                            <p className="font-bold text-brand-green-deep text-sm">{selectedDoctor.contact}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Wallet Stellar</span>
                            <div className="mt-1 flex items-start gap-2 bg-white/70 p-3 rounded-xl border border-brand-green-deep/5 select-all">
                              <p className="font-mono text-xs text-brand-green-deep break-all flex-grow select-all">
                                {selectedDoctor.wallet}
                              </p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedDoctor.wallet);
                                  setCopiedId(`detail-${selectedDoctor.id}`);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="p-1 rounded bg-white hover:bg-brand-neutral text-brand-green-mid/60 hover:text-brand-green-deep transition-colors cursor-pointer flex-shrink-0"
                                title="Copiar wallet completo"
                              >
                                {copiedId === `detail-${selectedDoctor.id}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-brand-green-deep/5 flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-brand-green-mid/65">Registro Testnet:</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${onchainClass[selectedDoctor.onchainStatus]}`}>
                                {onchainLabel[selectedDoctor.onchainStatus]}
                              </span>
                            </div>
                            {selectedDoctor.onchainStatus !== 'registered' && (
                              <button
                                onClick={() =>
                                  runOnchainAction(
                                    `doctor-${selectedDoctor.id}`,
                                    () => onRegisterDoctorOnchain(selectedDoctor),
                                    'Medico registrado en DoctorRegistry Testnet.',
                                  )
                                }
                                disabled={onchainAction === `doctor-${selectedDoctor.id}`}
                                className="w-full mt-2 rounded-xl bg-brand-green-deep px-4 py-2.5 text-xs font-bold text-brand-ivory hover:bg-brand-green-mid disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                              >
                                {onchainAction === `doctor-${selectedDoctor.id}` ? 'Registrando en Stellar...' : 'Registrar on-chain'}
                              </button>
                            )}
                            {selectedDoctor.onchainStatus === 'registered' && (
                              <button
                                onClick={() =>
                                  runOnchainAction(
                                    `revoke-doctor-${selectedDoctor.id}`,
                                    () => onRevokeDoctorOnchain(selectedDoctor),
                                    'Medico revocado en Testnet.',
                                  )
                                }
                                disabled={onchainAction === `revoke-doctor-${selectedDoctor.id}`}
                                className="w-full mt-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                              >
                                {onchainAction === `revoke-doctor-${selectedDoctor.id}` ? 'Revocando en Stellar...' : 'Revocar de la Red'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
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
                          <button onClick={addManualDoctor} className="w-full rounded-xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory cursor-pointer">
                            Agregar médico autorizado
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-3">
                    {approved.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/40 p-5 text-sm text-brand-green-mid/70">
                        Aún no hay dispensarios live. Agrega uno manualmente para preparar la grabacion.
                      </div>
                    ) : (
                      approved.map((dispensary) => (
                        <div
                          key={dispensary.id}
                          onClick={() => setSelectedDispensaryId(dispensary.id)}
                          className={`rounded-2xl border p-4 cursor-pointer transition-all hover:-translate-y-0.5 duration-200 ${
                            selectedDispensaryId === dispensary.id
                              ? 'border-brand-gold bg-brand-gold/5 shadow-sm'
                              : 'border-brand-green-deep/10 bg-brand-neutral/40 hover:bg-brand-neutral/60'
                          }`}
                        >
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
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-brand-green-deep/80 select-all mt-1">
                              <span className="bg-white/60 px-2 py-0.5 rounded border border-brand-green-deep/5 flex items-center gap-1.5 hover:bg-white transition-all font-mono">
                                {dispensary.wallet.slice(0, 8)}...{dispensary.wallet.slice(-8)}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(dispensary.wallet);
                                    setCopiedId(dispensary.id);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}
                                  className="p-0.5 rounded hover:bg-white text-brand-green-mid/60 hover:text-brand-green-deep transition-colors cursor-pointer"
                                  title="Copiar wallet"
                                >
                                  {copiedId === dispensary.id ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                                </button>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rounded-2xl border border-brand-green-deep/10 bg-brand-ivory/70 p-4">
                    {selectedDispensary ? (
                      <div>
                        <div className="flex items-center justify-between border-b border-brand-green-deep/10 pb-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">Detalle del dispensario</p>
                          <button
                            onClick={() => setSelectedDispensaryId(null)}
                            className="text-xs font-bold text-brand-green-deep hover:underline cursor-pointer"
                          >
                            + Alta manual
                          </button>
                        </div>
                        <div className="mt-4 space-y-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Nombre dispensario</span>
                            <p className="font-bold text-brand-green-deep text-sm">{selectedDispensary.name}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Registro legal</span>
                            <p className="font-bold text-brand-green-deep text-sm">{selectedDispensary.legalId}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Dirección</span>
                            <p className="font-bold text-brand-green-deep text-sm">{selectedDispensary.address}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Contacto</span>
                            <p className="font-bold text-brand-green-deep text-sm">{selectedDispensary.contact}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45 block">Wallet Stellar</span>
                            <div className="mt-1 flex items-start gap-2 bg-white/70 p-3 rounded-xl border border-brand-green-deep/5 select-all">
                              <p className="font-mono text-xs text-brand-green-deep break-all flex-grow select-all">
                                {selectedDispensary.wallet}
                              </p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedDispensary.wallet);
                                  setCopiedId(`detail-${selectedDispensary.id}`);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="p-1 rounded bg-white hover:bg-brand-neutral text-brand-green-mid/60 hover:text-brand-green-deep transition-colors cursor-pointer flex-shrink-0"
                                title="Copiar wallet completo"
                              >
                                {copiedId === `detail-${selectedDispensary.id}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-brand-green-deep/5 flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-brand-green-mid/65">Registro Testnet:</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${onchainClass[selectedDispensary.onchainStatus]}`}>
                                {onchainLabel[selectedDispensary.onchainStatus]}
                              </span>
                            </div>
                            {selectedDispensary.onchainStatus !== 'registered' && (
                              <button
                                onClick={() =>
                                  runOnchainAction(
                                    `dispensary-${selectedDispensary.id}`,
                                    () => onRegisterDispensaryOnchain(selectedDispensary),
                                    'Dispensario registrado en DispensaryRegistry Testnet.',
                                  )
                                }
                                disabled={onchainAction === `dispensary-${selectedDispensary.id}`}
                                className="w-full mt-2 rounded-xl bg-brand-green-deep px-4 py-2.5 text-xs font-bold text-brand-ivory hover:bg-brand-green-mid disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                              >
                                {onchainAction === `dispensary-${selectedDispensary.id}` ? 'Registrando en Stellar...' : 'Registrar on-chain'}
                              </button>
                            )}
                            {selectedDispensary.onchainStatus === 'registered' && (
                              <button
                                onClick={() =>
                                  runOnchainAction(
                                    `revoke-dispensary-${selectedDispensary.id}`,
                                    () => onRevokeDispensaryOnchain(selectedDispensary),
                                    'Dispensario revocado en Testnet.',
                                  )
                                }
                                disabled={onchainAction === `revoke-dispensary-${selectedDispensary.id}`}
                                className="w-full mt-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                              >
                                {onchainAction === `revoke-dispensary-${selectedDispensary.id}` ? 'Revocando en Stellar...' : 'Revocar de la Red'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
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
                          <button onClick={addManualDispensary} className="w-full rounded-xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory cursor-pointer">
                            Agregar dispensario autorizado
                          </button>
                        </div>
                      </div>
                    )}
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

function getRegistrationSourceLabel(source: PersistenceSource) {
  if (source === 'firebase') return 'Firebase / Firestore';
  if (source === 'supabase') return 'Supabase fallback';
  return 'Fallback local de grabacion';
}

function actorMatchesSession(
  request: { id?: string; contact: string; name: string },
  currentSession: TrustSession | null,
) {
  try {
    const saved = localStorage.getItem('trust_submitted_ids');
    const submittedIds = saved ? JSON.parse(saved) : [];
    if (Array.isArray(submittedIds) && request.id && submittedIds.includes(request.id)) {
      return true;
    }
  } catch {}

  if (!currentSession) return false;
  const sessionEmail = currentSession.email.trim().toLowerCase();
  const sessionName = currentSession.name.trim().toLowerCase();
  return (
    request.contact.trim().toLowerCase() === sessionEmail
    || request.name.trim().toLowerCase() === sessionName
  );
}

function DispensaryRegistrationRoute({
  onBack,
  onNavigate,
  session,
  dispensaryRegistrations,
  registrationSource,
  canOperate,
  onSubmitDispensaryRegistration,
  onSignOut,
}: {
  onBack: () => void;
  onNavigate: (path: string) => void;
  session: TrustSession | null;
  dispensaryRegistrations: DispensaryRegistration[];
  registrationSource: PersistenceSource;
  canOperate: boolean;
  onSubmitDispensaryRegistration: (input: Omit<DispensaryRegistration, 'id' | 'status' | 'submittedAt' | 'onchainStatus'>) => void;
  onSignOut: () => void;
}) {
  const [registrationForm, setRegistrationForm] = useState({
    name: session?.name ?? '',
    legalId: '',
    address: '',
    contact: session?.email ?? '',
    wallet: '',
  });
  const ownRegistrations = dispensaryRegistrations.filter((request) => actorMatchesSession(request, session));
  const latestRegistration = ownRegistrations[0] ?? null;
  const approved = dispensaryRegistrations.filter((request) => request.status === 'approved');
  const sourceLabel = getRegistrationSourceLabel(registrationSource);

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
            {session && (
              <button
                onClick={onSignOut}
                className="text-sm font-bold text-brand-green-deep/60 hover:text-brand-green-deep px-3 py-2 transition-colors cursor-pointer mr-2"
              >
                Cerrar sesión
              </button>
            )}
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

          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Solicitud</p>
                <h2 className="mt-2 text-2xl font-serif">Datos para revisión admin</h2>
                <p className="mt-2 text-xs leading-relaxed text-brand-green-mid/60">
                  Persistencia actual: <strong>{sourceLabel}</strong>. Si ves fallback local, activa Anonymous Auth para guardar solicitudes reales en Firestore.
                </p>
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

            <div className="mt-4 rounded-2xl bg-[#edf2ee]/70 border border-brand-green-deep/5 p-4 flex gap-3 items-start text-brand-green-deep">
              <span className="text-base select-none">💡</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-gold">Edición Manual Activa</p>
                <p className="mt-1 text-[11px] leading-relaxed text-brand-green-mid/80">
                  ¿Los datos de tu cuenta de Google no coinciden? Puedes ajustar libremente tu <strong>nombre comercial</strong>, <strong>correo de contacto</strong> u otros campos antes de enviar tu solicitud para revisión.
                </p>
              </div>
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

          {latestRegistration && (
            <div className="rounded-[24px] border border-brand-green-deep/10 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Mi solicitud</p>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-brand-green-mid/70 sm:grid-cols-2">
                <span>Estado admin: <strong className="text-brand-green-deep">{latestRegistration.status}</strong></span>
                <span>Registro Testnet: <strong className="text-brand-green-deep">{latestRegistration.onchainStatus}</strong></span>
                <span>Contacto: <strong className="text-brand-green-deep">{latestRegistration.contact}</strong></span>
                <span className="break-all">Wallet: <strong className="font-mono text-brand-green-deep">{latestRegistration.wallet}</strong></span>
              </div>
            </div>
          )}

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
  session,
  doctorRegistrations,
  registrationSource,
  canOperate,
  onSubmitDoctorRegistration,
  onSignOut,
}: {
  onBack: () => void;
  onNavigate: (path: string) => void;
  session: TrustSession | null;
  doctorRegistrations: DoctorRegistration[];
  registrationSource: PersistenceSource;
  canOperate: boolean;
  onSubmitDoctorRegistration: (input: Omit<DoctorRegistration, 'id' | 'status' | 'submittedAt' | 'onchainStatus'>) => void;
  onSignOut: () => void;
}) {
  const [rutError, setRutError] = useState<string | null>(null);
  const [registrationForm, setRegistrationForm] = useState({
    name: session?.name ?? '',
    licenseId: '',
    specialty: '',
    contact: session?.email ?? '',
    wallet: '',
    rut: '',
    sisRegistrationId: '',
  });
  const ownRegistrations = doctorRegistrations.filter((request) => actorMatchesSession(request, session));
  const latestRegistration = ownRegistrations[0] ?? null;
  const approved = doctorRegistrations.filter((request) => request.status === 'approved');
  const sourceLabel = getRegistrationSourceLabel(registrationSource);

  const submitRegistration = () => {
    if (!registrationForm.name || !registrationForm.licenseId || !registrationForm.specialty || !registrationForm.contact || !registrationForm.rut || !registrationForm.sisRegistrationId) {
      setRutError('Faltan campos obligatorios por completar.');
      return;
    }

    if (!validateRut(registrationForm.rut)) {
      setRutError('El RUT ingresado no es válido. Verifique el dígito verificador.');
      return;
    }

    setRutError(null);
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
      rut: '',
      sisRegistrationId: '',
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
            {session && (
              <button
                onClick={onSignOut}
                className="text-sm font-bold text-brand-green-deep/60 hover:text-brand-green-deep px-3 py-2 transition-colors cursor-pointer mr-2"
              >
                Cerrar sesión
              </button>
            )}
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
                ? 'Este medico ya puede entrar al panel profesional and emitir recetas verificables en Testnet.'
                : 'La solicitud puede enviarse ahora, pero la emision de recetas queda bloqueada hasta que admin apruebe la credencial.'}
            </p>
          </div>

          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Solicitud</p>
                <h2 className="mt-2 text-2xl font-serif">Datos para revisión admin</h2>
                <p className="mt-2 text-xs leading-relaxed text-brand-green-mid/60">
                  Persistencia actual: <strong>{sourceLabel}</strong>. Si ves fallback local, activa Anonymous Auth para guardar solicitudes reales en Firestore.
                </p>
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

            <div className="mt-4 rounded-2xl bg-[#edf2ee]/70 border border-brand-green-deep/5 p-4 flex gap-3 items-start text-brand-green-deep">
              <span className="text-base select-none">💡</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-gold">Edición Manual Activa</p>
                <p className="mt-1 text-[11px] leading-relaxed text-brand-green-mid/80">
                  ¿Los datos de tu cuenta de Google no coinciden? Puedes ajustar libremente tu <strong>nombre profesional</strong>, <strong>correo de contacto</strong> u otros campos antes de enviar tu solicitud para revisión.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['name', 'Nombre profesional'],
                ['rut', 'RUT Profesional (con DV)'],
                ['sisRegistrationId', 'Nº Registro SIS (Superintendencia de Salud)'],
                ['licenseId', 'Licencia / Registro Médico Nacional'],
                ['specialty', 'Especialidad'],
                ['contact', 'Contacto responsable (Email/Teléfono)'],
                ['wallet', 'Wallet/Credencial Stellar del médico (opcional)'],
              ].map(([key, label]) => (
                <label key={key} className={key === 'wallet' ? 'sm:col-span-2' : ''}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">{label}</span>
                  {key === 'wallet' ? (
                    <div className="mt-2 rounded-2xl border border-brand-green-deep/10 bg-brand-neutral/30 p-4">
                      {registrationForm.wallet ? (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold text-green-800">
                              🟢 Billetera Criptográfica Vinculada
                            </span>
                            <button
                              type="button"
                              onClick={() => setRegistrationForm((curr) => ({ ...curr, wallet: '' }))}
                              className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
                            >
                              Cambiar
                            </button>
                          </div>
                          <p className="mt-2 font-mono text-xs text-brand-green-deep break-all">
                            {registrationForm.wallet}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-brand-green-mid/70 mb-3">
                            Genera una Passkey segura en tu dispositivo o conecta Freighter Wallet para tus firmas de recetas:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const userLabel = `Dr. ${registrationForm.name || 'Médico'}`;
                                  const res = await connectOrCreatePasskeyWallet(userLabel);
                                  setRegistrationForm((curr) => ({ ...curr, wallet: res.contractId }));
                                } catch (e: any) {
                                  alert(e.message || 'Error al conectar passkey.');
                                }
                              }}
                              className="flex-1 rounded-xl bg-brand-gold px-3 py-2 text-xs font-bold text-brand-green-deep transition-transform active:scale-95 cursor-pointer text-center"
                            >
                              🔑 Crear Passkey
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const address = await connectFreighterOnTestnet();
                                  setRegistrationForm((curr) => ({ ...curr, wallet: address }));
                                } catch (e: any) {
                                  alert(e.message || 'Error al conectar Freighter.');
                                }
                              }}
                              className="flex-1 rounded-xl border border-brand-green-deep/15 bg-white px-3 py-2 text-xs font-bold text-brand-green-deep transition-transform active:scale-95 cursor-pointer text-center"
                            >
                              🦊 Conectar Freighter
                            </button>
                            <button
                              type="button"
                              onClick={() => setRegistrationForm((curr) => ({ ...curr, wallet: DEFAULT_DOCTOR_WALLET }))}
                              className="flex-1 rounded-xl border border-brand-green-deep/15 bg-white px-3 py-2 text-xs font-bold text-brand-green-deep transition-transform active:scale-95 cursor-pointer text-center"
                            >
                              💡 Credencial Gestionada
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      value={registrationForm[key as keyof typeof registrationForm]}
                      onChange={(event) => {
                        const val = event.target.value;
                        setRegistrationForm((current) => ({
                          ...current,
                          [key]: key === 'rut' ? formatRut(val) : val,
                        }));
                      }}
                      className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                    />
                  )}
                </label>
              ))}
            </div>

            {rutError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
                ⚠️ {rutError}
              </div>
            )}

            <button
              onClick={submitRegistration}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green-deep px-5 py-3 text-sm font-bold text-brand-ivory hover:bg-brand-green-mid active:scale-95"
            >
              Enviar solicitud al admin <ArrowRight size={16} />
            </button>
          </div>

          {latestRegistration && (
            <div className="rounded-[24px] border border-brand-green-deep/10 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Mi solicitud</p>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-brand-green-mid/70 sm:grid-cols-2">
                <span>Estado admin: <strong className="text-brand-green-deep">{latestRegistration.status}</strong></span>
                <span>Registro Testnet: <strong className="text-brand-green-deep">{latestRegistration.onchainStatus}</strong></span>
                <span>Contacto: <strong className="text-brand-green-deep">{latestRegistration.contact}</strong></span>
                <span className="break-all">Wallet: <strong className="font-mono text-brand-green-deep">{latestRegistration.wallet}</strong></span>
              </div>
            </div>
          )}

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
  const [rutError, setRutError] = useState<string | null>(null);
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    rut: '',
    ispResolutionNumber: '',
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

    if (!registrationForm.name || !registrationForm.rut || !registrationForm.ispResolutionNumber || !registrationForm.legalId || !registrationForm.address || !registrationForm.contact || !registrationForm.wallet) {
      setRutError('Faltan campos obligatorios por completar.');
      return;
    }

    if (!validateRut(registrationForm.rut)) {
      setRutError('El RUT de la organización no es válido. Verifique el dígito verificador.');
      return;
    }

    setRutError(null);
    onSubmitDispensaryRegistration(registrationForm);
    setRegistrationForm({
      name: '',
      rut: '',
      ispResolutionNumber: '',
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
                  ['name', 'Nombre comercial / Razón Social'],
                  ['rut', 'RUT de la Organización (con DV)'],
                  ['ispResolutionNumber', 'Nº Resolución Sanitaria ISP'],
                  ['legalId', 'Registro Sanitario / Legal'],
                  ['address', 'Dirección operativa y Comuna'],
                  ['contact', 'Contacto responsable (Email/Teléfono)'],
                  ['wallet', 'Wallet Stellar del dispensario'],
                ].map(([key, label]) => (
                  <label key={key} className={key === 'wallet' ? 'sm:col-span-2' : ''}>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">{label}</span>
                    {key === 'wallet' ? (
                      <div className="mt-2 rounded-2xl border border-brand-green-deep/10 bg-brand-neutral/30 p-4">
                        {registrationForm.wallet ? (
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold text-green-800">
                                🟢 Billetera Criptográfica Vinculada
                              </span>
                              <button
                                type="button"
                                onClick={() => setRegistrationForm((curr) => ({ ...curr, wallet: '' }))}
                                className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
                              >
                                Cambiar
                              </button>
                            </div>
                            <p className="mt-2 font-mono text-xs text-brand-green-deep break-all">
                              {registrationForm.wallet}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-brand-green-mid/70 mb-3">
                              Genera una Passkey segura en tu dispositivo o conecta Freighter Wallet para tu dispensario:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const userLabel = `Disp. ${registrationForm.name || 'Dispensario'}`;
                                    const res = await connectOrCreatePasskeyWallet(userLabel);
                                    setRegistrationForm((curr) => ({ ...curr, wallet: res.contractId }));
                                  } catch (e: any) {
                                    alert(e.message || 'Error al conectar passkey.');
                                  }
                                }}
                                className="flex-1 rounded-xl bg-brand-gold px-3 py-2 text-xs font-bold text-brand-green-deep transition-transform active:scale-95 cursor-pointer text-center"
                              >
                                🔑 Crear Passkey
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const address = await connectFreighterOnTestnet();
                                    setRegistrationForm((curr) => ({ ...curr, wallet: address }));
                                  } catch (e: any) {
                                    alert(e.message || 'Error al conectar Freighter.');
                                  }
                                }}
                                className="flex-1 rounded-xl border border-brand-green-deep/15 bg-white px-3 py-2 text-xs font-bold text-brand-green-deep transition-transform active:scale-95 cursor-pointer text-center"
                              >
                                🦊 Conectar Freighter
                              </button>
                              <button
                                type="button"
                                onClick={() => setRegistrationForm((curr) => ({ ...curr, wallet: DEFAULT_DISPENSARY_WALLET }))}
                                className="flex-1 rounded-xl border border-brand-green-deep/15 bg-white px-3 py-2 text-xs font-bold text-brand-green-deep transition-transform active:scale-95 cursor-pointer text-center"
                              >
                                💡 Credencial Gestionada
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        value={registrationForm[key as keyof typeof registrationForm]}
                        onChange={(event) => {
                          const val = event.target.value;
                          setRegistrationForm((current) => ({
                            ...current,
                            [key]: key === 'rut' ? formatRut(val) : val,
                          }));
                        }}
                        className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                      />
                    )}
                  </label>
                ))}
              </div>

              {rutError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
                  ⚠️ {rutError}
                </div>
              )}

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

      <LazyPortal
        isOpen={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        initialView={initialView}
        allowedViews={allowedViews}
        roleLabel={roleLabel}
      />
    </div>
  );
}


