import { motion, AnimatePresence } from 'motion/react';
import { X, User, Activity, FileText, ShoppingBag, Search, Stethoscope, Star, MapPin, ArrowRight, ShieldCheck, CheckCircle, Database, Package, Trash2, Plus, Minus, Globe, Upload, Images, Leaf } from 'lucide-react';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useLanguage } from '../context/LanguageContext';
import WalletOnboarding, { WalletSetupState } from './WalletOnboarding';
import { shortenAddress, stellarConfig } from '../lib/stellar/config';
import { connectFreighterOnTestnet } from '../lib/stellar/freighter';
import {
  addFreighterBackupSigner,
  connectOrCreatePasskeyWallet,
  getPasskeyAvailability,
} from '../lib/stellar/passkeys';

export type PortalView = 'overview' | 'doctors' | 'dispensaries' | 'profile' | 'prescriptions' | 'pickups' | 'history' | 'traveler';

interface MockupPortalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: PortalView;
  allowedViews?: PortalView[];
  pageMode?: boolean;
  roleLabel?: string;
}

interface PatientPrescriptionRecord {
  id: number;
  patient: string;
  doctor: string;
  medicationHash: string;
  expiresAt: number;
  totalQuantity?: number;
  dispensedQuantity?: number;
  remainingQuantity?: number;
  isUsed: boolean;
  status: 'active' | 'used' | 'expired';
  issuedAt: string;
  issuedLedger: number;
  txHash: string;
}

interface PatientDispenseRecord {
  id: number;
  prescriptionId: number;
  patient: string;
  doctor: string;
  dispensary: string;
  productHash: string;
  batchHash: string;
  quantity: number;
  dispensedAt: number;
  recordedAt: string;
  recordedLedger: number;
  txHash: string;
}

interface PatientDashboardData {
  patientAddress: string;
  network: string;
  rpcUrl: string;
  latestLedger: number;
  latestLedgerClosedAt: string;
  registryContractId: string;
  prescriptionContractId: string;
  summary: {
    total: number;
    active: number;
    used: number;
    expired: number;
  };
  prescriptions: PatientPrescriptionRecord[];
  dispenseRecords?: PatientDispenseRecord[];
}

interface RuntimeReadiness {
  network: string;
  rpcUrl: string;
  contracts: {
    registryContractId: string;
    dispensaryRegistryContractId: string;
    prescriptionContractId: string;
    dispenseRecordContractId: string;
  };
  capabilities: {
    readContracts: boolean;
    issuePrescriptions: boolean;
    dispensePrescriptions: boolean;
    passkeyRelay: boolean;
    passkeyDiscovery: boolean;
  };
  signers: {
    admin?: {
      configured: boolean;
      address: string | null;
    };
    doctor: {
      configured: boolean;
      address: string | null;
    };
    dispensary: {
      configured: boolean;
      address: string | null;
    };
  };
  missing: string[];
}

interface DispensaryPrescriptionValidation {
  prescription: {
    id: number;
    patient: string;
    doctor: string;
    medicationHash: string;
    expiresAt: number;
    totalQuantity: number;
    dispensedQuantity: number;
    remainingQuantity: number;
    status: 'active' | 'used' | 'expired';
  };
  validation: {
    canDispense: boolean;
    reason: string;
  };
  lastRecord?: {
    id: number;
    quantity: number;
    dispensary: string;
  } | null;
}

interface DoctorAgendaBlock {
  id: string;
  date: string;
  time: string;
  status: 'Disponible' | 'Reservado';
  patient?: string;
  reason?: string;
}

type ConsultationStatus = 'scheduled' | 'checked_in' | 'active' | 'completed';

interface PrivateClinicalRecord {
  id: string;
  title: string;
  status: string;
  summary: string;
  details: string[];
  proof: string;
}

type PrivacyPermissionKind = 'medical-consultation' | 'dispensary-prescription';
type PrivacyPermissionStatus = 'active' | 'revoked';
type ActionDrawerKey =
  | 'doctor-agenda'
  | 'doctor-consultation'
  | 'doctor-clinical-summary'
  | 'doctor-prescription'
  | 'patient-account'
  | 'patient-permissions'
  | 'patient-record'
  | 'patient-prescription'
  | 'patient-traceability'
  | 'dispensary-inventory'
  | 'dispensary-qr'
  | 'dispensary-dispense'
  | 'dispensary-traceability';

interface PrivacyPermission {
  id: string;
  kind: PrivacyPermissionKind;
  actor: string;
  role: 'Medico' | 'Dispensario';
  scope: string;
  expiresAt: string;
  status: PrivacyPermissionStatus;
  hash: string;
  qrToken: string;
  createdAt: string;
}

function ActionCard({
  icon,
  eyebrow,
  title,
  description,
  status,
  onClick,
  tone = 'light',
  disabled = false,
}: {
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  status?: string;
  onClick: () => void;
  tone?: 'light' | 'cream' | 'green' | 'blue';
  disabled?: boolean;
}) {
  const toneClasses = {
    light: 'border-brand-green-deep/10 bg-white hover:border-brand-gold/45',
    cream: 'border-brand-gold/25 bg-[#fbf7ef] hover:border-brand-gold/55',
    green: 'border-brand-green-deep/15 bg-brand-green-deep text-brand-ivory hover:bg-brand-green-mid',
    blue: 'border-blue-100 bg-blue-50 hover:border-blue-200',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex min-h-[156px] w-full flex-col rounded-3xl border p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 ${toneClasses[tone]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          tone === 'green' ? 'bg-white/10 text-brand-gold' : 'bg-brand-green-deep text-brand-gold'
        }`}>
          {icon}
        </span>
        {status && (
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
            tone === 'green' ? 'bg-white/10 text-brand-ivory/80' : 'bg-brand-neutral text-brand-green-mid/65'
          }`}>
            {status}
          </span>
        )}
      </div>
      <div className="mt-5 flex-1">
        {eyebrow && (
          <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.2em] ${
            tone === 'green' ? 'text-brand-gold' : 'text-brand-gold'
          }`}>
            {eyebrow}
          </p>
        )}
        <h4 className={`text-lg font-bold ${tone === 'green' ? 'text-brand-ivory' : 'text-brand-green-deep'}`}>{title}</h4>
        <p className={`mt-2 text-sm leading-relaxed ${tone === 'green' ? 'text-brand-ivory/65' : 'text-brand-green-mid/65'}`}>
          {description}
        </p>
      </div>
      <span className={`mt-5 inline-flex items-center gap-2 text-sm font-bold ${tone === 'green' ? 'text-brand-gold' : 'text-brand-green-deep'}`}>
        Abrir <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
}

function ActionDrawer({
  open,
  eyebrow,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  eyebrow?: string;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="action-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex justify-end bg-brand-green-deep/45 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl md:max-w-[760px] md:rounded-l-[32px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-brand-green-deep/10 bg-[#fbf9f3] px-6 py-6 md:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">{eyebrow}</p>}
                  <h3 className="mt-2 font-serif text-3xl leading-tight text-brand-green-deep md:text-4xl">{title}</h3>
                  {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-green-mid/70">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-green-deep/10 bg-white text-brand-green-deep transition-colors hover:bg-brand-neutral"
                  aria-label="Cerrar panel"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
              {children}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatPortalDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatExpiryDate(timestamp: number) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp * 1000));
}

function capitalizeDateLabel(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatLiveDate(value: Date) {
  return capitalizeDateLabel(new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(value));
}

function formatLiveTime(value: Date) {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function formatRelativeAgendaDate(baseDate: Date, offsetDays: number) {
  const date = new Date(baseDate);
  date.setDate(baseDate.getDate() + offsetDays);

  const dayLabel = offsetDays === 0
    ? 'Hoy'
    : offsetDays === 1
      ? 'Mañana'
      : capitalizeDateLabel(new Intl.DateTimeFormat('es-CL', { weekday: 'long' }).format(date));

  const calendarLabel = new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
  }).format(date);

  return `${dayLabel}, ${calendarLabel}`;
}

function buildLiveDoctorAvailabilitySlots(baseDate: Date) {
  return [
    [formatRelativeAgendaDate(baseDate, 0), '16:30', 'Disponible'],
    [formatRelativeAgendaDate(baseDate, 1), '10:00', 'Disponible'],
    [formatRelativeAgendaDate(baseDate, 1), '12:30', 'Reservado'],
    [formatRelativeAgendaDate(baseDate, 3), '09:00', 'Disponible'],
  ];
}

function buildDefaultDoctorAgenda(baseDate: Date): DoctorAgendaBlock[] {
  return buildLiveDoctorAvailabilitySlots(baseDate).map(([date, time, status], index) => ({
    id: `agenda-seed-${index}`,
    date,
    time,
    status: status as DoctorAgendaBlock['status'],
    patient: status === 'Reservado' ? 'Camila R.' : undefined,
    reason: status === 'Reservado' ? 'Primera consulta y revisión de historial' : undefined,
  }));
}

function shortenHash(value: string, size = 8) {
  if (!value || value.length <= size * 2) {
    return value;
  }

  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

function makeDemoHash(seed: string) {
  const text = `${seed}-${Date.now()}-${Math.random()}`;
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(16).padStart(16, '0');
}

function normalizeDemoText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replaceAll('organico', 'orgánico')
    .replaceAll('analgesico', 'analgésico')
    .replaceAll('traumatologico', 'traumatológico')
    .replaceAll('cronico', 'crónico')
    .replaceAll('medica', 'médica')
    .replaceAll('clinico', 'clínico');
}

function normalizeInventoryProduct<T extends Record<string, any>>(product: T): T {
  return Object.fromEntries(
    Object.entries(product).map(([key, value]) => [key, normalizeDemoText(value)]),
  ) as T;
}

const DEMO_PATIENT_ADDRESS = 'GBOVHFJQXZR5LMODPMKM766SHK5D7XOPZUHUYRPHENQKWDQI33DSWRJ6';
const DEMO_PRESCRIPTION_ID = '1';
const DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS = 30;
const DEFAULT_PRESCRIPTION_USED_GRAMS = 9;

function buildDemoPatientDashboard(patientAddress = DEMO_PATIENT_ADDRESS): PatientDashboardData {
  const now = new Date();
  const issuedAt = new Date(now);
  issuedAt.setHours(now.getHours() - 2);
  const expiresAt = Math.floor(now.getTime() / 1000) + 30 * 24 * 60 * 60;

  return {
    patientAddress,
    network: stellarConfig.networkLabel,
    rpcUrl: stellarConfig.rpcUrl,
    latestLedger: 2540000,
    latestLedgerClosedAt: now.toISOString(),
    registryContractId: 'DoctorRegistry Testnet',
    prescriptionContractId: 'Prescription Testnet demo fallback',
    summary: {
      total: 1,
      active: 1,
      used: 0,
      expired: 0,
    },
    prescriptions: [
      {
        id: Number(DEMO_PRESCRIPTION_ID),
        patient: patientAddress,
        doctor: 'GD2MXRXHYBSSY7CXQWAYN5S7OHAUVEULPHV4SYQA3542GIQLUGJ57VNX',
        medicationHash: 'demo-minimal-prescription-hash',
        expiresAt,
        totalQuantity: DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
        dispensedQuantity: DEFAULT_PRESCRIPTION_USED_GRAMS,
        remainingQuantity: DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS - DEFAULT_PRESCRIPTION_USED_GRAMS,
        isUsed: false,
        status: 'active',
        issuedAt: issuedAt.toISOString(),
        issuedLedger: 2540000,
        txHash: 'demo-testnet-prescription-fallback',
      },
    ],
    dispenseRecords: [
      {
        id: 1,
        prescriptionId: Number(DEMO_PRESCRIPTION_ID),
        patient: patientAddress,
        doctor: 'GD2MXRXHYBSSY7CXQWAYN5S7OHAUVEULPHV4SYQA3542GIQLUGJ57VNX',
        dispensary: 'GCJLFG6PX6OA6JBJPQP2PXBJ7SD726O4R46IMWD4GBK3CX7HCWEJZRJ6',
        productHash: 'demo-product-hash',
        batchHash: 'demo-batch-hash',
        quantity: DEFAULT_PRESCRIPTION_USED_GRAMS,
        dispensedAt: Math.floor(issuedAt.getTime() / 1000),
        recordedAt: issuedAt.toISOString(),
        recordedLedger: 2540001,
        txHash: 'demo-testnet-dispense-fallback',
      },
    ],
  };
}

function buildDemoPrescriptionValidation(
  prescriptionId = Number(DEMO_PRESCRIPTION_ID),
): DispensaryPrescriptionValidation {
  return {
    prescription: {
      id: prescriptionId,
      patient: DEMO_PATIENT_ADDRESS,
      doctor: 'GD2MXRXHYBSSY7CXQWAYN5S7OHAUVEULPHV4SYQA3542GIQLUGJ57VNX',
      medicationHash: 'demo-minimal-prescription-hash',
      expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      totalQuantity: DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
      dispensedQuantity: DEFAULT_PRESCRIPTION_USED_GRAMS,
      remainingQuantity: DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS - DEFAULT_PRESCRIPTION_USED_GRAMS,
      status: 'active',
    },
    validation: {
      canDispense: true,
      reason: 'Receta de prueba validada para grabacion. El dispensario ve saldo, vigencia y permiso minimo, no ficha clinica.',
    },
    lastRecord: {
      id: 1,
      quantity: DEFAULT_PRESCRIPTION_USED_GRAMS,
      dispensary: 'GCJLFG6PX6OA6JBJPQP2PXBJ7SD726O4R46IMWD4GBK3CX7HCWEJZRJ6',
    },
  };
}

function isPrescriptionNotValidError(message: string) {
  return /PRESCRIPTION_NOT_VALID|Error\(Contract,\s*#4\)|is_valid.*false|not valid|invalid|used|consum/i.test(message);
}

// Future hardening: Agent 402 checks should resolve against a private vault
// (Supabase + encrypted storage) and publish only decisions, hashes and state
// transitions to Stellar. The UI below keeps that privacy model visible in MVP.
// Current MVP records each dispense as a partial allowance. Production should
// enforce weekly limits/remaining grams in contract state, not burn the prescription.

const MOCK_DOCTORS = [
  { id: 'doc-1', name: "Dr. Alejandro Merino", specialty: "Endocannabinología", rating: 4.9, reviews: 124, availability: "Hoy" },
  { id: 'doc-2', name: "Dra. Elena Sotillo", specialty: "Medicina Interna", rating: 4.8, reviews: 89, availability: "Mañana" },
  { id: 'doc-3', name: "Dr. Roberto Valdés", specialty: "Psiquiatría Terapéutica", rating: 5.0, reviews: 56, availability: "En 2 días" }
];

const MOCK_DISPENSARIES = [
  { 
    id: 'disp-1', 
    name: "Green Leaf Center", 
    address: "Av. Principal 123", 
    distance: "1.2km", 
    status: "Abierto", 
    stock: "Alto",
    inventory: [
      { 
        id: 'st-1', 
        name: "Northern Sky", 
        type: "Indica Dominante", 
        thc: "18%", 
        cbd: "2%", 
        terpenes: "Mirceno, Pineno, Cariofileno", 
        effect: "Sedativo / Relajante",
        recommendation: "Recomendado para: Insomnio prolongado y dolores musculares crónicos.",
        origin: "Cultivo Orgánico - Mendoza, AR",
        lab: "QC-991 • Pure Labs",
        harvestDate: "Marzo 2026",
        batch: "Lote: NS-2026-X01",
        description: "Northern Sky es una cepa robusta con un perfil de terpenos terroso y matices de pino. Ideal para el uso nocturno.",
        components: [
          { name: "THC-A", value: "17.4%" },
          { name: "Delta-9 THC", value: "0.6%" },
          { name: "CBD", value: "2.1%" },
          { name: "CBG", value: "0.8%" }
        ]
      },
      { 
        id: 'st-2', 
        name: "Lemon Haze", 
        type: "Sativa", 
        thc: "21%", 
        cbd: "0.5%", 
        terpenes: "Limoneno, Terpinoleno, Ocimeno", 
        effect: "Energizante / Creativo",
        recommendation: "Recomendado para: Fatiga mental y cuadros de depresión leve.",
        origin: "Altas Cumbres - Córdoba, AR",
        lab: "QC-882 • EcoAnalytica",
        harvestDate: "Abril 2026",
        batch: "Lote: LH-2026-Z42",
        description: "Con un aroma cítrico punzante, Lemon Haze ofrece un impulso cerebral inmediato, perfecto para mantener la productividad.",
        components: [
          { name: "THC-V", value: "1.2%" },
          { name: "Delta-9 THC", value: "21.1%" },
          { name: "CBN", value: "0.2%" }
        ]
      },
      { 
        id: 'st-5', 
        name: "Blue Dream", 
        type: "Híbrida", 
        thc: "19%", 
        cbd: "1%", 
        terpenes: "Mirceno, Cariofileno, Pineno", 
        effect: "Equilibrado / Eufórico",
        recommendation: "Recomendado para: Náuseas post-quimioterapia y falta de apetito.",
        origin: "Valle Inferior - Chubut, AR",
        lab: "QC-112 • Patagonia Lab",
        harvestDate: "Febrero 2026",
        batch: "Lote: BD-2026-P09",
        description: "Una de las cepas más versátiles, Blue Dream combina la relajación física de la índica con la chispa mental de la sativa.",
        components: [
          { name: "THC", value: "19.3%" },
          { name: "CBD", value: "1.1%" },
          { name: "CBC", value: "0.5%" }
        ]
      },
      {
        id: 'st-8',
        name: "Jack Herer",
        type: "Sativa Dominante",
        thc: "20%",
        cbd: "0.2%",
        terpenes: "Terpinoleno, Pineno, Nerolidol",
        effect: "Cerebral / Social",
        recommendation: "Recomendado para: TDAH y ansiedad social moderada.",
        origin: "Delta del Paraná - Buenos Aires, AR",
        lab: "QC-441 • Delta Labs",
        harvestDate: "Mayo 2026",
        batch: "Lote: JH-2026-D11",
        description: "Lleva el nombre del legendario activista. Ofrece claridad mental y un perfil especiado inconfundible.",
        components: [
          { name: "THC", value: "20.1%" },
          { name: "CBG", value: "1.2%" }
        ]
      }
    ]
  },
  { 
    id: 'disp-2', 
    name: "Nature Trust Lab", 
    address: "Calle Roble 45", 
    distance: "2.5km", 
    status: "Cerrando pronto", 
    stock: "Medio",
    inventory: [
      { 
        id: 'st-3', 
        name: "Deep Forest", 
        type: "Híbrida 50/50", 
        thc: "15%", 
        cbd: "15%", 
        terpenes: "Cariofileno, Humuleno, Mirceno", 
        effect: "Ansiolítico / Suave",
        recommendation: "Recomendado para: Ansiedad social y uso terapéutico equilibrado.",
        origin: "Valle de la Luna - San Juan, AR",
        lab: "QC-771 • BioTrust",
        harvestDate: "Enero 2026",
        batch: "Lote: DF-2026-S11",
        description: "Deep Forest es excelente para quienes buscan los beneficios terapéuticos del CBD sin un efecto psicoactivo abrumador.",
        components: [
          { name: "CBD", value: "15.2%" },
          { name: "THC", value: "14.8%" }
        ]
      },
      { 
        id: 'st-6', 
        name: "Purple Kush", 
        type: "100% Indica", 
        thc: "22%", 
        cbd: "0.1%", 
        terpenes: "Linalool, Mirceno, Humuleno", 
        effect: "Narcótico / Físico",
        recommendation: "Recomendado para: Dolor neuropático severo y espasmos musculares.",
        origin: "Pircas del Sol - La Rioja, AR",
        lab: "QC-334 • SolLabs",
        harvestDate: "Mayo 2026",
        batch: "Lote: PK-2026-K88",
        description: "Una cepa clásica de las montañas, famosa por su coloración púrpura y su capacidad para inducir un sueño profundo.",
        components: [
          { name: "THC", value: "22.4%" },
          { name: "CBN", value: "0.5%" }
        ]
      },
      {
        id: 'st-9',
        name: "OG Kush",
        type: "Híbrida Indica",
        thc: "23%",
        cbd: "1%",
        terpenes: "Mirceno, Limoneno, Cariofileno",
        effect: "Sofocante / Relajante",
        recommendation: "Recomendado para: Estrés post-traumático y migrañas severas.",
        origin: "Valle de Uco - Mendoza, AR",
        lab: "QC-229 • Andes Lab",
        harvestDate: "Abril 2026",
        batch: "Lote: OG-2026-A05",
        description: "La columna vertebral de las variedades de la costa oeste. Fuerte, terrosa y extremadamente potente.",
        components: [
          { name: "THC", value: "23.2%" },
          { name: "CBG", value: "1.1%" }
        ]
      }
    ]
  },
  { 
    id: 'disp-3', 
    name: "Wellness Botanical", 
    address: "Paseo de la Salud 8", 
    distance: "4.1km", 
    status: "Abierto", 
    stock: "Full",
    inventory: [
      { 
        id: 'st-4', 
        name: "CBD Pure", 
        type: "CBD Dominante", 
        thc: "1%", 
        cbd: "24%", 
        terpenes: "Linalool, Terpineol, Mirceno", 
        effect: "Medicinal / Lúcido",
        recommendation: "Recomendado para: Niños con epilepsia refractaria y casos de inflamación severa.",
        origin: "Vivero Nacional - Buenos Aires, AR",
        lab: "QC-001 • ANMAT Oficial",
        harvestDate: "Mayo 2026",
        batch: "Lote: CP-2026-F01",
        description: "Cepa de grado farmacéutico, desarrollada bajo estrictos estándares para pacientes que requieren CBD de alta pureza.",
        components: [
          { name: "CBD", value: "24.1%" },
          { name: "THC", value: "0.8%" },
          { name: "CBD-V", value: "0.5%" }
        ]
      },
      { 
        id: 'st-7', 
        name: "White Widow", 
        type: "Híbrida", 
        thc: "17%", 
        cbd: "3%", 
        terpenes: "Mirceno, Limoneno, Cariofileno", 
        effect: "Comunicativo / Alerta",
        recommendation: "Recomendado para: Fatiga crónica y estimulación del enfoque cognitivo.",
        origin: "Invernaderos del Este - Uruguay (Importado)",
        lab: "QC-552 • Mercosur Analítica",
        harvestDate: "Abril 2026",
        batch: "Lote: WW-2026-M22",
        description: "Una leyenda global refinada en laboratorios regionales para maximizar su consistencia terapeútica.",
        components: [
          { name: "THC", value: "17.2%" },
          { name: "CBD", value: "3.1%" }
        ]
      },
      {
        id: 'st-10',
        name: "Harlequin",
        type: "CBD 5:2",
        thc: "5%",
        cbd: "12%",
        terpenes: "Mirceno, Pineno, Humuleno",
        effect: "Alivio sin pesadez",
        recommendation: "Recomendado para: Artritis reumatoidea y fibromialgia.",
        origin: "Granjas del Sur - Neuquén, AR",
        lab: "QC-993 • Patagonian Bio",
        harvestDate: "Marzo 2026",
        batch: "Lote: HQ-2026-N44",
        description: "Famosa por su ratio equilibrado, permite el alivio del dolor sin interferir con las actividades diarias.",
        components: [
          { name: "CBD", value: "12.4%" },
          { name: "THC", value: "5.1%" }
        ]
      }
    ]
  },
];

const DISPENSARY_INVENTORY_SEED = [
  {
    id: 'inv-cbd-balance',
    name: 'CBD Balance 10:10',
    type: 'Aceite sublingual',
    batch: 'TL-CBD-10-2026-A',
    stockGrams: 42,
    thc: '10%',
    cbd: '10%',
    lab: 'Trust Leaf QC',
    origin: 'Cultivo certificado - Lote Mendoza',
    effect: 'Equilibrado / analgésico',
    description: 'Producto listo para dispensar contra receta validada.',
  },
  {
    id: 'inv-northern-sky',
    name: 'Northern Sky',
    type: 'Flor seca',
    batch: 'TL-NS-2026-X01',
    stockGrams: 18,
    thc: '18%',
    cbd: '2%',
    lab: 'Pure Labs',
    origin: 'Cultivo orgánico - Mendoza',
    effect: 'Sedativo / relajante',
    description: 'Inventario trazable con certificado de laboratorio cargado.',
  },
];

const PRIVATE_CLINICAL_DOSSIER = [
  {
    id: 'symptoms',
    title: 'Síntomas reportados',
    status: 'Privado',
    summary: 'Dolor crónico lumbar, dificultad para dormir y episodios de ansiedad.',
    details: ['Evolución registrada por el paciente', 'Escala de dolor: 7/10', 'Frecuencia: diaria', 'Última actualización: hace 6 días'],
    proof: 'hash:symptoms-9f31',
  },
  {
    id: 'exams',
    title: 'Exámenes y respaldos',
    status: 'Validado',
    summary: 'Resonancia, informe traumatológico y certificado de tratamiento previo.',
    details: ['3 documentos cifrados', 'Firmas de clínica verificadas', 'OCR local para extraer solo metadatos', 'Contenido médico no se publica on-chain'],
    proof: 'hash:docs-2b77',
  },
  {
    id: 'treatment',
    title: 'Historial terapéutico',
    status: 'Listo para médico',
    summary: 'Tratamientos previos, respuesta a dosis y tolerancia del paciente.',
    details: ['AINEs con respuesta parcial', 'Fisioterapia documentada', 'Uso cannabis medicinal supervisado', 'Alertas de interacción: sin registros críticos'],
    proof: 'hash:treatment-a140',
  },
];

const CLINICAL_EXAM_GALLERY = [
  {
    id: 'exam-mri',
    name: 'Resonancia lumbar',
    type: 'Imagen médica',
    date: '08 may 2026',
    proof: 'hash:mri-82f1',
  },
  {
    id: 'exam-trauma',
    name: 'Informe traumatológico',
    type: 'Documento PDF',
    date: '04 may 2026',
    proof: 'hash:trauma-61d0',
  },
  {
    id: 'exam-lab',
    name: 'Laboratorio base',
    type: 'Resultados',
    date: '28 abr 2026',
    proof: 'hash:lab-a903',
  },
];

const DOCTOR_SESSION_PATIENTS = [
  {
    id: 'pat-001',
    name: 'Paciente 0',
    reason: 'Dolor crónico lumbar',
    status: 'Listo para revisar',
    lastVisit: 'Control en 30 días',
    wallet: DEMO_PATIENT_ADDRESS,
  },
  {
    id: 'pat-002',
    name: 'Lucia M.',
    reason: 'Insomnio refractario',
    status: 'Documentos pendientes',
    lastVisit: 'Primera consulta',
    wallet: 'GD2MXRXHUGJ57VNXQWDTLPRIVATE402PATIENT0002',
  },
  {
    id: 'pat-003',
    name: 'Rafael P.',
    reason: 'Ansiedad y dolor neuropático',
    status: 'Seguimiento activo',
    lastVisit: 'Hace 14 días',
    wallet: 'GCFW6WEVFOLLOWUPPRIVATE402PATIENT0003',
  },
];

const MOCK_ORDERS = [
  { 
    id: 'ord-101', 
    item: "Northern Sky (Flores)", 
    dispensary: "Green Leaf Center", 
    date: "28 Abr 2026", 
    amount: "10g", 
    price: "$12.500", 
    status: "Entregado",
    hash: "0x78a1...c432"
  },
  { 
    id: 'ord-098', 
    item: "CBD Pure (Aceite 5%)", 
    dispensary: "Wellness Botanical", 
    date: "15 Mar 2026", 
    amount: "30ml", 
    price: "$8.200", 
    status: "Entregado",
    hash: "0x42b9...e910"
  },
  { 
    id: 'ord-085', 
    item: "Lemon Haze (Flores)", 
    dispensary: "Green Leaf Center", 
    date: "02 Feb 2026", 
    amount: "5g", 
    price: "$6.800", 
    status: "Entregado",
    hash: "0x11d3...f002"
  }
];

const MOCK_GLOBAL_REGIONS = [
  {
    id: 'reg-prt',
    country: 'Portugal',
    status: 'Descriminalizado',
    partner: 'Lisbon Green Life',
    flag: '🇵🇹',
    continent: 'Europa',
    requirements: ['Documento ID', 'Validación Trust'],
    description: 'DESTINO TOP 1: Marco progresivo con eventos internacionales próximamente. Acceso mediante clubes certificados.'
  },
  {
    id: 'reg-arg',
    country: 'Argentina',
    status: 'Medicinal Legal',
    partner: 'REPROCANN Network',
    flag: '🇦🇷',
    continent: 'América',
    requirements: ['Certificado REPROCANN', 'DNI'],
    description: 'DESTINO TOP 2: Acceso federal garantizado. Validación inmediata de su tratamiento médico habitual.'
  },
  {
    id: 'reg-ury',
    country: 'Uruguay',
    status: 'Totalmente Legal',
    partner: 'Asociación Cannábica MVD',
    flag: '🇺🇾',
    continent: 'América',
    requirements: ['Documento de identidad', 'Validación Trust Leaf'],
    description: 'Pioneros en regulación. Acceso simple para pacientes internacionales validados.'
  },
  {
    id: 'reg-deu',
    country: 'Alemania',
    status: 'Legal con Receta',
    partner: 'Berlin Medical Botanical',
    flag: '🇩🇪',
    continent: 'Europa',
    requirements: ['Credencial médica', 'Sync Blockchain Trust'],
    description: 'Protocolos estrictos de la UE. Su receta tiene validez transatlántica.'
  },
  {
    id: 'reg-usa-mia',
    country: 'Miami, USA',
    status: 'Medicinal Legal',
    partner: 'Florida Health Network',
    flag: '🇺🇸',
    continent: 'América',
    requirements: ['Documento de identidad', 'Medical Registration'],
    description: 'Altos estándares farmacéuticos. Protocolos HIPAA en dispensarios premium de South Beach.'
  }
];

const MOCK_GLOBAL_DISPENSARIES: Record<string, any[]> = {
  'reg-prt': [
    { id: 'disp-prt-1', name: 'Lisboa Social Club', address: 'Av. da Liberdade, 100', rating: 4.9, distance: 'Cerca de Barrio Alto', inventory: [
      { id: 's-prt-1', name: 'Algarve Kush', type: 'Indica', thc: '21%', terpenes: 'Mirceno', effects: 'Sedación profunda' }
    ]},
  ],
  'reg-arg': [
    { id: 'disp-arg-1', name: 'Buenos Aires Wellness', address: 'Palermo Soho, CABA', rating: 4.9, distance: 'Plaza Italia', inventory: [
      { id: 's-arg-1', name: 'Patagonia Gold', type: 'Hybrid', thc: '20%', terpenes: 'Limoneno', effects: 'Equilibrio y calma' }
    ]},
  ],
  'reg-ury': [
    { id: 'disp-ury-1', name: 'Montevideo Cannabis Club', address: 'Bulevar Artigas 1200', rating: 4.9, distance: 'A 2.4km de tu ubicación', inventory: [
      { id: 's-ury-1', name: 'Punta del Este Gold', type: 'Sativa Dominant', thc: '22%', terpenes: 'Limoneno, Pineno', effects: 'Euforia, Creatividad' },
      { id: 's-ury-2', name: 'Río de la Plata Kush', type: 'Indica dominant', thc: '19%', terpenes: 'Mirceno, Cariofileno', effects: 'Relajación, Analgésico' }
    ]},
  ],
  'reg-deu': [
    { id: 'disp-deu-1', name: 'Berlin Pharma Green', address: 'Mitte DISTRICT, 10117', rating: 5.0, distance: 'Cerca de Alexanderplatz', inventory: [
      { id: 's-deu-1', name: 'EU Medical Grade #4', type: 'Balanced Hybrid', thc: '20%', terpenes: 'Linalool', effects: 'Balance, Calma mental' }
    ]},
  ],
  'reg-usa-mia': [
    { id: 'disp-usa-1', name: 'Miami Beach Wellness', address: 'Collins Ave, Miami Beach', rating: 4.8, distance: 'South Beach', inventory: [
      { id: 's-usa-1', name: 'Sunshine State OG', type: 'Hybrid', thc: '25%', terpenes: 'Cariofileno', effects: 'Euforia, Relajación' }
    ]},
  ]
};

export default function MockupPortal({
  isOpen,
  onClose,
  initialView = 'overview',
  allowedViews,
  pageMode = false,
  roleLabel = 'Trust Leaf Portal',
}: MockupPortalProps) {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<PortalView>(initialView);
  const isDoctorPortal = roleLabel === 'Portal Médico';
  const isDispensaryPortal = roleLabel === 'Portal Dispensario';
  const isViewAllowed = (view: PortalView) => !allowedViews || allowedViews.includes(view);
  const switchView = (view: PortalView) => {
    if (isViewAllowed(view)) {
      setActiveView(view);
    }
  };
  const [walletSetup, setWalletSetup] = useState<WalletSetupState>(() => {
    const saved = localStorage.getItem('trust_wallet_setup');
    if (saved) {
      return JSON.parse(saved);
    }

    return {
      primaryMethod: null,
      hasFreighterBackup: false,
      walletLabel: 'Trust Leaf Smart Wallet',
      contractAccount: 'CAX7...LEAF',
      networkLabel: stellarConfig.networkLabel,
    };
  });
  const [walletBusy, setWalletBusy] = useState<'passkey' | 'freighter' | 'backup' | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletHint, setWalletHint] = useState<string | null>(
    'Todos los accesos de esta versión operan exclusivamente sobre Stellar Testnet.',
  );
  const [patientDashboard, setPatientDashboard] = useState<PatientDashboardData | null>(() => {
    const saved = localStorage.getItem('trust_patient_dashboard');
    return saved ? JSON.parse(saved) : null;
  });
  const [patientDashboardLoading, setPatientDashboardLoading] = useState(false);
  const [patientDashboardError, setPatientDashboardError] = useState<string | null>(null);
  const [runtimeReadiness, setRuntimeReadiness] = useState<RuntimeReadiness | null>(null);
  const [doctorIssueForm, setDoctorIssueForm] = useState({
    treatment: 'Cannabis medicinal para manejo de dolor crónico',
    dosage: '0.5g por vía vaporizada cada 12 horas',
    notes: 'Control clínico en 30 días.',
    durationDays: 30,
    monthlyLimitGrams: DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
  });
  const [doctorPatientAddress, setDoctorPatientAddress] = useState(() =>
    localStorage.getItem('trust_doctor_patient_address') || DEMO_PATIENT_ADDRESS,
  );
  const [doctorIssueBusy, setDoctorIssueBusy] = useState(false);
  const [doctorIssueError, setDoctorIssueError] = useState<string | null>(null);
  const [doctorIssueSuccess, setDoctorIssueSuccess] = useState<string | null>(null);
  const [dispensePrescriptionId, setDispensePrescriptionId] = useState(() =>
    localStorage.getItem('trust_dispense_prescription_id') ||
    localStorage.getItem('trust_latest_prescription_id') ||
    DEMO_PRESCRIPTION_ID,
  );
  const [prescriptionAllowance, setPrescriptionAllowance] = useState(() => {
    const saved = localStorage.getItem('trust_prescription_allowance');
    return saved
      ? JSON.parse(saved)
      : {
          monthlyLimitGrams: DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
          usedGrams: DEFAULT_PRESCRIPTION_USED_GRAMS,
        };
  });
  const [dispenseBusy, setDispenseBusy] = useState(false);
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  const [dispenseSuccess, setDispenseSuccess] = useState<string | null>(null);
  const [prescriptionValidation, setPrescriptionValidation] = useState<DispensaryPrescriptionValidation | null>(null);
  const [prescriptionValidationBusy, setPrescriptionValidationBusy] = useState(false);
  const [prescriptionValidationError, setPrescriptionValidationError] = useState<string | null>(null);
  const [faucetBusy, setFaucetBusy] = useState<'doctor' | 'dispensary' | 'patient' | null>(null);
  const [faucetNotice, setFaucetNotice] = useState<string | null>(null);
  const [manualPrescriptionEntry, setManualPrescriptionEntry] = useState(false);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  const [selectedTraceRecord, setSelectedTraceRecord] = useState<any | null>(null);
  const [selectedClinicalRecord, setSelectedClinicalRecord] = useState<any | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<ActionDrawerKey | null>(null);
  const [clinicalAccessState, setClinicalAccessState] = useState<Record<string, 'private' | 'authorized' | 'revoked'>>({});
  const [privacyPermissions, setPrivacyPermissions] = useState<PrivacyPermission[]>(() => {
    const saved = localStorage.getItem('trust_privacy_permissions');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedQrPermission, setSelectedQrPermission] = useState<PrivacyPermission | null>(null);
  const [dispensaryValidation, setDispensaryValidation] = useState<PrivacyPermission | null>(null);
  const [uploadedClinicalExams, setUploadedClinicalExams] = useState<Array<{
    id: string;
    name: string;
    type: string;
    date: string;
    proof: string;
  }>>([]);
  const [consultationClinicalRecords, setConsultationClinicalRecords] = useState<PrivateClinicalRecord[]>(() => {
    const saved = localStorage.getItem('trust_consultation_clinical_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [showClinicalGallery, setShowClinicalGallery] = useState(false);
  const [cannabisMarketOpen, setCannabisMarketOpen] = useState(false);
  const [cannabisMarketInterest, setCannabisMarketInterest] = useState(false);
  const [currentNow, setCurrentNow] = useState(() => new Date());
  const [doctorAgendaBlocks, setDoctorAgendaBlocks] = useState<DoctorAgendaBlock[]>(() => {
    const saved = localStorage.getItem('trust_doctor_agenda_blocks');
    return saved ? JSON.parse(saved) : buildDefaultDoctorAgenda(new Date());
  });
  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [agendaForm, setAgendaForm] = useState({
    date: formatRelativeAgendaDate(new Date(), 1),
    time: '15:00',
    status: 'Disponible' as DoctorAgendaBlock['status'],
    patient: '',
  });
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(() =>
    localStorage.getItem('trust_selected_consultation_id'),
  );
  const [consultationStatusById, setConsultationStatusById] = useState<Record<string, ConsultationStatus>>(() => {
    const saved = localStorage.getItem('trust_consultation_status');
    return saved ? JSON.parse(saved) : {};
  });
  const [consultationSummaryDraft, setConsultationSummaryDraft] = useState(() =>
    localStorage.getItem('trust_consultation_summary_draft') ||
    'Paciente refiere dolor persistente, dificultad para dormir y tolerancia previa a preparados de cannabis medicinal. Se revisan antecedentes autorizados por el paciente.',
  );
  const [prescriptionToolOpen, setPrescriptionToolOpen] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState<any | null>(null);
  const [bookingStep, setBookingStep] = useState<'date' | 'time' | 'confirm' | 'success'>('date');
  const [selectedDispensary, setSelectedDispensary] = useState<any | null>(null);
  const [selectedStrain, setSelectedStrain] = useState<any | null>(null);
  const [dispensaryStep, setDispensaryStep] = useState<'inventory' | 'validate' | 'confirm' | 'success'>('inventory');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activePickups, setActivePickups] = useState<any[]>(() => {
    const saved = localStorage.getItem('trust_pickups');
    return saved ? JSON.parse(saved) : [];
  });
  const [hasPrescription, setHasPrescription] = useState(() => {
    const saved = localStorage.getItem('trust_has_rx');
    return saved === 'true';
  });
  const [cart, setCart] = useState<any[]>(() => {
    const saved = localStorage.getItem('trust_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [dispensaryInventory, setDispensaryInventory] = useState<any[]>(() => {
    const saved = localStorage.getItem('trust_dispensary_inventory');
    const source = saved ? JSON.parse(saved) : DISPENSARY_INVENTORY_SEED;
    return source.map(normalizeInventoryProduct);
  });
  const [inventoryForm, setInventoryForm] = useState({
    name: 'CBD Balance 10:10',
    type: 'Aceite sublingual',
    batch: `TL-${new Date().getFullYear()}-001`,
    stockGrams: 10,
    thc: '10%',
    cbd: '10%',
    lab: 'Trust Leaf QC',
    origin: 'Cultivo certificado',
  });
  const [travelerActive, setTravelerActive] = useState(false);
  const [regionFilter, setRegionFilter] = useState<'Todos' | 'América' | 'Europa' | 'Oceanía'>('Todos');
  const [selectedRegion, setSelectedRegion] = useState<any | null>(null);
  const [regionStep, setRegionStep] = useState<'regions' | 'dispensaries' | 'inventory'>('regions');
  const [processingPickup, setProcessingPickup] = useState<any | null>(null);
  const [pickupStep, setPickupStep] = useState<'idle' | 'scanning' | 'verifying' | 'success'>('idle');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState(() => {
    const saved = localStorage.getItem('trust_activity');
    return saved ? JSON.parse(saved) : [
      { id: 'act-init-1', action: "Consulta Médico Especialista", date: "Hace 2 horas", icon: "Stethoscope" },
      { id: 'act-init-2', action: "Receta Digital Generada", date: "Hace 2 horas", icon: "FileText" },
      { id: 'act-init-3', action: "Sincronización con Red", date: "Ayer", icon: "Search" }
    ];
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem('trust_pickups', JSON.stringify(activePickups));
  }, [activePickups]);

  useEffect(() => {
    localStorage.setItem('trust_has_rx', String(hasPrescription));
  }, [hasPrescription]);

  useEffect(() => {
    if (patientDashboard) {
      localStorage.setItem('trust_patient_dashboard', JSON.stringify(patientDashboard));
    }
  }, [patientDashboard]);

  useEffect(() => {
    localStorage.setItem('trust_activity', JSON.stringify(recentActivity));
  }, [recentActivity]);

  useEffect(() => {
    localStorage.setItem('trust_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('trust_dispensary_inventory', JSON.stringify(dispensaryInventory));
  }, [dispensaryInventory]);

  useEffect(() => {
    localStorage.setItem('trust_wallet_setup', JSON.stringify(walletSetup));
  }, [walletSetup]);

  useEffect(() => {
    localStorage.setItem('trust_doctor_patient_address', doctorPatientAddress);
  }, [doctorPatientAddress]);

  useEffect(() => {
    localStorage.setItem('trust_dispense_prescription_id', dispensePrescriptionId);
    setPrescriptionValidation(null);
    setPrescriptionValidationError(null);
  }, [dispensePrescriptionId]);

  useEffect(() => {
    localStorage.setItem('trust_prescription_allowance', JSON.stringify(prescriptionAllowance));
  }, [prescriptionAllowance]);

  useEffect(() => {
    localStorage.setItem('trust_doctor_agenda_blocks', JSON.stringify(doctorAgendaBlocks));
  }, [doctorAgendaBlocks]);

  useEffect(() => {
    if (selectedConsultationId) {
      localStorage.setItem('trust_selected_consultation_id', selectedConsultationId);
    } else {
      localStorage.removeItem('trust_selected_consultation_id');
    }
  }, [selectedConsultationId]);

  useEffect(() => {
    localStorage.setItem('trust_consultation_status', JSON.stringify(consultationStatusById));
  }, [consultationStatusById]);

  useEffect(() => {
    localStorage.setItem('trust_consultation_clinical_records', JSON.stringify(consultationClinicalRecords));
  }, [consultationClinicalRecords]);

  useEffect(() => {
    localStorage.setItem('trust_consultation_summary_draft', consultationSummaryDraft);
  }, [consultationSummaryDraft]);

  useEffect(() => {
    localStorage.setItem('trust_privacy_permissions', JSON.stringify(privacyPermissions));
  }, [privacyPermissions]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentNow(new Date());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const walletConnected = walletSetup.primaryMethod !== null;
  const passkeyAvailability = getPasskeyAvailability();
  const patientIdentityAddress = useMemo(() => {
    if (!walletConnected) {
      return null;
    }

    if (walletSetup.primaryMethod === 'passkey') {
      return walletSetup.contractAccount;
    }

    return walletSetup.freighterAddress ?? walletSetup.contractAccount;
  }, [walletConnected, walletSetup.contractAccount, walletSetup.freighterAddress, walletSetup.primaryMethod]);
  const primaryPrescription = patientDashboard?.prescriptions[0] ?? null;
  const activePrescription = patientDashboard?.prescriptions.find(
    (prescription) => prescription.status === 'active',
  ) ?? null;
  const selectedClinicalAccess = selectedClinicalRecord
    ? clinicalAccessState[selectedClinicalRecord.id] ?? 'private'
    : 'private';
  const clinicalAccessDoctor = 'Dr. Alejandro Merino';
  const clinicalExamGallery = [...CLINICAL_EXAM_GALLERY, ...uploadedClinicalExams];
  const portableClinicalDossier = [...consultationClinicalRecords, ...PRIVATE_CLINICAL_DOSSIER];
  const manualPrescriptionId = Number(dispensePrescriptionId.match(/\d+/)?.[0] ?? Number.NaN);
  const resolvedPrescriptionId = activePrescription?.id ?? (
    Number.isFinite(manualPrescriptionId) ? manualPrescriptionId : Number(DEMO_PRESCRIPTION_ID)
  );
  const dispenseRecords = patientDashboard?.dispenseRecords ?? [];
  const doctorSignerReady = runtimeReadiness?.capabilities.issuePrescriptions ?? false;
  const dispensarySignerReady = runtimeReadiness?.capabilities.dispensePrescriptions ?? false;
  const reservedAgendaBlocks = doctorAgendaBlocks.filter((block) => block.status === 'Reservado');
  const availableAgendaBlocks = doctorAgendaBlocks.filter((block) => block.status === 'Disponible');
  const patientUpcomingConsultation = reservedAgendaBlocks.find((block) =>
    block.patient === 'Paciente demo' || block.reason?.includes('portal paciente'),
  ) ?? null;
  const selectedConsultationBlock = reservedAgendaBlocks.find((block) => block.id === selectedConsultationId) ?? null;
  const prescriptionPatientAddress = selectedConsultationBlock
    ? DEMO_PATIENT_ADDRESS
    : doctorPatientAddress.trim();
  const selectedConsultationStatus = selectedConsultationBlock
    ? consultationStatusById[selectedConsultationBlock.id] ?? 'scheduled'
    : null;
  const bookingDates = useMemo(() => {
    return Array.from({ length: 4 }, (_, index) => {
      const date = new Date(currentNow);
      date.setDate(currentNow.getDate() + index + 1);
      const label = new Intl.DateTimeFormat('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(date);
      return label.charAt(0).toUpperCase() + label.slice(1);
    });
  }, [currentNow]);
  const bookingTimeOptions = useMemo(() => {
    if (!selectedDate) {
      return ['09:00 AM', '10:30 AM', '02:00 PM', '04:30 PM'];
    }

    const availableForDate = availableAgendaBlocks
      .filter((block) => block.date === selectedDate)
      .map((block) => block.time);

    return availableForDate.length ? availableForDate : ['09:00 AM', '10:30 AM', '02:00 PM', '04:30 PM'];
  }, [availableAgendaBlocks, selectedDate]);
  const canAccessDispensaries = isDispensaryPortal || hasPrescription || Boolean(primaryPrescription);
  const activePrivacyPermissions = privacyPermissions.filter((permission) => permission.status === 'active');
  const patientTrustAccountAddress = patientIdentityAddress ?? DEMO_PATIENT_ADDRESS;
  const doctorCredentialAddress =
    runtimeReadiness?.signers.doctor.address ?? 'GD2MXRXH...UGJ57VNX';
  const dispensaryCredentialAddress =
    runtimeReadiness?.signers.dispensary.address ?? 'GCJLFG6P...CWEJZRJ6';
  const trustAccountMetrics = [
    ['Recetas verificables', patientDashboardLoading ? '...' : String(patientDashboard?.summary.total ?? 0)],
    ['Permisos activos', String(activePrivacyPermissions.length)],
    ['Retiros trazables', String(activePickups.length + dispenseRecords.length)],
  ] as const;
  const doctorCredentialMetrics = [
    ['Estado', doctorSignerReady ? 'Autorizado' : 'Signer pendiente'],
    ['Recetas emitidas', String(patientDashboard?.summary.total ?? 1)],
    ['Pacientes con permiso', String(activePrivacyPermissions.filter((permission) => permission.role === 'Medico').length || 1)],
  ] as const;
  const dispensaryCredentialMetrics = [
    ['Estado', dispensarySignerReady ? 'Autorizado' : 'Signer pendiente'],
    ['Entregas registradas', String(activePickups.length + dispenseRecords.length)],
    ['Lotes activos', String(dispensaryInventory.length)],
  ] as const;
  const latestMedicalPermission = activePrivacyPermissions.find((permission) => permission.kind === 'medical-consultation') ?? null;
  const latestDispensaryPermission = activePrivacyPermissions.find((permission) => permission.kind === 'dispensary-prescription') ?? null;
  const recordingFlowSteps = [
    ['Identidad', walletConnected, 'Paciente entra con cuenta de prueba, passkey o Freighter.'],
    ['Consulta', Boolean(patientUpcomingConsultation || selectedConsultationBlock), 'El paciente agenda y el medico valida llegada.'],
    ['Permiso medico', Boolean(latestMedicalPermission), 'El paciente comparte ficha privada por ventana temporal.'],
    ['Receta', Boolean(hasPrescription || primaryPrescription), 'El medico emite receta verificable para el paciente.'],
    ['QR dispensario', Boolean(latestDispensaryPermission), 'El paciente comparte solo receta, saldo y formatos autorizados.'],
    ['Retiro parcial', activePickups.length > 0, 'El dispensario registra lote, cantidad y trazabilidad.'],
  ] as const;
  const mvpOperationalChecks = [
    ['Contratos Testnet', Boolean(runtimeReadiness?.capabilities.readContracts), 'DoctorRegistry, DispensaryRegistry, Prescription y DispenseRecord activos.'],
    ['Signers Testnet', Boolean(doctorSignerReady && dispensarySignerReady), 'Medico y dispensario pueden firmar acciones desde backend Testnet.'],
    ['Passkeys', Boolean(runtimeReadiness?.capabilities.passkeyRelay && runtimeReadiness.capabilities.passkeyDiscovery), 'Relayer y Mercury listos para smart wallets reales.'],
    ['Paciente Testnet', walletConnected, 'Cuenta de prueba, Passkey o Freighter define la direccion del dashboard.'],
    ['Receta activa', Boolean(hasPrescription || primaryPrescription), 'La receta existe y mantiene saldo verificable.'],
    ['Dispensacion', activePickups.length + dispenseRecords.length > 0, 'Existe al menos un retiro parcial o registro on-chain.'],
  ] as const;

  const fundTestnetRole = async (role: 'doctor' | 'dispensary' | 'patient') => {
    setFaucetBusy(role);
    setFaucetNotice(null);

    try {
      const response = await fetch('/api/stellar/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'No fue posible usar el faucet testnet.');
      }

      const roleLabel = {
        doctor: 'medico',
        dispensary: 'dispensario',
        patient: 'paciente',
      }[role];
      setFaucetNotice(`Faucet testnet listo para ${roleLabel}: ${shortenAddress(payload.address, 8)}.`);
    } catch (error) {
      setFaucetNotice(error instanceof Error ? error.message : 'No fue posible usar el faucet testnet.');
    } finally {
      setFaucetBusy(null);
    }
  };

  useEffect(() => {
    if (!patientIdentityAddress) {
      setPatientDashboardError(null);
      return;
    }

    let cancelled = false;

    const loadPatientDashboard = async () => {
      setPatientDashboardLoading(true);
      setPatientDashboardError(null);

      try {
        const response = await fetch(`/api/stellar/patient/${patientIdentityAddress}/dashboard`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || 'No fue posible cargar el estado on-chain del paciente.');
        }

        if (cancelled) {
          return;
        }

        if (walletSetup.primaryMethod === 'demo' && payload.summary.total === 0) {
          setPatientDashboard(buildDemoPatientDashboard(patientIdentityAddress));
          setHasPrescription(true);
          return;
        }

        setPatientDashboard(payload);
        setHasPrescription(payload.summary.total > 0);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPatientDashboardError(
          error instanceof Error
            ? error.message
            : 'No fue posible cargar el estado on-chain del paciente.',
        );
      } finally {
        if (!cancelled) {
          setPatientDashboardLoading(false);
        }
      }
    };

    loadPatientDashboard();

    return () => {
      cancelled = true;
    };
  }, [patientIdentityAddress]);

  useEffect(() => {
    let cancelled = false;

    const loadRuntimeReadiness = async () => {
      try {
        const response = await fetch('/api/stellar/readiness');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || 'No fue posible cargar el estado operacional.');
        }

        if (!cancelled) {
          setRuntimeReadiness(payload);
        }
      } catch {
        if (!cancelled) {
          setRuntimeReadiness(null);
        }
      }
    };

    loadRuntimeReadiness();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeView !== 'dispensaries' || activePrescription) {
      return;
    }

    const shouldRefreshDemoRx =
      !dispensePrescriptionId.trim() || dispensePrescriptionId === DEMO_PRESCRIPTION_ID;

    if (!shouldRefreshDemoRx) {
      return;
    }

    let cancelled = false;

    const loadDemoPrescription = async () => {
      try {
        const response = await fetch(`/api/stellar/patient/${DEMO_PATIENT_ADDRESS}/dashboard`);
        const payload = await response.json();

        if (!response.ok) {
          return;
        }

        const demoActivePrescription = payload.prescriptions?.find(
          (prescription: PatientPrescriptionRecord) => prescription.status === 'active',
        );

        if (!cancelled && demoActivePrescription) {
          setDispensePrescriptionId(String(demoActivePrescription.id));
        }
      } catch {
        // Keep the static demo fallback if the read endpoint is unavailable.
      }
    };

    loadDemoPrescription();

    return () => {
      cancelled = true;
    };
  }, [activePrescription, activeView, dispensePrescriptionId]);

  useEffect(() => {
    if (!isDispensaryPortal || activeView !== 'dispensaries') {
      return;
    }

    if (!dispensePrescriptionId.trim()) {
      setDispensePrescriptionId(DEMO_PRESCRIPTION_ID);
    }

    setPatientDashboard((current) => current ?? buildDemoPatientDashboard(DEMO_PATIENT_ADDRESS));
    setHasPrescription(true);
    setPrescriptionValidation((current) => current ?? buildDemoPrescriptionValidation(resolvedPrescriptionId));
    setPrescriptionAllowance((current: any) => ({
      ...current,
      monthlyLimitGrams: Number(current.monthlyLimitGrams) || DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
      usedGrams: Number(current.usedGrams) || DEFAULT_PRESCRIPTION_USED_GRAMS,
    }));

    if (!dispensaryValidation) {
      const permission = latestDispensaryPermission ?? createPrivacyPermission('dispensary-prescription', false);
      setDispensaryValidation(permission);
    }
  }, [activeView, isDispensaryPortal]);

  const connectPasskeyWallet = async () => {
    setWalletBusy('passkey');
    setWalletError(null);

    try {
      const result = await connectOrCreatePasskeyWallet('Paciente Trust Leaf');
      setWalletSetup((current) => ({
        ...current,
        primaryMethod: 'passkey',
        walletLabel: 'Passkey Smart Wallet',
        contractAccount: result.contractId,
        networkLabel: stellarConfig.networkLabel,
        passkeyId: result.keyId,
      }));
      setWalletHint(
        'Passkey conectada en testnet. Si quieres más resiliencia, ahora puedes vincular Freighter como respaldo.',
      );
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'No se pudo conectar Passkey.');
    } finally {
      setWalletBusy(null);
    }
  };

  const connectFreighterWallet = async () => {
    setWalletBusy('freighter');
    setWalletError(null);

    try {
      const freighter = await connectFreighterOnTestnet();
      setWalletSetup((current) => ({
        ...current,
        primaryMethod: current.primaryMethod ?? 'freighter',
        hasFreighterBackup:
          current.primaryMethod === 'passkey' ? true : current.hasFreighterBackup,
        walletLabel:
          current.primaryMethod === 'passkey'
            ? current.walletLabel
            : 'Freighter Wallet',
        contractAccount:
          current.primaryMethod === 'passkey'
            ? current.contractAccount
            : freighter.address,
        networkLabel: stellarConfig.networkLabel,
        freighterAddress: freighter.address,
      }));
      setWalletHint(
        walletSetup.primaryMethod === 'passkey'
          ? 'Freighter quedó vinculada como método alternativo sobre testnet.'
          : 'Freighter conectada correctamente en Stellar Testnet.',
      );
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'No se pudo conectar Freighter.');
    } finally {
      setWalletBusy(null);
    }
  };

  const connectDemoPatientWallet = () => {
    setWalletSetup((current) => ({
      ...current,
      primaryMethod: 'demo',
      hasFreighterBackup: false,
      walletLabel: 'Paciente de prueba Testnet',
      contractAccount: DEMO_PATIENT_ADDRESS,
      freighterAddress: DEMO_PATIENT_ADDRESS,
      networkLabel: stellarConfig.networkLabel,
    }));
    setWalletError(null);
    setWalletHint('Paciente de prueba conectado. Esta identidad ya tiene historial real en Stellar Testnet.');
    setDoctorPatientAddress(DEMO_PATIENT_ADDRESS);
    setPatientDashboard((current) => current ?? buildDemoPatientDashboard(DEMO_PATIENT_ADDRESS));
    setHasPrescription(true);
    localStorage.setItem('trust_has_rx', 'true');
    localStorage.setItem('trust_latest_prescription_id', DEMO_PRESCRIPTION_ID);
    localStorage.setItem('trust_dispense_prescription_id', DEMO_PRESCRIPTION_ID);
  };

  const resetDemoState = () => {
    [
      'trust_patient_dashboard',
      'trust_pickups',
      'trust_has_rx',
      'trust_cart',
      'trust_privacy_permissions',
      'trust_prescription_allowance',
      'trust_latest_prescription_id',
      'trust_dispense_prescription_id',
      'trust_activity',
      'trust_selected_consultation_id',
      'trust_consultation_status',
      'trust_consultation_clinical_records',
      'trust_consultation_summary_draft',
    ].forEach((key) => localStorage.removeItem(key));

    setPatientDashboard(null);
    setActivePickups([]);
    setHasPrescription(false);
    setCart([]);
    setPrivacyPermissions([]);
    setSelectedQrPermission(null);
    setDispensaryValidation(null);
    setPrescriptionAllowance({
      monthlyLimitGrams: DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
      usedGrams: DEFAULT_PRESCRIPTION_USED_GRAMS,
    });
    setDispensePrescriptionId(DEMO_PRESCRIPTION_ID);
    setRecentActivity([
      { id: 'act-reset-1', action: 'Flujo reiniciado para grabacion', date: 'Recién', icon: 'Activity' },
      { id: 'act-init-1', action: 'Consulta medico especialista pendiente', date: 'Flujo limpio', icon: 'Stethoscope' },
    ]);
    setSelectedConsultationId(null);
    setConsultationStatusById({});
    setConsultationClinicalRecords([]);
    setConsultationSummaryDraft('Paciente refiere dolor persistente, dificultad para dormir y tolerancia previa a preparados de cannabis medicinal. Se revisan antecedentes autorizados por el paciente.');
    setDoctorIssueSuccess(null);
    setDoctorIssueError(null);
    setDispenseSuccess(null);
    setDispenseError(null);
    resetBooking();
    resetDispensaryFlow();
    switchView('overview');
    connectDemoPatientWallet();
  };

  const linkFreighterBackup = async () => {
    setWalletBusy('backup');
    setWalletError(null);

    try {
      if (walletSetup.primaryMethod !== 'passkey') {
        throw new Error('Primero debes crear o conectar tu wallet principal con Passkey.');
      }

      const freighter = await connectFreighterOnTestnet();
      await addFreighterBackupSigner(freighter.address);

      setWalletSetup((current) => ({
        ...current,
        hasFreighterBackup: true,
        freighterAddress: freighter.address,
        networkLabel: stellarConfig.networkLabel,
      }));
      setWalletHint(
        'Freighter quedó agregada como signer de respaldo para tu smart wallet de passkey en testnet.',
      );
    } catch (error) {
      setWalletError(
        error instanceof Error ? error.message : 'No se pudo vincular Freighter como respaldo.',
      );
    } finally {
      setWalletBusy(null);
    }
  };

  const openOnchainPrescription = (prescription: PatientPrescriptionRecord) => {
    setSelectedPrescription({
      id: `Receta #${prescription.id}`,
      doctor: shortenAddress(prescription.doctor, 6),
      date: formatPortalDate(prescription.issuedAt),
      validUntil: formatExpiryDate(prescription.expiresAt),
      treatment: `Hash clínico ${shortenHash(prescription.medicationHash)}`,
      concentration: 'Documento clínico protegido fuera de cadena',
      dosage:
        prescription.status === 'used'
          ? 'Esta receta ya fue consumida por un dispensario autorizado.'
          : prescription.status === 'expired'
            ? 'La receta expiró en testnet y requiere nueva emisión médica.'
            : 'Receta vigente. El documento médico completo se resuelve off-chain.',
      notes: `Tx ${shortenHash(prescription.txHash)} • Ledger ${prescription.issuedLedger}`,
    });
  };

  const handleDoctorIssuePrescription = async () => {
    const targetPatientAddress = prescriptionPatientAddress.trim();

    if (!targetPatientAddress) {
      setDoctorIssueError('Ingresa la dirección Stellar del paciente para emitir la receta.');
      return;
    }

    setDoctorIssueBusy(true);
    setDoctorIssueError(null);
    setDoctorIssueSuccess(null);

    try {
      if (!doctorSignerReady) {
        issueDemoPrescription(targetPatientAddress);
        setConsultationStatus('completed');
        setPrescriptionToolOpen(false);
        return;
      }

      const response = await fetch('/api/stellar/doctor/issue-prescription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientAddress: targetPatientAddress,
          treatment: doctorIssueForm.treatment,
          dosage: doctorIssueForm.dosage,
          notes: doctorIssueForm.notes,
          durationDays: doctorIssueForm.durationDays,
          totalQuantity: Math.max(
            1,
            Number(doctorIssueForm.monthlyLimitGrams) || DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
          ),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'No fue posible emitir la receta en testnet.');
      }

      setPatientDashboard(payload.dashboard);
      setHasPrescription(payload.dashboard.summary.total > 0);
      setDoctorIssueSuccess(
        `Receta emitida en testnet. Número ${payload.issuedId ?? 'pendiente'} - Tx ${shortenHash(payload.txHash)}`,
      );
      setPrescriptionToolOpen(false);
      setPrescriptionAllowance({
        monthlyLimitGrams: Math.max(1, Number(doctorIssueForm.monthlyLimitGrams) || DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS),
        usedGrams: 0,
      });
      if (payload.issuedId !== undefined && payload.issuedId !== null) {
        const issuedId = String(payload.issuedId);
        localStorage.setItem('trust_latest_prescription_id', issuedId);
        setDispensePrescriptionId(issuedId);
      }
      setRecentActivity((prev: any[]) => [
        {
          id: `act-issue-${Date.now()}`,
          action: `Receta emitida para ${shortenAddress(targetPatientAddress, 5)}`,
          date: 'Recién',
          icon: 'FileText',
        },
        ...prev,
      ]);
    } catch (error) {
      setDoctorIssueError(
        error instanceof Error ? error.message : 'No fue posible emitir la receta en testnet.',
      );
    } finally {
      setDoctorIssueBusy(false);
    }
  };

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'Stethoscope': return <Stethoscope size={14} />;
      case 'FileText': return <FileText size={14} />;
      case 'Search': return <Search size={14} />;
      case 'Activity': return <Activity size={14} />;
      case 'ShoppingBag': return <ShoppingBag size={14} />;
      case 'CheckCircle': return <CheckCircle size={14} className="text-brand-gold" />;
      default: return <Activity size={14} />;
    }
  };

  const handleCompleteBooking = () => {
    setBookingStep('success');
    if (bookingDoctor && selectedDate && selectedTime) {
      const bookedBlock: DoctorAgendaBlock = {
        id: `agenda-booking-${Date.now()}`,
        date: selectedDate,
        time: selectedTime,
        status: 'Reservado',
        patient: 'Paciente demo',
        reason: `Reserva desde portal paciente con ${bookingDoctor.name}`,
      };
      setDoctorAgendaBlocks((prev) => {
        const hasExistingBlock = prev.some((block) => block.date === selectedDate && block.time === selectedTime);

        if (!hasExistingBlock) {
          return [bookedBlock, ...prev];
        }

        return prev.map((block) => (
          block.date === selectedDate && block.time === selectedTime
            ? { ...block, ...bookedBlock, id: block.id }
            : block
        ));
      });
    }
    // Simulate updating activity
    setTimeout(() => {
      const newActivity = { 
        id: `act-booking-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        action: `Cita agendada con ${bookingDoctor.name}`, 
        date: "Recién", 
        icon: "Activity" 
      };
      setRecentActivity(prev => [newActivity, ...prev]);
    }, 500);
  };

  const handleAddAgendaBlock = () => {
    const block: DoctorAgendaBlock = {
      id: `agenda-custom-${Date.now()}`,
      date: agendaForm.date.trim() || formatRelativeAgendaDate(currentNow, 1),
      time: agendaForm.time.trim() || '15:00',
      status: agendaForm.status,
      patient: agendaForm.status === 'Reservado' ? (agendaForm.patient.trim() || 'Paciente por confirmar') : undefined,
      reason: agendaForm.status === 'Reservado' ? 'Bloque reservado manualmente' : undefined,
    };

    setDoctorAgendaBlocks((prev) => [block, ...prev]);
    setAgendaForm({
      date: formatRelativeAgendaDate(currentNow, 1),
      time: '15:00',
      status: 'Disponible',
      patient: '',
    });
    setShowAgendaForm(false);
  };

  const toggleAgendaBlockStatus = (blockId: string) => {
    setDoctorAgendaBlocks((prev) => prev.map((block) => {
      if (block.id !== blockId) {
        return block;
      }

      if (block.status === 'Reservado') {
        return {
          ...block,
          status: 'Disponible',
          patient: undefined,
          reason: undefined,
        };
      }

      return {
        ...block,
        status: 'Reservado',
        patient: 'Paciente demo',
        reason: 'Reserva manual desde panel médico',
      };
    }));
  };

  const openConsultationFromBlock = (block: DoctorAgendaBlock) => {
    setSelectedConsultationId(block.id);
    setDoctorPatientAddress(DEMO_PATIENT_ADDRESS);
    setConsultationSummaryDraft(
      `Motivo: ${block.reason ?? 'Consulta de seguimiento'}. Paciente ${block.patient ?? 'demo'} autoriza revision de ficha privada, examenes y antecedentes relevantes para evaluar tratamiento con cannabis medicinal.`,
    );
    setConsultationStatusById((prev) => ({
      ...prev,
      [block.id]: prev[block.id] ?? 'scheduled',
    }));
  };

  const saveConsultationSummaryToRecord = (statusOverride?: ConsultationStatus) => {
    if (!selectedConsultationBlock) {
      return;
    }

    const recordId = `consultation-${selectedConsultationBlock.id}`;
    const savedAt = formatLiveDate(new Date());
    const summary = consultationSummaryDraft.trim() || 'Resumen clinico pendiente de completar.';

    setConsultationClinicalRecords((prev) => {
      const nextRecord: PrivateClinicalRecord = {
        id: recordId,
        title: `Consulta ${selectedConsultationBlock.patient ?? 'paciente'}`,
        status: (statusOverride ?? selectedConsultationStatus) === 'completed' ? 'Consulta cerrada' : 'Resumen en curso',
        summary,
        details: [
          `Atencion realizada por ${clinicalAccessDoctor}`,
          `Fecha y hora: ${selectedConsultationBlock.date} · ${selectedConsultationBlock.time}`,
          `Motivo: ${selectedConsultationBlock.reason ?? 'Revision clinica'}`,
          `Resumen medico privado: ${summary}`,
          'Notas, examenes e imagenes permanecen cifrados off-chain; Stellar recibe solo hash y estado verificable',
        ],
        proof: `hash:consult-${makeDemoHash(`${selectedConsultationBlock.id}-${summary}`).slice(0, 8)}`,
      };

      if (prev.some((record) => record.id === recordId)) {
        return prev.map((record) => (record.id === recordId ? nextRecord : record));
      }

      return [nextRecord, ...prev];
    });

    setDoctorIssueForm((prev) => ({
      ...prev,
      notes: `${summary} Control clinico en 30 dias.`,
    }));

    setRecentActivity((prev: any[]) => [
      {
        id: `act-consultation-summary-${Date.now()}`,
        action: `Resumen clinico guardado · ${savedAt}`,
        date: 'Recien',
        icon: 'FileText',
      },
      ...prev,
    ]);
  };

  const setConsultationStatus = (status: ConsultationStatus, consultationId = selectedConsultationId) => {
    if (!consultationId) {
      return;
    }

    setConsultationStatusById((prev) => ({
      ...prev,
      [consultationId]: status,
    }));

    setRecentActivity((prev: any[]) => [
      {
        id: `act-consultation-${Date.now()}-${status}`,
        action: status === 'active' ? 'Consulta médica iniciada' : 'Consulta médica finalizada',
        date: 'Recién',
        icon: 'Stethoscope',
      },
      ...prev,
    ]);

    const targetConsultationBlock = reservedAgendaBlocks.find((block) => block.id === consultationId);

    if (status === 'completed' && targetConsultationBlock) {
      const selectedConsultationBlock = targetConsultationBlock;
      saveConsultationSummaryToRecord('completed');
      const recordId = `consultation-${targetConsultationBlock.id}`;
      const completedAt = formatLiveDate(new Date());
      setConsultationClinicalRecords((prev) => {
        if (prev.some((record) => record.id === recordId)) {
          return prev;
        }

        return [
          {
            id: recordId,
            title: `Consulta ${targetConsultationBlock.patient ?? 'paciente'}`,
            status: 'Consulta',
            summary: `${selectedConsultationBlock.reason ?? 'Consulta médica finalizada'} · ${completedAt}.`,
            details: [
              `Atención realizada por ${clinicalAccessDoctor}`,
              `Fecha y hora: ${selectedConsultationBlock.date} · ${selectedConsultationBlock.time}`,
              `Motivo: ${selectedConsultationBlock.reason ?? 'Revisión clínica'}`,
              'Notas y documentos permanecen cifrados; solo se comparte hash verificable con permiso del paciente',
            ],
            proof: `hash:consult-${makeDemoHash(selectedConsultationBlock.id).slice(0, 8)}`,
          },
          ...prev,
        ];
      });
    }
  };

  useEffect(() => {
    if (!selectedConsultationBlock) {
      return;
    }

    setDoctorIssueForm((prev) => ({
      ...prev,
      treatment: prev.treatment || 'Cannabis medicinal para manejo de dolor crónico',
      notes: selectedConsultationBlock.reason
        ? `${selectedConsultationBlock.reason}. Control clínico en 30 días.`
        : prev.notes,
    }));
  }, [selectedConsultationBlock]);

  const issueDemoPrescription = (targetPatientAddress: string) => {
    const issuedId = Number(localStorage.getItem('trust_latest_prescription_id') ?? DEMO_PRESCRIPTION_ID) + 1;
    const issuedAt = new Date();
    const expiresAt = Math.floor(issuedAt.getTime() / 1000) + (Number(doctorIssueForm.durationDays) || 30) * 24 * 60 * 60;
    const medicationHash = makeDemoHash(`${targetPatientAddress}-${doctorIssueForm.treatment}-${doctorIssueForm.dosage}`);
    const txHash = makeDemoHash(`demo-rx-${issuedId}`);
    const demoPrescription: PatientPrescriptionRecord = {
      id: issuedId,
      patient: targetPatientAddress,
      doctor: runtimeReadiness?.signers.doctor.address ?? 'GDOCTORDEMO402TRUSTLEAFTESTNET000000000000',
      medicationHash,
      expiresAt,
      isUsed: false,
      status: 'active',
      issuedAt: issuedAt.toISOString(),
      issuedLedger: runtimeReadiness ? 2540000 + issuedId : 2540000 + issuedId,
      txHash,
    };

    setPatientDashboard((current) => ({
      patientAddress: targetPatientAddress,
      network: stellarConfig.networkLabel,
      rpcUrl: stellarConfig.rpcUrl,
      latestLedger: current?.latestLedger ?? 2540000 + issuedId,
      latestLedgerClosedAt: issuedAt.toISOString(),
      registryContractId: current?.registryContractId ?? 'DoctorRegistry demo',
      prescriptionContractId: current?.prescriptionContractId ?? 'Prescription demo',
      summary: {
        total: (current?.summary.total ?? 0) + 1,
        active: (current?.summary.active ?? 0) + 1,
        used: current?.summary.used ?? 0,
        expired: current?.summary.expired ?? 0,
      },
      prescriptions: [demoPrescription, ...(current?.prescriptions ?? [])],
      dispenseRecords: current?.dispenseRecords ?? [],
    }));
    setHasPrescription(true);
    setPrescriptionAllowance({
      monthlyLimitGrams: Math.max(1, Number(doctorIssueForm.monthlyLimitGrams) || DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS),
      usedGrams: 0,
    });
    localStorage.setItem('trust_latest_prescription_id', String(issuedId));
    setDispensePrescriptionId(String(issuedId));
    setDoctorIssueSuccess(
      `Receta de prueba generada para grabación. Número ${issuedId} - Hash ${shortenHash(txHash)}. Pendiente de firma real en Stellar Testnet.`,
    );
    const dispensaryPermission = createPrivacyPermission('dispensary-prescription', false);
    setDispensaryValidation(dispensaryPermission);
    setRecentActivity((prev: any[]) => [
      {
        id: `act-demo-issue-${Date.now()}`,
        action: `Receta de prueba creada para ${shortenAddress(targetPatientAddress, 5)}`,
        date: 'Recién',
        icon: 'FileText',
      },
      ...prev,
    ]);

    if (selectedConsultationBlock) {
      const recordId = `consultation-${selectedConsultationBlock.id}`;
      setConsultationClinicalRecords((prev) => {
        const prescriptionDetail = `Receta #${issuedId} asociada · hash ${shortenHash(txHash)} · cupo ${doctorIssueForm.monthlyLimitGrams}g`;
        if (prev.some((record) => record.id === recordId)) {
          return prev.map((record) => (
            record.id === recordId
              ? {
                  ...record,
                  status: 'Receta asociada',
                  details: record.details.includes(prescriptionDetail)
                    ? record.details
                    : [...record.details, prescriptionDetail],
                  proof: `hash:consult-rx-${makeDemoHash(`${recordId}-${issuedId}`).slice(0, 8)}`,
                }
              : record
          ));
        }

        return [
          {
            id: recordId,
            title: `Consulta ${selectedConsultationBlock.patient ?? 'paciente'}`,
            status: 'Receta asociada',
            summary: `${selectedConsultationBlock.reason ?? 'Consulta médica'} · receta #${issuedId} generada.`,
            details: [
              `Atención realizada por ${clinicalAccessDoctor}`,
              `Fecha y hora: ${selectedConsultationBlock.date} · ${selectedConsultationBlock.time}`,
              `Tratamiento: ${doctorIssueForm.treatment}`,
              prescriptionDetail,
              'Diagnóstico y notas completas permanecen cifrados off-chain',
            ],
            proof: `hash:consult-rx-${makeDemoHash(`${recordId}-${issuedId}`).slice(0, 8)}`,
          },
          ...prev,
        ];
      });
    }
  };

  const handleClinicalExamUpload = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const uploaded = Array.from(files).map((file, index) => ({
      id: `exam-upload-${Date.now()}-${index}`,
      name: file.name.replace(/\.[^/.]+$/, '') || 'Examen cargado',
      type: file.type.includes('image') ? 'Imagen médica' : 'Documento privado',
      date: 'Subido hoy',
      proof: `hash:upload-${Math.random().toString(16).slice(2, 8)}`,
    }));

    setUploadedClinicalExams((current) => [...uploaded, ...current]);
    setSelectedClinicalRecord(PRIVATE_CLINICAL_DOSSIER[1]);
    setShowClinicalGallery(true);
  };

  const handleCompleteAcquisition = () => {
    setDispensaryStep('success');
    
    const newPickups = cart.map(item => ({
      id: `pick-${Date.now()}-${item.strain.id}`,
      strain: item.strain,
      quantity: item.quantity,
      dispensary: selectedDispensary,
      status: 'pending',
      token: `QR-${Math.random().toString(36).substring(7).toUpperCase()}`,
      expires: 'Expira en 23:59h'
    }));
    
    setTimeout(() => {
      setActivePickups(prev => [...newPickups, ...prev]);
      
      const newActivities = newPickups.map(pickup => ({ 
        id: `act-disp-${Date.now()}-${pickup.id}`,
        action: `Token generado: ${pickup.strain.name}`, 
        date: "Recién", 
        icon: "ShoppingBag" 
      }));
      
      setRecentActivity(prev => [...newActivities, ...prev]);
      setCart([]); // Clear cart after success
    }, 500);
  };

  const registerLocalDispense = (prescriptionId: number, mode: 'demo' | 'fallback') => {
    const quantity = cart.reduce((total, item) => total + item.quantity, 0);
    const recordId = `${mode === 'demo' ? 'DEMO' : 'PRIVATE'}-${Date.now().toString().slice(-5)}`;
    const newPickups = cart.map(item => ({
      id: `pick-${mode}-${Date.now()}-${item.strain.id}`,
      strain: item.strain,
      quantity: item.quantity,
      dispensary: selectedDispensary,
      status: 'pending',
      token: `RECETA-${prescriptionId}-${recordId}`,
      expires: mode === 'demo' ? 'Retiro demo registrado' : 'Cupo privado registrado'
    }));

    setHasPrescription(true);
    setPrescriptionAllowance((current: any) => ({
      ...current,
      usedGrams: Math.min(
        Number(current.monthlyLimitGrams) || DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
        (Number(current.usedGrams) || 0) + quantity,
      ),
    }));
    setDispensaryInventory(prev => prev.map((product) => {
      const dispensed = cart.find((item) => item.strain.id === product.id)?.quantity ?? 0;
      if (!dispensed) {
        return product;
      }

      return {
        ...product,
        stockGrams: Math.max(0, Number(product.stockGrams ?? 0) - dispensed),
      };
    }));
    setActivePickups(prev => [...newPickups, ...prev]);
    setRecentActivity(prev => [
      {
        id: `act-${mode}-disp-${Date.now()}`,
        action: `Retiro fraccionado de receta ${prescriptionId}`,
        date: "Recién",
        icon: "ShoppingBag",
      },
      ...prev,
    ]);
    setDispenseSuccess(
      mode === 'demo'
        ? `Retiro de prueba registrado. Record ${recordId}. La receta mantiene saldo para futuras entregas.`
        : 'El contrato testnet marcó esta receta sin cupo activo. Trust Leaf conserva un retiro fraccionado privado mientras la siguiente versión de contratos maneja gramos restantes por periodo.',
    );
    setDispensaryStep('success');
    setCart([]);
  };

  const handleCompleteOnchainDispense = async () => {
    const prescriptionId = resolvedPrescriptionId;

    if (!Number.isFinite(prescriptionId)) {
      setDispenseError('Ingresa el número de receta on-chain que emitió el médico.');
      return;
    }

    if (!cart.length) {
      setDispenseError('Agrega al menos una medicina al carrito antes de dispensar.');
      return;
    }

    if (prescriptionValidation && !prescriptionValidation.validation.canDispense) {
      setDispenseError(prescriptionValidation.validation.reason);
      return;
    }

    setDispenseBusy(true);
    setDispenseError(null);
    setDispenseSuccess(null);

    try {
      if (!dispensarySignerReady) {
        registerLocalDispense(prescriptionId, 'demo');
        return;
      }

      const productLabel = cart
        .map((item) => `${item.strain.name} x${item.quantity}g`)
        .join(' + ');
      const batchLabel = cart
        .map((item) => item.strain.batch || item.strain.id)
        .join(' + ');
      const quantity = cart.reduce((total, item) => total + item.quantity, 0);
      const response = await fetch('/api/stellar/dispensary/dispense-prescription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prescriptionId,
          productLabel,
          batchLabel,
          quantity,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.code || payload.message || 'No fue posible dispensar la receta en testnet.');
      }

      setPatientDashboard(payload.dashboard);
      setHasPrescription(payload.dashboard.summary.total > 0);
      setDispenseSuccess(
        `Retiro parcial registrado. Record ${payload.recordId ?? 'pendiente'} - Tx ${shortenHash(payload.txHash)}. La receta sigue disponible para futuros retiros.`,
      );
      setPrescriptionAllowance((current: any) => ({
        ...current,
        usedGrams: Math.min(
          Number(current.monthlyLimitGrams) || DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
          (Number(current.usedGrams) || 0) + quantity,
        ),
      }));
      setDispensaryStep('success');

      const newPickups = cart.map(item => ({
        id: `pick-${Date.now()}-${item.strain.id}`,
        strain: item.strain,
        quantity: item.quantity,
        dispensary: selectedDispensary,
        status: 'pending',
        token: `RECETA-${prescriptionId}-DR-${payload.recordId ?? 'TESTNET'}`,
        expires: 'Retiro parcial registrado'
      }));

      setActivePickups(prev => [...newPickups, ...prev]);
      setRecentActivity(prev => [
        {
          id: `act-disp-${Date.now()}`,
          action: `Retiro parcial de receta ${prescriptionId}`,
          date: "Recién",
          icon: "ShoppingBag",
        },
        ...prev,
      ]);
      setDispensaryInventory(prev => prev.map((product) => {
        const dispensed = cart.find((item) => item.strain.id === product.id)?.quantity ?? 0;
        if (!dispensed) {
          return product;
        }

        return {
          ...product,
          stockGrams: Math.max(0, Number(product.stockGrams ?? 0) - dispensed),
        };
      }));
      setCart([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible dispensar la receta en testnet.';
      if (isPrescriptionNotValidError(message)) {
        registerLocalDispense(prescriptionId, 'fallback');
        return;
      }

      setDispenseError(message);
    } finally {
      setDispenseBusy(false);
    }
  };

  const addToCart = (strain: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.strain.id === strain.id);
      if (existing) {
        return prev.map(item => 
          item.strain.id === strain.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { strain, quantity: 1 }];
    });
  };

  const removeFromCart = (strainId: string) => {
    setCart(prev => prev.filter(item => item.strain.id !== strainId));
  };

  const updateQuantity = (strainId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.strain.id === strainId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const addInventoryProduct = () => {
    const stockGrams = Math.max(0, Number(inventoryForm.stockGrams) || 0);
    if (!inventoryForm.name.trim() || !inventoryForm.batch.trim() || stockGrams <= 0) {
      return;
    }

    setDispensaryInventory(prev => [
      {
        id: `inv-${Date.now()}`,
        name: inventoryForm.name.trim(),
        type: inventoryForm.type.trim() || 'Producto medicinal',
        batch: inventoryForm.batch.trim(),
        stockGrams,
        thc: inventoryForm.thc.trim() || 'N/D',
        cbd: inventoryForm.cbd.trim() || 'N/D',
        lab: inventoryForm.lab.trim() || 'Pendiente QC',
        origin: inventoryForm.origin.trim() || 'Origen declarado',
        effect: 'Inventario operador',
        description: 'Producto cargado por el dispensario para validar contra receta antes de dispensar.',
      },
      ...prev,
    ]);
    setInventoryForm(prev => ({
      ...prev,
      batch: `TL-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
      stockGrams: 10,
    }));
  };

  const updateInventoryStock = (productId: string, delta: number) => {
    setDispensaryInventory(prev => prev.map(product => {
      if (product.id !== productId) {
        return product;
      }

      return {
        ...product,
        stockGrams: Math.max(0, Number(product.stockGrams ?? 0) + delta),
      };
    }));
  };

  const createPrivacyPermission = (kind: PrivacyPermissionKind, openQr = true) => {
    const isMedical = kind === 'medical-consultation';
    const actor = isMedical ? clinicalAccessDoctor : selectedDispensary?.name ?? 'Green Leaf Center';
    const permission: PrivacyPermission = {
      id: `perm-${kind}-${Date.now()}`,
      kind,
      actor,
      role: isMedical ? 'Medico' : 'Dispensario',
      scope: isMedical
        ? 'Ficha clinica, examenes autorizados y ventana de consulta'
        : 'Receta vigente, saldo disponible, formatos autorizados y retiros previos',
      expiresAt: isMedical ? '24h desde autorizacion' : '30 min desde emision del QR',
      status: 'active',
      hash: `hash:permit-${makeDemoHash(`${kind}-${actor}`).slice(0, 10)}`,
      qrToken: `TL-${kind === 'medical-consultation' ? 'MED' : 'RECETA'}-${makeDemoHash(`${actor}-${Date.now()}`).slice(0, 8).toUpperCase()}`,
      createdAt: 'Ahora',
    };

    setPrivacyPermissions((current) => [permission, ...current]);
    setRecentActivity((prev: any[]) => [
      {
        id: `act-permission-${Date.now()}`,
        action: isMedical
          ? `Permiso privado creado para ${actor}`
          : `QR de receta compartible creado para ${actor}`,
        date: 'Recién',
        icon: 'ShieldCheck',
      },
      ...prev,
    ]);

    if (openQr) {
      setSelectedQrPermission(permission);
    }

    return permission;
  };

  const revokePrivacyPermission = (permissionId: string) => {
    setPrivacyPermissions((current) => current.map((permission) => (
      permission.id === permissionId
        ? { ...permission, status: 'revoked' }
        : permission
    )));
  };

  const prepareRecordingDemo = () => {
    const consultationBlock: DoctorAgendaBlock = {
      id: `agenda-recording-${Date.now()}`,
      date: formatRelativeAgendaDate(currentNow, 0),
      time: '10:30',
      status: 'Reservado',
      patient: 'Paciente demo',
      reason: 'Consulta de grabacion: revisar ficha privada y emitir receta verificable',
    };
    const prescriptionId = Number(DEMO_PRESCRIPTION_ID);
    const medicalPermission = createPrivacyPermission('medical-consultation', false);
    const dispensaryPermission = createPrivacyPermission('dispensary-prescription', false);

    connectDemoPatientWallet();
    setDoctorAgendaBlocks((current) => [
      consultationBlock,
      ...current.filter((block) => block.id !== consultationBlock.id),
    ]);
    setSelectedConsultationId(consultationBlock.id);
    setConsultationStatusById((current) => ({
      ...current,
      [consultationBlock.id]: 'checked_in',
    }));
    setConsultationSummaryDraft(
      'Paciente llega a consulta, autoriza lectura temporal de ficha clinica, examenes y antecedentes relevantes. Se evalua tratamiento con cannabis medicinal y se prepara receta verificable.',
    );
    setDoctorIssueForm((current) => ({
      ...current,
      treatment: 'Cannabis medicinal para manejo de dolor cronico',
      dosage: '0.5g por via vaporizada cada 12 horas',
      notes: 'Consulta validada. Control clinico en 30 dias.',
      durationDays: 30,
      monthlyLimitGrams: DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
    }));
    setConsultationClinicalRecords((current) => [
      {
        id: `consultation-${consultationBlock.id}`,
        title: 'Consulta Paciente demo',
        status: 'Lista para receta',
        summary: 'Ficha autorizada por el paciente para que el medico revise sintomas, examenes y antecedentes antes de emitir receta.',
        details: [
          `Atencion realizada por ${clinicalAccessDoctor}`,
          `Fecha y hora: ${consultationBlock.date} - ${consultationBlock.time}`,
          'Permiso medico activo por 24h',
          'Diagnostico y documentos completos permanecen cifrados off-chain',
        ],
        proof: `hash:consult-demo-${makeDemoHash(consultationBlock.id).slice(0, 8)}`,
      },
      ...current.filter((record) => record.id !== `consultation-${consultationBlock.id}`),
    ]);
    setPatientDashboard(buildDemoPatientDashboard(DEMO_PATIENT_ADDRESS));
    setHasPrescription(true);
    setPrescriptionAllowance({
      monthlyLimitGrams: DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS,
      usedGrams: DEFAULT_PRESCRIPTION_USED_GRAMS,
    });
    setDispensePrescriptionId(String(prescriptionId));
    setPrescriptionValidation(buildDemoPrescriptionValidation(prescriptionId));
    setSelectedDispensary(null);
    setSelectedStrain(null);
    setCart([]);
    setDispensaryStep('inventory');
    setDispensaryValidation(dispensaryPermission);
    setSelectedQrPermission(null);
    setRecentActivity((current: any[]) => [
      {
        id: `act-recording-ready-${Date.now()}`,
        action: 'Flujo de grabacion preparado',
        date: 'Recien',
        icon: 'CheckCircle',
      },
      {
        id: `act-recording-permissions-${Date.now()}`,
        action: `Permisos listos: ${medicalPermission.actor} y ${dispensaryPermission.actor}`,
        date: 'Ahora',
        icon: 'ShieldCheck',
      },
      ...current,
    ]);
    localStorage.setItem('trust_latest_prescription_id', String(prescriptionId));
    localStorage.setItem('trust_dispense_prescription_id', String(prescriptionId));
    localStorage.setItem('trust_has_rx', 'true');
    switchView('overview');
  };

  const validatePatientQrForDoctor = () => {
    const consultationId = selectedConsultationId ?? reservedAgendaBlocks[0]?.id ?? null;
    if (consultationId && !selectedConsultationId) {
      setSelectedConsultationId(consultationId);
    }

    const permission = latestMedicalPermission ?? createPrivacyPermission('medical-consultation', false);
    setSelectedQrPermission(permission);
    setConsultationStatus('checked_in', consultationId);
  };

  const validatePrescriptionQrForDispensary = () => {
    const operator = buildOperatorDispensary();
    setSelectedDispensary(operator);
    setDispensaryStep('inventory');
    const permission = latestDispensaryPermission ?? createPrivacyPermission('dispensary-prescription', false);
    setDispensaryValidation(permission);
    setSelectedQrPermission(permission);
  };

  const validatePrescriptionOnTestnet = async () => {
    const prescriptionId = Number(dispensePrescriptionId.match(/\d+/)?.[0] ?? Number.NaN);

    if (!Number.isFinite(prescriptionId)) {
      setPrescriptionValidationError('Ingresa un numero de receta valido.');
      setPrescriptionValidation(null);
      return;
    }

    setPrescriptionValidationBusy(true);
    setPrescriptionValidationError(null);
    setPrescriptionValidation(null);

    try {
      const response = await fetch('/api/stellar/dispensary/validate-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prescriptionId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'No fue posible validar la receta en testnet.');
      }

      setPrescriptionValidation(payload);
      setPrescriptionAllowance((current: any) => ({
        ...current,
        monthlyLimitGrams: payload.prescription.totalQuantity || current.monthlyLimitGrams,
        usedGrams: payload.prescription.dispensedQuantity ?? current.usedGrams,
      }));
      setDoctorPatientAddress(payload.prescription.patient);
      setHasPrescription(payload.validation.canDispense);
      const permission = latestDispensaryPermission ?? createPrivacyPermission('dispensary-prescription', false);
      setDispensaryValidation(permission);
    } catch (error) {
      if (isDispensaryPortal || prescriptionId === Number(DEMO_PRESCRIPTION_ID)) {
        const demoValidation = buildDemoPrescriptionValidation(prescriptionId);
        setPrescriptionValidation(demoValidation);
        setPrescriptionAllowance((current: any) => ({
          ...current,
          monthlyLimitGrams: demoValidation.prescription.totalQuantity,
          usedGrams: demoValidation.prescription.dispensedQuantity,
        }));
        setDoctorPatientAddress(demoValidation.prescription.patient);
        setHasPrescription(true);
        const permission = latestDispensaryPermission ?? createPrivacyPermission('dispensary-prescription', false);
        setDispensaryValidation(permission);
        setPrescriptionValidationError(null);
        return;
      }

      setPrescriptionValidationError(
        error instanceof Error ? error.message : 'No fue posible validar la receta en testnet.',
      );
    } finally {
      setPrescriptionValidationBusy(false);
    }
  };

  const buildOperatorDispensary = () => ({
    id: 'dispensary-operator',
    name: 'Mi dispensario',
    address: 'Operacion autorizada',
    status: 'Abierto',
    stock: 'Operativo',
    inventory: dispensaryInventory,
  });

  const prepareInventoryDispense = (product: any) => {
    setSelectedDispensary({
      id: 'dispensary-operator',
      name: 'Mi dispensario',
      address: 'Operación autorizada',
      status: 'Abierto',
      stock: 'Operativo',
      inventory: dispensaryInventory,
    });
    setCart([{ strain: product, quantity: 1 }]);
    setSelectedStrain(product);
    setDispenseError(null);
    setDispenseSuccess(null);
    setDispensaryStep('confirm');
  };

  const openPickupTraceability = (pickup: any) => {
    const productName = pickup.strain?.name ?? 'Producto medicinal';
    const batch = pickup.strain?.batch ?? `batch-${productName}`;
    const productProof = makeDemoHash(`${productName}-${batch}-${pickup.quantity}`);

    setSelectedTraceRecord({
      title: productName,
      subtitle: `Receta ${pickup.token ?? 'validada'}`,
      quantity: `${pickup.quantity ?? 0}g`,
      date: 'Registrado hoy',
      ledger: pickup.recordId ?? pickup.token ?? 'local-demo',
      dispensary: pickup.dispensary?.name ?? 'Dispensario autorizado',
      batch,
      product: productProof,
      txHash: makeDemoHash(`${pickup.id}-${pickup.token ?? productProof}`),
    });
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity * 12500, 0); // Using mock price 12500
  }, [cart]);
  const cartGrams = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);
  const prescriptionMonthlyLimitGrams = Number(prescriptionAllowance.monthlyLimitGrams) || DEFAULT_PRESCRIPTION_MONTHLY_LIMIT_GRAMS;
  const prescriptionUsedGrams = Number(prescriptionAllowance.usedGrams) || 0;
  const prescriptionRemainingGrams = Math.max(0, prescriptionMonthlyLimitGrams - prescriptionUsedGrams);
  const prescriptionProjectedGrams = prescriptionUsedGrams + cartGrams;
  const prescriptionUsagePercent = Math.min(
    100,
    Math.round((prescriptionProjectedGrams / prescriptionMonthlyLimitGrams) * 100),
  );
  const cartExceedsPrescriptionLimit = cartGrams > prescriptionRemainingGrams;
  const previousPrescriptionPickups = activePickups.filter((pickup) => {
    const token = String(pickup.token ?? '');
    return token.includes(`RECETA-${resolvedPrescriptionId}`) || token.includes(`RX-${resolvedPrescriptionId}`) || token.includes(String(resolvedPrescriptionId));
  });
  const patientTraceablePickups = activePickups.filter((pickup) => pickup.status !== 'cancelled');

  const handleStartPickup = (pickup: any) => {
    setProcessingPickup(pickup);
    setPickupStep('scanning');
    
    setTimeout(() => {
      setPickupStep('verifying');
      
      setTimeout(() => {
        setPickupStep('success');
        setActivePickups(prev => prev.filter(p => p.id !== pickup.id));
        const finalActivity = { 
          id: `act-pick-${Date.now()}`,
          action: `Retiro exitoso: ${pickup.strain.name}`, 
          date: "Recién", 
          icon: "CheckCircle" 
        };
        setRecentActivity(prev => [finalActivity, ...prev]);
      }, 3500);
    }, 2500);
  };

  const resetBooking = () => {
    setBookingDoctor(null);
    setBookingStep('date');
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const resetDispensaryFlow = () => {
    setSelectedDispensary(null);
    setSelectedStrain(null);
    setDispensaryStep('inventory');
    setDispenseError(null);
    setDispenseSuccess(null);
    setCart([]); // Clear cart when leaving dispensary flow
  };

  useEffect(() => {
    if (isOpen) {
      setActiveView(isViewAllowed(initialView) ? initialView : allowedViews?.[0] ?? 'overview');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      resetBooking();
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, initialView, allowedViews]);

  useEffect(() => {
    if (!isViewAllowed(activeView)) {
      setActiveView(allowedViews?.[0] ?? 'overview');
    }
  }, [activeView, allowedViews]);

  const drawerMeta: Record<ActionDrawerKey, { eyebrow: string; title: string; description: string }> = {
    'doctor-agenda': {
      eyebrow: 'Agenda profesional',
      title: 'Gestionar disponibilidad',
      description: 'Crea bloques, revisa reservas y abre la consulta correcta cuando el paciente llegue.',
    },
    'doctor-consultation': {
      eyebrow: 'Consulta activa',
      title: selectedConsultationBlock ? selectedConsultationBlock.patient ?? 'Paciente en consulta' : 'Selecciona una consulta',
      description: 'Valida llegada por QR, inicia la atención y mantiene visible el estado de la sesión.',
    },
    'doctor-clinical-summary': {
      eyebrow: 'Ficha privada',
      title: 'Resumen clínico de consulta',
      description: 'Registra solo lo necesario para el tratamiento. La información clínica queda bajo control del paciente.',
    },
    'doctor-prescription': {
      eyebrow: 'Receta verificable',
      title: 'Preparar receta',
      description: 'Define tratamiento, dosis, vigencia y saldo autorizado antes de emitir la receta.',
    },
    'patient-account': {
      eyebrow: 'Cuenta Trust Leaf',
      title: 'Identidad y acceso',
      description: 'El paciente controla su cuenta, permisos y pruebas verificables desde un solo lugar.',
    },
    'patient-permissions': {
      eyebrow: 'Privacidad',
      title: 'Permisos activos',
      description: 'Revisa quién puede acceder a datos o recetas y revoca permisos cuando lo necesites.',
    },
    'patient-record': {
      eyebrow: 'Ficha clínica',
      title: 'Historial privado',
      description: 'Síntomas, exámenes y consultas se comparten solo con consentimiento temporal.',
    },
    'patient-prescription': {
      eyebrow: 'Receta',
      title: 'Receta verificable',
      description: 'Genera QR para dispensario y revisa saldo disponible sin exponer diagnóstico.',
    },
    'patient-traceability': {
      eyebrow: 'Medicina trazable',
      title: 'Retiros y lotes',
      description: 'Consulta entregas parciales, lote, cantidad y prueba pública de cada retiro.',
    },
    'dispensary-inventory': {
      eyebrow: 'Inventario',
      title: 'Productos y lotes',
      description: 'Carga productos, ajusta stock y prepara una entrega desde un lote trazable.',
    },
    'dispensary-qr': {
      eyebrow: 'Validación',
      title: 'Validar QR de receta',
      description: 'El dispensario ve vigencia, saldo, formatos y retiros previos, no ficha clínica.',
    },
    'dispensary-dispense': {
      eyebrow: 'Entrega parcial',
      title: 'Registrar retiro',
      description: 'Confirma producto, cantidad y receta para actualizar saldo y trazabilidad.',
    },
    'dispensary-traceability': {
      eyebrow: 'Trazabilidad',
      title: 'Entregas recientes',
      description: 'Revisa el historial operativo de lotes entregados y sus pruebas verificables.',
    },
  };

  const openDrawer = (drawer: ActionDrawerKey) => setActiveDrawer(drawer);

  const renderDrawerContent = () => {
    if (!activeDrawer) {
      return null;
    }

    switch (activeDrawer) {
      case 'doctor-agenda':
        return (
          <div className="space-y-5">
            <div className="rounded-3xl border border-brand-gold/20 bg-[#fbf7ef] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green-mid/45">Fecha actual</p>
              <p className="mt-2 text-lg font-bold leading-relaxed text-brand-green-deep">
                {formatLiveDate(currentNow)}
                <span className="block text-sm font-semibold text-brand-green-mid/60">Actualizado {formatLiveTime(currentNow)}</span>
              </p>
            </div>

            <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5">
              <h4 className="text-lg font-bold text-brand-green-deep">Nuevo bloque horario</h4>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Fecha</span>
                  <input
                    value={agendaForm.date}
                    onChange={(event) => setAgendaForm((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-xl bg-brand-neutral/60 px-3 py-3 text-sm font-bold text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Hora</span>
                  <input
                    value={agendaForm.time}
                    onChange={(event) => setAgendaForm((current) => ({ ...current, time: event.target.value }))}
                    className="w-full rounded-xl bg-brand-neutral/60 px-3 py-3 text-sm font-bold text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </label>
                <select
                  value={agendaForm.status}
                  onChange={(event) => setAgendaForm((current) => ({
                    ...current,
                    status: event.target.value as DoctorAgendaBlock['status'],
                  }))}
                  className="rounded-xl bg-brand-neutral/60 px-3 py-3 text-sm font-bold text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                >
                  <option value="Disponible">Disponible</option>
                  <option value="Reservado">Reservado</option>
                </select>
                <input
                  value={agendaForm.patient}
                  onChange={(event) => setAgendaForm((current) => ({ ...current, patient: event.target.value }))}
                  placeholder="Paciente si ya está reservado"
                  className="rounded-xl bg-brand-neutral/60 px-3 py-3 text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>
              <button
                type="button"
                onClick={handleAddAgendaBlock}
                className="mt-4 w-full rounded-xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
              >
                Guardar bloque horario
              </button>
            </div>

            <div className="space-y-3">
              {doctorAgendaBlocks.map((block) => (
                <div key={block.id} className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-brand-green-deep">{block.date} · {block.time}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-green-mid/45">
                        {block.status}{block.patient ? ` · ${block.patient}` : ''}
                      </p>
                      {block.reason && <p className="mt-1 text-xs text-brand-green-mid/60">{block.reason}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {block.status === 'Reservado' && (
                        <button
                          type="button"
                          onClick={() => {
                            openConsultationFromBlock(block);
                            setActiveDrawer('doctor-consultation');
                          }}
                          className="rounded-full bg-brand-green-deep px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-ivory"
                        >
                          Abrir consulta
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleAgendaBlockStatus(block.id)}
                        className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${
                          block.status === 'Disponible'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-brand-gold/15 text-brand-green-deep'
                        }`}
                      >
                        {block.status === 'Disponible' ? 'Reservar' : 'Liberar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'doctor-consultation':
        return (
          <div className="space-y-5">
            <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Estado</p>
              <p className="mt-2 text-2xl font-bold text-brand-green-deep">
                {!selectedConsultationBlock
                  ? 'Sin consulta seleccionada'
                  : selectedConsultationStatus === 'active'
                    ? 'En consulta'
                    : selectedConsultationStatus === 'completed'
                      ? 'Finalizada'
                      : selectedConsultationStatus === 'checked_in'
                        ? 'Paciente validado'
                        : 'Agendada'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
                {selectedConsultationBlock
                  ? `${selectedConsultationBlock.date} · ${selectedConsultationBlock.time} · ${selectedConsultationBlock.reason ?? 'Consulta médica'}`
                  : 'Abre una reserva desde agenda para comenzar.'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={validatePatientQrForDoctor}
                disabled={!selectedConsultationBlock || selectedConsultationStatus !== 'scheduled'}
                className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-left transition-colors hover:bg-blue-100 disabled:opacity-45"
              >
                <ShieldCheck size={20} className="mb-3 text-blue-700" />
                <p className="font-bold text-brand-green-deep">Validar QR de llegada</p>
                <p className="mt-2 text-xs leading-relaxed text-brand-green-mid/65">Confirma identidad, permiso temporal y wallet del paciente.</p>
              </button>
              <button
                type="button"
                onClick={() => setConsultationStatus('active')}
                disabled={!selectedConsultationBlock || selectedConsultationStatus !== 'checked_in'}
                className="rounded-2xl bg-brand-green-deep p-5 text-left text-brand-ivory transition-colors hover:bg-brand-green-mid disabled:opacity-45"
              >
                <Activity size={20} className="mb-3 text-brand-gold" />
                <p className="font-bold">Iniciar consulta</p>
                <p className="mt-2 text-xs leading-relaxed text-brand-ivory/65">Abre la sesión clínica y habilita resumen/receta.</p>
              </button>
            </div>

            {latestMedicalPermission && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/60">Permiso activo</p>
                <p className="mt-2 font-mono text-xs text-blue-700">{latestMedicalPermission.qrToken}</p>
                <button
                  type="button"
                  onClick={() => setSelectedQrPermission(latestMedicalPermission)}
                  className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-700"
                >
                  Ver permiso privado
                </button>
              </div>
            )}
          </div>
        );

      case 'doctor-clinical-summary':
        return (
          <div className="space-y-5">
            <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-lg font-bold text-brand-green-deep">Resumen para ficha del paciente</h4>
                  <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
                    Se guarda como registro privado. La capa verificable usa hashes y permisos, no notas clínicas abiertas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClinicalRecord(
                    selectedConsultationBlock
                      ? consultationClinicalRecords.find((record) => record.id === `consultation-${selectedConsultationBlock.id}`) ?? portableClinicalDossier[0]
                      : portableClinicalDossier[0],
                  )}
                  className="rounded-xl border border-brand-green-deep/10 px-4 py-2 text-xs font-bold text-brand-green-deep"
                >
                  Ver ficha
                </button>
              </div>
              <textarea
                value={consultationSummaryDraft}
                onChange={(event) => setConsultationSummaryDraft(event.target.value)}
                rows={7}
                className="mt-4 w-full resize-none rounded-2xl bg-brand-neutral/70 px-4 py-3 text-sm leading-relaxed text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => saveConsultationSummaryToRecord()}
                  disabled={!selectedConsultationBlock}
                  className="rounded-xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid disabled:opacity-45"
                >
                  Guardar en ficha clínica
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConsultationStatus('completed');
                    setActiveDrawer('doctor-prescription');
                  }}
                  disabled={!selectedConsultationBlock || selectedConsultationStatus !== 'active'}
                  className="rounded-xl border border-brand-gold/30 bg-[#fbf7ef] px-4 py-3 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-gold/10 disabled:opacity-45"
                >
                  Cerrar y preparar receta
                </button>
              </div>
            </div>
          </div>
        );

      case 'doctor-prescription':
        return (
          <div className="space-y-5">
            <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Paciente destino</p>
              <p className="mt-2 break-all font-mono text-sm font-bold text-brand-green-deep">
                {prescriptionPatientAddress || doctorPatientAddress}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-brand-neutral/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Tratamiento</p>
                  <p className="mt-1 text-sm font-bold text-brand-green-deep">{doctorIssueForm.treatment}</p>
                </div>
                <div className="rounded-2xl bg-brand-neutral/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Límite mensual</p>
                  <p className="mt-1 text-sm font-bold text-brand-green-deep">{doctorIssueForm.monthlyLimitGrams}g</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPrescriptionToolOpen(true);
                  setActiveDrawer(null);
                }}
                className="mt-5 w-full rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
              >
                Abrir editor de receta
              </button>
            </div>
          </div>
        );

      case 'patient-account':
        return (
          <div className="space-y-5">
            <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Cuenta Stellar del paciente</p>
              <p className="mt-2 break-all font-mono text-sm font-bold text-brand-green-deep">{patientTrustAccountAddress}</p>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {trustAccountMetrics.map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-brand-neutral/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                    <p className="mt-1 text-xl font-bold text-brand-green-deep">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'patient-permissions':
        return (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => createPrivacyPermission('medical-consultation')}
              className="w-full rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory"
            >
              Compartir historial con médico
            </button>
            <button
              type="button"
              onClick={() => createPrivacyPermission('dispensary-prescription')}
              className="w-full rounded-2xl border border-brand-gold/30 bg-[#fbf7ef] px-5 py-4 text-sm font-bold text-brand-green-deep"
            >
              Compartir receta con dispensario
            </button>
            {privacyPermissions.length ? privacyPermissions.map((permission) => (
              <div key={permission.id} className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-brand-green-deep">{permission.actor}</p>
                    <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/65">{permission.scope}</p>
                    <p className="mt-2 font-mono text-[10px] text-brand-green-mid/55">{permission.hash}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                    permission.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-brand-neutral text-brand-green-mid/55'
                  }`}>
                    {permission.status === 'active' ? 'Activo' : 'Revocado'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelectedQrPermission(permission)} className="rounded-xl border border-brand-green-deep/10 px-4 py-2 text-xs font-bold text-brand-green-deep">Ver QR</button>
                  {permission.status === 'active' && (
                    <button type="button" onClick={() => revokePrivacyPermission(permission.id)} className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">Revocar</button>
                  )}
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/30 p-5 text-sm text-brand-green-mid/65">
                Aún no hay permisos activos. El paciente decide cuándo compartir su ficha o receta.
              </div>
            )}
          </div>
        );

      case 'patient-record':
        return (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowClinicalGallery(true)}
              className="w-full rounded-2xl border border-brand-green-deep/10 bg-white px-5 py-4 text-sm font-bold text-brand-green-deep"
            >
              Ver galería de exámenes
            </button>
            {[...portableClinicalDossier, ...consultationClinicalRecords].map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedClinicalRecord(record)}
                className="w-full rounded-2xl border border-brand-green-deep/10 bg-white p-4 text-left transition-colors hover:border-brand-gold/40"
              >
                <p className="text-sm font-bold text-brand-green-deep">{record.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/65">{record.summary}</p>
                <p className="mt-2 font-mono text-[10px] text-brand-green-mid/45">{record.proof}</p>
              </button>
            ))}
          </div>
        );

      case 'patient-prescription':
        return (
          <div className="space-y-4">
            <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5">
              <h4 className="text-lg font-bold text-brand-green-deep">Receta activa</h4>
              <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
                Saldo disponible: {prescriptionRemainingGrams}g de {prescriptionMonthlyLimitGrams}g autorizados.
              </p>
              <button
                type="button"
                onClick={() => createPrivacyPermission('dispensary-prescription')}
                className="mt-4 w-full rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory"
              >
                Generar QR para dispensario
              </button>
            </div>
            {(patientDashboard?.prescriptions ?? []).map((prescription) => (
              <button key={prescription.id} type="button" onClick={() => openOnchainPrescription(prescription)} className="w-full rounded-2xl border border-brand-green-deep/10 bg-white p-4 text-left">
                <p className="text-sm font-bold text-brand-green-deep">Receta #{prescription.id}</p>
                <p className="mt-1 text-xs text-brand-green-mid/65">{prescription.status} · {formatPortalDate(prescription.issuedAt)}</p>
              </button>
            ))}
          </div>
        );

      case 'patient-traceability':
      case 'dispensary-traceability':
        return (
          <div className="space-y-4">
            {activePickups.length ? activePickups.map((pickup) => (
              <div key={pickup.id} className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-brand-green-deep">{pickup.strain?.name ?? 'Producto medicinal'}</p>
                    <p className="mt-1 text-xs text-brand-green-mid/65">{pickup.quantity}g · {pickup.dispensary?.name ?? 'Dispensario autorizado'}</p>
                  </div>
                  <button type="button" onClick={() => openPickupTraceability(pickup)} className="rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory">
                    Ver trazabilidad
                  </button>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/30 p-5 text-sm text-brand-green-mid/65">
                Las entregas aparecerán aquí con lote, cantidad y prueba verificable.
              </div>
            )}
          </div>
        );

      case 'dispensary-inventory':
        return (
          <div className="space-y-5">
            <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5">
              <h4 className="text-lg font-bold text-brand-green-deep">Cargar producto trazable</h4>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={inventoryForm.name} onChange={(event) => setInventoryForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Nombre del producto" className="rounded-xl bg-brand-neutral px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                <input value={inventoryForm.type} onChange={(event) => setInventoryForm(prev => ({ ...prev, type: event.target.value }))} placeholder="Formato" className="rounded-xl bg-brand-neutral px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                <input value={inventoryForm.batch} onChange={(event) => setInventoryForm(prev => ({ ...prev, batch: event.target.value }))} placeholder="Lote" className="rounded-xl bg-brand-neutral px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                <input type="number" min="1" value={inventoryForm.stockGrams} onChange={(event) => setInventoryForm(prev => ({ ...prev, stockGrams: Number(event.target.value) }))} placeholder="Gramos" className="rounded-xl bg-brand-neutral px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                <input value={inventoryForm.thc} onChange={(event) => setInventoryForm(prev => ({ ...prev, thc: event.target.value }))} placeholder="THC" className="rounded-xl bg-brand-neutral px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                <input value={inventoryForm.cbd} onChange={(event) => setInventoryForm(prev => ({ ...prev, cbd: event.target.value }))} placeholder="CBD" className="rounded-xl bg-brand-neutral px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                <input value={inventoryForm.lab} onChange={(event) => setInventoryForm(prev => ({ ...prev, lab: event.target.value }))} placeholder="Laboratorio / QC" className="rounded-xl bg-brand-neutral px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                <input value={inventoryForm.origin} onChange={(event) => setInventoryForm(prev => ({ ...prev, origin: event.target.value }))} placeholder="Origen" className="rounded-xl bg-brand-neutral px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
              </div>
              <button type="button" onClick={addInventoryProduct} className="mt-4 w-full rounded-xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory">
                Agregar al inventario
              </button>
            </div>
            {dispensaryInventory.map((product) => (
              <div key={product.id} className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-brand-green-deep">{product.name}</p>
                    <p className="mt-1 text-xs text-brand-green-mid/65">{product.batch} · {product.stockGrams}g · THC {product.thc} / CBD {product.cbd}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateInventoryStock(product.id, -1)} className="h-10 w-10 rounded-xl border border-brand-green-deep/10"><Minus size={14} className="mx-auto" /></button>
                    <button type="button" onClick={() => updateInventoryStock(product.id, 1)} className="h-10 w-10 rounded-xl border border-brand-green-deep/10"><Plus size={14} className="mx-auto" /></button>
                    <button type="button" onClick={() => {
                      prepareInventoryDispense(product);
                      setActiveDrawer('dispensary-dispense');
                    }} className="rounded-xl bg-brand-green-deep px-4 py-2 text-xs font-bold text-brand-ivory">
                      Preparar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'dispensary-qr':
        return (
          <div className="space-y-5">
            <button
              type="button"
              onClick={validatePrescriptionOnTestnet}
              disabled={prescriptionValidationBusy}
              className="w-full rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory disabled:opacity-50"
            >
              {prescriptionValidationBusy ? 'Validando receta...' : 'Validar receta en Testnet'}
            </button>
            <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Receta detectada</p>
              <p className="mt-2 text-2xl font-bold text-brand-green-deep">Receta #{resolvedPrescriptionId}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-brand-neutral/60 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Disponible</p><p className="mt-1 font-bold text-brand-green-deep">{prescriptionValidation?.prescription.remainingQuantity ?? prescriptionRemainingGrams}g</p></div>
                <div className="rounded-2xl bg-brand-neutral/60 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Formatos</p><p className="mt-1 font-bold text-brand-green-deep">Flores, aceites, extractos</p></div>
              </div>
              {prescriptionValidation && (
                <div className={`mt-4 rounded-2xl border p-3 text-xs ${
                  prescriptionValidation.validation.canDispense
                    ? 'border-green-100 bg-green-50 text-green-700'
                    : 'border-amber-100 bg-amber-50 text-amber-800'
                }`}>
                  {prescriptionValidation.validation.reason}
                </div>
              )}
              {prescriptionValidationError && (
                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                  {prescriptionValidationError}
                </div>
              )}
              {dispensaryValidation && (
                <button type="button" onClick={() => setSelectedQrPermission(dispensaryValidation)} className="mt-4 w-full rounded-xl border border-brand-green-deep/10 px-4 py-3 text-sm font-bold text-brand-green-deep">
                  Ver permiso QR
                </button>
              )}
            </div>
          </div>
        );

      case 'dispensary-dispense':
        return (
          <div className="space-y-5">
            {cart.length ? (
              cart.map((item) => (
                <div key={item.strain.id} className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-brand-green-deep">{item.strain.name}</p>
                      <p className="text-xs text-brand-green-mid/65">{item.strain.batch ?? item.strain.type}</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-brand-neutral px-3 py-2">
                      <button type="button" onClick={() => updateQuantity(item.strain.id, -1)}><Minus size={14} /></button>
                      <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.strain.id, 1)}><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-brand-green-deep/15 bg-brand-neutral/30 p-5 text-sm text-brand-green-mid/65">
                Selecciona un producto desde inventario para preparar la entrega.
              </div>
            )}
            <div className="rounded-3xl border border-brand-green-deep/10 bg-[#fbf7ef] p-5">
              <div className="flex justify-between border-b border-brand-green-deep/10 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-green-mid/60">Este retiro</span>
                <span className="font-bold text-brand-green-deep">{cartGrams}g</span>
              </div>
              <div className="mt-3 flex justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-green-mid/60">Disponible antes de retirar</span>
                <span className="font-bold text-brand-green-deep">{prescriptionRemainingGrams}g</span>
              </div>
              <button
                type="button"
                onClick={handleCompleteOnchainDispense}
                disabled={dispenseBusy || cartExceedsPrescriptionLimit || !cart.length || !Number.isFinite(resolvedPrescriptionId)}
                className="mt-5 w-full rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory disabled:opacity-45"
              >
                {dispenseBusy ? 'Registrando...' : 'Validar cupo y registrar retiro'}
              </button>
              {dispenseError && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">{dispenseError}</div>}
              {dispenseSuccess && <div className="mt-3 rounded-xl border border-green-100 bg-green-50 p-3 text-xs text-green-700">{dispenseSuccess}</div>}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="portal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-[100] flex items-center justify-center ${pageMode ? 'bg-brand-ivory' : 'bg-brand-green-deep/60 backdrop-blur-sm'}`}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`bg-brand-ivory w-full h-full overflow-hidden flex flex-col md:flex-row relative ${pageMode ? 'max-w-none rounded-none shadow-none md:h-full' : 'max-w-5xl md:h-[85vh] rounded-none md:rounded-[32px] shadow-2xl'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar Mockup (Desktop) / Bottom Nav (Mobile) */}
            <div className="hidden md:flex w-64 bg-brand-green-deep p-6 text-brand-ivory flex-col gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-brand-gold rounded-lg" />
                <span className="font-bold">{roleLabel}</span>
              </div>
              
              <nav className="flex flex-col gap-2">
                {isViewAllowed('overview') && (
                <button 
                  onClick={() => switchView('overview')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'overview' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <Activity size={18} /> {t.portal.navResume}
                </button>
                )}
                {isViewAllowed('profile') && (
                <button
                  onClick={() => switchView('profile')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'profile' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <ShieldCheck size={18} /> Mi Cuenta
                </button>
                )}
                {isViewAllowed('doctors') && (
                <button 
                  onClick={() => switchView('doctors')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'doctors' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <Stethoscope size={18} /> {isDoctorPortal ? 'Panel médico' : t.portal.navDoctors}
                </button>
                )}
                {isViewAllowed('dispensaries') && (
                <button 
                  onClick={() => switchView('dispensaries')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'dispensaries' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <ShoppingBag size={18} /> {isDispensaryPortal ? 'Operación' : t.portal.navDispensaries}
                </button>
                )}
                {isViewAllowed('prescriptions') && (
                <button 
                  onClick={() => switchView('prescriptions')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'prescriptions' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <FileText size={18} /> {t.portal.navPrescriptions}
                </button>
                )}
                {isViewAllowed('pickups') && (
                <button 
                  onClick={() => switchView('pickups')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'pickups' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <Package size={18} /> {t.portal.navPickups}
                </button>
                )}
                {isViewAllowed('history') && (
                <button 
                  onClick={() => switchView('history')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'history' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <Database size={18} /> {t.portal.navHistory}
                </button>
                )}
                {isViewAllowed('traveler') && (
                <button 
                  onClick={() => switchView('traveler')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'traveler' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <Globe size={18} /> {t.portal.navTraveler}
                </button>
                )}
              </nav>
              
              {!isDoctorPortal && !isDispensaryPortal ? (
                <button
                  type="button"
                  onClick={() => setCannabisMarketOpen(true)}
                  className="mt-auto rounded-2xl border border-brand-gold/20 bg-brand-gold/20 p-4 text-left transition-all hover:bg-brand-gold/25 active:scale-95"
                >
                  <p className="text-[10px] uppercase font-bold tracking-wider text-brand-gold mb-1">Ecosistema cannabis</p>
                  <p className="text-sm font-medium">Ropa, calzado y productos de cañamo</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                    Ver negocios <ArrowRight size={12} />
                  </span>
                </button>
              ) : (
                <div className="mt-auto p-4 bg-brand-gold/20 rounded-2xl border border-brand-gold/20">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-brand-gold mb-1">Estado operativo</p>
                  <p className="text-sm font-medium">Validado hasta Dic 2026</p>
                </div>
              )}
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-2 left-4 right-4 bg-[#fbf7ef]/95 backdrop-blur-xl min-h-16 flex justify-around items-center z-[110] border border-brand-green-deep/10 rounded-[24px] pb-safe shadow-[0_16px_44px_rgba(26,59,50,0.16)]">
              {isViewAllowed('overview') && (
              <button 
                onClick={() => switchView('overview')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all ${activeView === 'overview' ? 'bg-white text-brand-green-deep shadow-sm' : 'text-brand-green-mid/45'}`}
              >
                <Activity size={20} className={activeView === 'overview' ? 'scale-110' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{t.portal.navHome}</span>
              </button>
              )}
              {isViewAllowed('profile') && (
              <button
                onClick={() => switchView('profile')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all ${activeView === 'profile' ? 'bg-white text-brand-green-deep shadow-sm' : 'text-brand-green-mid/45'}`}
              >
                <ShieldCheck size={20} className={activeView === 'profile' ? 'scale-110' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Cuenta</span>
              </button>
              )}
              {isViewAllowed('prescriptions') && (
              <button 
                onClick={() => switchView('prescriptions')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all ${activeView === 'prescriptions' ? 'bg-white text-brand-green-deep shadow-sm' : 'text-brand-green-mid/45'}`}
              >
                <Activity size={20} className={activeView === 'prescriptions' ? 'scale-110' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{t.portal.navHealth}</span>
              </button>
              )}
              {isViewAllowed('doctors') && (
              <button 
                onClick={() => switchView('doctors')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all ${activeView === 'doctors' ? 'bg-white text-brand-green-deep shadow-sm' : 'text-brand-green-mid/45'}`}
              >
                <Stethoscope size={20} className={activeView === 'doctors' ? 'scale-110' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{isDoctorPortal ? 'Receta' : t.portal.navDoctors}</span>
              </button>
              )}
              {isViewAllowed('dispensaries') && (
              <button 
                onClick={() => switchView('dispensaries')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all ${activeView === 'dispensaries' ? 'bg-white text-brand-green-deep shadow-sm' : 'text-brand-green-mid/45'}`}
              >
                <ShoppingBag size={20} className={activeView === 'dispensaries' ? 'scale-110' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{isDispensaryPortal ? 'Operar' : t.portal.navStore}</span>
              </button>
              )}
              {isViewAllowed('pickups') && (
              <button 
                onClick={() => switchView('pickups')}
                className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeView === 'pickups' ? 'bg-white text-brand-green-deep shadow-sm' : 'text-brand-green-mid/45'}`}
              >
                <Package size={20} />
                <span className="text-[10px] font-bold">{t.portal.navPickups}</span>
              </button>
              )}
              {isViewAllowed('history') && (
              <button 
                onClick={() => switchView('history')}
                className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeView === 'history' ? 'bg-white text-brand-green-deep shadow-sm' : 'text-brand-green-mid/45'}`}
              >
                <Database size={20} />
                <span className="text-[10px] font-bold">{t.portal.navRecord}</span>
              </button>
              )}
              {isViewAllowed('traveler') && (
              <button 
                onClick={() => switchView('traveler')}
                className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeView === 'traveler' ? 'bg-white text-brand-green-deep shadow-sm' : 'text-brand-green-mid/45'}`}
              >
                <Globe size={20} />
                <span className="text-[10px] font-bold">{t.portal.navTraveler}</span>
              </button>
              )}
            </div>

            {/* Content Mockup */}
            <div className="flex-1 overflow-y-auto bg-white mb-[80px] md:mb-0">
              <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 px-6 md:px-8 py-4 md:py-6 border-b border-brand-green-deep/5 flex justify-between items-center">
                <h3 className="text-xl md:text-2xl font-serif text-brand-green-deep">
                  {activeView === 'overview' && t.portal.viewWelcome}
                  {activeView === 'doctors' && (isDoctorPortal ? 'Panel médico' : t.portal.viewDoctors)}
                  {activeView === 'dispensaries' && (isDispensaryPortal ? 'Operación dispensario' : t.portal.viewDispensaries)}
                  {activeView === 'prescriptions' && t.portal.viewPrescriptions}
                  {activeView === 'pickups' && t.portal.navPickups}
                  {activeView === 'history' && t.portal.viewHistory}
                  {activeView === 'traveler' && t.portal.viewTraveler}
                  {activeView === 'profile' && 'Mi Cuenta Trust Leaf'}
                </h3>
                <button onClick={onClose} className="p-3 md:p-2 -mr-2 md:mr-0 hover:bg-brand-neutral rounded-full transition-colors">
                  <X size={24} className="md:w-5 md:h-5 w-6 h-6" />
                </button>
              </div>

              <div className="p-6 md:p-8">
                <AnimatePresence mode="wait" key="portal-content-transitions">
                  {activeView === 'overview' && (
                    <motion.div 
                      key="view-overview"
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">{t.portal.panelControl}</p>
                          <h3 className="text-3xl md:text-4xl font-serif text-brand-green-deep">{t.portal.viewWelcome}</h3>
                        </div>
                        {!isDoctorPortal && !isDispensaryPortal && (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={prepareRecordingDemo}
                              className="rounded-2xl bg-brand-green-deep px-4 py-3 text-xs font-bold text-brand-ivory shadow-sm transition-colors hover:bg-brand-green-mid"
                            >
                              Preparar demo
                            </button>
                            <button
                              type="button"
                              onClick={resetDemoState}
                              className="rounded-2xl border border-brand-green-deep/10 bg-white px-4 py-3 text-xs font-bold text-brand-green-deep shadow-sm transition-colors hover:bg-brand-neutral"
                            >
                              Reiniciar flujo
                            </button>
                          </div>
                        )}
                      </div>

                      {!walletConnected && (
                        <div className="rounded-[32px] border border-brand-green-deep/10 bg-[#fbf7ef] p-5 md:p-6">
                          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Guia de grabacion</p>
                              <h4 className="mt-1 text-2xl font-serif text-brand-green-deep">Flujo paciente - medico - dispensario</h4>
                              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-green-mid/65">
                                Primero entra como paciente de prueba. Luego agenda, comparte permiso, recibe receta, genera QR y valida retiro parcial en dispensario.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={prepareRecordingDemo}
                              className="rounded-2xl bg-brand-green-deep px-4 py-3 text-xs font-bold text-brand-ivory"
                            >
                              Preparar demo completa
                            </button>
                          </div>
                          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                            {recordingFlowSteps.map(([label, done, description], index) => (
                              <div
                                key={label}
                                className={`rounded-2xl border p-4 ${
                                  done
                                    ? 'border-green-100 bg-green-50'
                                    : 'border-brand-green-deep/10 bg-white'
                                }`}
                              >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green-deep text-xs font-bold text-brand-ivory">
                                    {index + 1}
                                  </span>
                                  <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${
                                    done ? 'bg-white text-green-700' : 'bg-brand-neutral text-brand-green-mid/55'
                                  }`}>
                                    {done ? 'Listo' : 'Pendiente'}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-brand-green-deep">{label}</p>
                                <p className="mt-2 text-[11px] leading-relaxed text-brand-green-mid/60">{description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!walletConnected && (
                        <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          {[
                            ['1', 'Crear identidad', 'Passkey, Freighter o acceso Testnet de prueba.'],
                            ['2', 'Recibir receta', 'El médico emite una receta on-chain a tu wallet.'],
                            ['3', 'Retirar medicina', 'El dispensario valida la receta desde su propia URL.'],
                          ].map(([step, title, desc]) => (
                            <div key={step} className="rounded-2xl border border-brand-green-deep/10 bg-white p-4 shadow-sm">
                              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green-deep text-xs font-bold text-brand-ivory">
                                {step}
                              </div>
                              <h4 className="text-sm font-bold text-brand-green-deep">{title}</h4>
                              <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/60">{desc}</p>
                            </div>
                          ))}
                        </div>
                        <WalletOnboarding
                          title={t.portal.onboarding.title}
                          eyebrow={t.portal.onboarding.eyebrow}
                          description={t.portal.onboarding.desc}
                          primaryMethod={walletSetup.primaryMethod}
                          hasFreighterBackup={walletSetup.hasFreighterBackup}
                          walletLabel={walletSetup.walletLabel}
                          contractAccount={shortenAddress(walletSetup.contractAccount, 6)}
                          passkeyTitle={t.portal.onboarding.passkeyTitle}
                          passkeyDescription={t.portal.onboarding.passkeyDesc}
                          passkeyAction={t.portal.onboarding.passkeyAction}
                          freighterTitle={t.portal.onboarding.freighterTitle}
                          freighterDescription={t.portal.onboarding.freighterDesc}
                          freighterAction={t.portal.onboarding.freighterAction}
                          demoTitle="Entrar con cuenta de prueba"
                          demoDescription="Usa una identidad Testnet preconfigurada para probar el flujo completo aunque Passkey o Freighter fallen."
                          demoAction="Usar cuenta Testnet"
                          linkedLabel={t.portal.onboarding.linked}
                          backupTitle={t.portal.onboarding.backupTitle}
                          backupDescription={t.portal.onboarding.backupDesc}
                          backupAction={t.portal.onboarding.backupAction}
                          statusTitle={t.portal.onboarding.statusTitle}
                          statusPrimary={t.portal.onboarding.statusPrimary}
                          statusBackup={t.portal.onboarding.statusBackup}
                          statusAccount={t.portal.onboarding.statusAccount}
                          statusNetwork="Red"
                          networkValue={walletSetup.networkLabel ?? stellarConfig.networkLabel}
                          primaryPasskeyValue={t.portal.onboarding.primaryPasskeyValue}
                          primaryFreighterValue={t.portal.onboarding.primaryFreighterValue}
                          primaryDemoValue="Cuenta Testnet"
                          primaryEmptyValue={t.portal.onboarding.primaryEmptyValue}
                          backupConnectedValue={t.portal.onboarding.backupConnectedValue}
                          backupEmptyValue={t.portal.onboarding.backupEmptyValue}
                          continueAction={t.portal.onboarding.continueAction}
                          statusHint={passkeyAvailability.available ? walletHint : passkeyAvailability.reason}
                          statusError={walletError}
                          passkeyBusy={walletBusy === 'passkey'}
                          freighterBusy={walletBusy === 'freighter'}
                          backupBusy={walletBusy === 'backup'}
                          onConnectPasskey={connectPasskeyWallet}
                          onConnectFreighter={connectFreighterWallet}
                          onConnectDemo={connectDemoPatientWallet}
                          onLinkFreighterBackup={linkFreighterBackup}
                          onContinue={() => switchView('doctors')}
                        />
                        </div>
                      )}

                      {walletConnected && (
                        <>
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-brand-green-deep rounded-[40px] p-8 md:p-10 text-brand-ivory relative overflow-hidden shadow-2xl group border border-brand-gold/20"
                      >
                        <div className="relative z-10 max-w-lg">
                           <div className="flex items-center gap-2 mb-4">
                              <span className="w-8 h-[1px] bg-brand-gold"></span>
                               <span className="text-xs font-bold text-brand-gold uppercase tracking-[0.2em]">{t.portal.onboarding.connectedEyebrow}</span>
                           </div>
                           <h4 className="text-3xl md:text-5xl font-serif mb-6 leading-tight">{t.portal.healthStart}</h4>
                           <p className="text-brand-ivory/60 text-sm md:text-base leading-relaxed mb-8">
                              Inicie su protocolo de tratamiento verificado. Conectamos su necesidad médica con una red de trazabilidad absoluta para garantizar un consumo seguro y responsable.
                           </p>
                           <div className="flex flex-col gap-3 sm:flex-row">
                             <button 
                               onClick={() => switchView(primaryPrescription ? 'prescriptions' : 'doctors')}
                               className="flex items-center justify-center gap-3 px-6 py-4 bg-brand-gold text-brand-green-deep rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-gold/20 group/btn"
                             >
                                 {primaryPrescription ? 'Ver receta activa' : t.portal.onboarding.startCareAction}
                                 <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                             </button>
                             <button
                               onClick={() => switchView('dispensaries')}
                               className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-bold text-brand-ivory transition-colors hover:bg-white/10"
                             >
                               Buscar dispensario
                             </button>
                           </div>
                        </div>

                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity">
                           <Activity size={400} className="absolute -right-20 -top-20 rotate-12" />
                        </div>
                      </motion.div>

                      <div className="rounded-[32px] border border-brand-green-deep/10 bg-[#fbf7ef] p-5 md:p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Guia de grabacion</p>
                            <h4 className="mt-1 text-2xl font-serif text-brand-green-deep">Flujo paciente - medico - dispensario</h4>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-green-mid/65">
                              Usa esta barra como checklist de grabacion. Cada paso se activa con datos locales y deja claro que el paciente controla permisos y QR.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={prepareRecordingDemo}
                              className="rounded-2xl border border-brand-green-deep/10 bg-white px-4 py-3 text-xs font-bold text-brand-green-deep"
                            >
                              Preparar demo
                            </button>
                            <button
                              type="button"
                              onClick={() => switchView('history')}
                              className="rounded-2xl bg-brand-green-deep px-4 py-3 text-xs font-bold text-brand-ivory"
                            >
                              Ver historial
                            </button>
                          </div>
                        </div>
                        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                          {recordingFlowSteps.map(([label, done, description], index) => (
                            <div
                              key={label}
                              className={`rounded-2xl border p-4 ${
                                done
                                  ? 'border-green-100 bg-green-50'
                                  : 'border-brand-green-deep/10 bg-white'
                              }`}
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green-deep text-xs font-bold text-brand-ivory">
                                  {index + 1}
                                </span>
                                <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${
                                  done ? 'bg-white text-green-700' : 'bg-brand-neutral text-brand-green-mid/55'
                                }`}>
                                  {done ? 'Listo' : 'Pendiente'}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-brand-green-deep">{label}</p>
                              <p className="mt-2 text-[11px] leading-relaxed text-brand-green-mid/60">{description}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                          {[
                            ['Médico', '/medico/operacion', 'Validar llegada, ficha y receta'],
                            ['Dispensario', '/dispensario/operacion', 'Validar QR y retiro parcial'],
                            ['Recetas', '/paciente/recetas', 'Ver saldo y compartir QR'],
                            ['Trazabilidad', '/paciente/historial', 'Ver permisos y retiros'],
                          ].map(([label, href, description]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => window.location.assign(href)}
                              className="group rounded-2xl border border-brand-green-deep/10 bg-white p-4 text-left transition-colors hover:border-brand-gold/40 hover:bg-brand-neutral/50"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-brand-green-deep">{label}</p>
                                <ArrowRight size={16} className="text-brand-gold transition-transform group-hover:translate-x-1" />
                              </div>
                              <p className="mt-2 text-[11px] leading-relaxed text-brand-green-mid/60">{description}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[32px] border border-brand-green-deep/10 bg-white p-5 shadow-sm md:p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Estado Testnet</p>
                            <h4 className="mt-1 text-2xl font-serif text-brand-green-deep">Estado operativo para SCRUM</h4>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-green-mid/65">
                              Este bloque lee `/api/stellar/readiness` y separa lo listo para grabacion de lo pendiente para piloto.
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                            runtimeReadiness ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {runtimeReadiness ? runtimeReadiness.network : 'Readiness pendiente'}
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {mvpOperationalChecks.map(([label, done, description]) => (
                            <div
                              key={label}
                              className={`rounded-2xl border p-4 ${
                                done
                                  ? 'border-green-100 bg-green-50'
                                  : 'border-amber-100 bg-amber-50'
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-brand-green-deep">{label}</p>
                                <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${
                                  done ? 'bg-white text-green-700' : 'bg-white text-amber-700'
                                }`}>
                                  {done ? 'Listo' : 'Pendiente'}
                                </span>
                              </div>
                              <p className="text-[11px] leading-relaxed text-brand-green-mid/65">{description}</p>
                            </div>
                          ))}
                        </div>

                        {runtimeReadiness && (
                          <div className="mt-5 grid grid-cols-1 gap-2 text-[10px] font-mono text-brand-green-mid/70 md:grid-cols-2">
                            {[
                              ['DoctorRegistry', runtimeReadiness.contracts.registryContractId],
                              ['DispensaryRegistry', runtimeReadiness.contracts.dispensaryRegistryContractId],
                              ['Prescription', runtimeReadiness.contracts.prescriptionContractId],
                              ['DispenseRecord', runtimeReadiness.contracts.dispenseRecordContractId],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-xl border border-brand-green-deep/5 bg-brand-neutral/40 px-3 py-2">
                                <span className="font-bold text-brand-green-deep">{label}: </span>{shortenAddress(value, 8)}
                              </div>
                            ))}
                          </div>
                        )}

                        {runtimeReadiness?.missing.length ? (
                          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
                            Pendiente no bloqueante para grabacion: {runtimeReadiness.missing.join(', ')}.
                          </div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                        <div className="bg-white rounded-[32px] border border-brand-green-deep/10 p-6 shadow-sm">
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Estado On-Chain</p>
                              <h5 className="text-2xl font-serif text-brand-green-deep mt-1">Cuenta Trust Leaf</h5>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-brand-neutral text-[10px] font-bold uppercase tracking-widest text-brand-green-mid">
                              {stellarConfig.networkLabel}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                            <div className="rounded-2xl bg-brand-neutral/50 p-4 border border-brand-green-deep/5">
                              <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold">Recetas</p>
                              <p className="text-3xl font-bold text-brand-green-deep mt-2">
                                {patientDashboardLoading ? '...' : patientDashboard?.summary.total ?? 0}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-brand-neutral/50 p-4 border border-brand-green-deep/5">
                              <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold">Activas</p>
                              <p className="text-3xl font-bold text-brand-green-deep mt-2">
                                {patientDashboardLoading ? '...' : patientDashboard?.summary.active ?? 0}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-brand-neutral/50 p-4 border border-brand-green-deep/5">
                              <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold">Usadas / Exp.</p>
                              <p className="text-3xl font-bold text-brand-green-deep mt-2">
                                {patientDashboardLoading
                                  ? '...'
                                  : (patientDashboard?.summary.used ?? 0) + (patientDashboard?.summary.expired ?? 0)}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-green-deep/5 px-4 py-3">
                              <span className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold">Identidad verificable</span>
                              <span className="text-xs font-mono text-brand-green-deep">{shortenAddress(patientTrustAccountAddress, 8)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-green-deep/5 px-4 py-3">
                              <span className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold">Contrato de receta</span>
                              <span className="text-xs font-mono text-brand-green-deep">
                                {shortenAddress(patientDashboard?.prescriptionContractId ?? '', 8)}
                              </span>
                            </div>
                          </div>

                          {patientDashboardError && (
                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                              {patientDashboardError}
                            </div>
                          )}
                        </div>

                        <div className="bg-white rounded-[32px] border border-brand-green-deep/10 p-6 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold mb-2">Agente 402</p>
                          <h5 className="text-2xl font-serif text-brand-green-deep mt-1">Datos privados, prueba verificable</h5>
                          <div className="mt-5 space-y-3">
                            {[
                              ['Identidad', 'Wallet paciente verificada sin exponer documentos personales.'],
                              ['Receta', 'El dispensario solo recibe validez, vigencia y estado de consumo.'],
                              ['Clinica', 'Diagnostico y notas quedan fuera de cadena; Stellar guarda hash y estado.'],
                            ].map(([label, desc]) => (
                              <div key={label} className="rounded-2xl border border-brand-green-deep/5 bg-brand-neutral/40 p-4">
                                <p className="text-xs font-bold uppercase tracking-widest text-brand-green-deep">{label}</p>
                                <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/65">{desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white rounded-[32px] border border-brand-green-deep/10 p-6 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold mb-2">Proxima consulta</p>
                          {patientUpcomingConsultation ? (
                            <div className="rounded-3xl border border-brand-gold/20 bg-[#fbf7ef] p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h5 className="text-lg font-bold text-brand-green-deep">{patientUpcomingConsultation.patient ?? 'Paciente demo'}</h5>
                                  <p className="mt-1 text-sm text-brand-green-mid/70">
                                    {patientUpcomingConsultation.date} · {patientUpcomingConsultation.time}
                                  </p>
                                  <p className="mt-2 text-xs leading-relaxed text-brand-green-mid/60">
                                    {patientUpcomingConsultation.reason ?? 'Consulta reservada con medico validado.'}
                                  </p>
                                </div>
                                <span className="rounded-full bg-green-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-green-700">
                                  Reservada
                                </span>
                              </div>
                              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedClinicalRecord(portableClinicalDossier[0])}
                                  className="rounded-xl border border-brand-green-deep/10 bg-white px-4 py-3 text-xs font-bold text-brand-green-deep"
                                >
                                  Preparar ficha
                                </button>
                                <button
                                  type="button"
                                  onClick={() => switchView('doctors')}
                                  className="rounded-xl bg-brand-green-deep px-4 py-3 text-xs font-bold text-brand-ivory"
                                >
                                  Ver medicos
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-3xl border border-dashed border-brand-green-deep/10 bg-brand-neutral/40 p-5">
                              <p className="text-sm leading-relaxed text-brand-green-mid/70">
                                Aun no tienes una consulta reservada. Agenda con un medico validado antes de solicitar medicina en dispensarios.
                              </p>
                              <button
                                type="button"
                                onClick={() => switchView('doctors')}
                                className="mt-4 rounded-xl bg-brand-green-deep px-4 py-3 text-xs font-bold text-brand-ivory"
                              >
                                Buscar medico
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="bg-brand-neutral/40 rounded-[32px] border border-brand-green-deep/5 p-6">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold mb-2">Última receta</p>
                          {patientDashboardLoading ? (
                            <div className="rounded-3xl bg-white p-6 border border-brand-green-deep/5">
                              <p className="text-sm text-brand-green-mid/60">Consultando testnet...</p>
                            </div>
                          ) : primaryPrescription ? (
                            <button
                              onClick={() => openOnchainPrescription(primaryPrescription)}
                              className="w-full text-left rounded-3xl bg-white p-6 border border-brand-green-deep/5 hover:border-brand-gold transition-colors"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-brand-green-mid/40">
                                    Receta #{primaryPrescription.id}
                                  </p>
                                  <h6 className="mt-2 text-lg font-bold text-brand-green-deep">
                                    {primaryPrescription.status === 'active'
                                      ? 'Receta vigente'
                                      : primaryPrescription.status === 'used'
                                        ? 'Receta consumida'
                                        : 'Receta expirada'}
                                  </h6>
                                  <p className="mt-2 text-sm text-brand-green-mid/70">
                                    Emisión {formatPortalDate(primaryPrescription.issuedAt)}
                                  </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                  primaryPrescription.status === 'active'
                                    ? 'bg-green-50 text-green-700'
                                    : primaryPrescription.status === 'used'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {primaryPrescription.status}
                                </span>
                              </div>
                              <p className="mt-4 text-xs font-mono text-brand-green-mid/60">
                                Hash {shortenHash(primaryPrescription.medicationHash)}
                              </p>
                            </button>
                          ) : (
                            <div className="rounded-3xl bg-white p-6 border border-dashed border-brand-green-deep/10">
                              <p className="text-sm text-brand-green-mid/70">
                                Esta wallet todavía no tiene recetas emitidas en la ventana actual de eventos de testnet.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                        </>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Interactive Stat: Prescriptions */}
                        <motion.div 
                          whileHover={{ y: -5, backgroundColor: 'rgba(255, 255, 255, 1)' }}
                          onClick={() => switchView('prescriptions')}
                          className="p-6 bg-brand-neutral/50 rounded-3xl border border-brand-green-deep/5 cursor-pointer transition-all shadow-sm hover:shadow-xl hover:shadow-brand-green-deep/5 group"
                        >
                          <div className="flex justify-between items-start mb-4">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/60">Receta Vigente</span>
                              <div className="p-2 bg-brand-green-deep/5 rounded-xl text-brand-green-deep group-hover:bg-brand-green-deep group-hover:text-brand-ivory transition-colors">
                                <FileText size={20} />
                              </div>
                          </div>
                          <p className="text-xl font-bold text-brand-green-deep mb-1">
                            {primaryPrescription ? 'Cannabis terapéutico' : 'Sin receta vigente'}
                          </p>
                          <p className="text-xs text-brand-green-mid/70 flex items-center gap-1">
                            {primaryPrescription ? 'Dr. Alejandro Merino' : 'Pendiente de consulta'}
                            <span className="w-1 h-1 rounded-full bg-brand-gold"></span>
                            {primaryPrescription ? 'Emitida hoy' : 'Agenda primero'}
                          </p>
                          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-brand-gold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                            Ver detalles <ArrowRight size={12} />
                          </div>
                        </motion.div>

                        {/* Interactive Stat: Dispensaries */}
                        <motion.div 
                          whileHover={{ y: -5, backgroundColor: 'rgba(255, 255, 255, 1)' }}
                          onClick={() => {
                            if (hasPrescription) {
                              setSelectedDispensary(MOCK_DISPENSARIES[0]);
                              setDispensaryStep('inventory');
                              switchView('dispensaries');
                            } else {
                              switchView('dispensaries');
                            }
                          }}
                          className="p-6 bg-brand-neutral/50 rounded-3xl border border-brand-green-deep/5 cursor-pointer transition-all shadow-sm hover:shadow-xl hover:shadow-brand-green-deep/5 group"
                        >
                          <div className="flex justify-between items-start mb-4">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/60">{t.portal.suggestedDispensary}</span>
                              <div className="p-2 bg-brand-gold/10 rounded-xl text-brand-gold group-hover:bg-brand-gold group-hover:text-white transition-colors">
                                <ShoppingBag size={20} />
                              </div>
                          </div>
                          <p className="text-xl font-bold text-brand-green-deep mb-1">Green Leaf Center</p>
                          <p className="text-xs text-brand-green-mid/70">A 1.2km • Stock Disponible</p>
                          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-brand-gold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                            {hasPrescription ? 'Abrir catálogo' : 'Solicitar Acceso'} <ArrowRight size={12} />
                          </div>
                        </motion.div>

                        {/* Interactive Stat: Pickups */}
                        <motion.div 
                          whileHover={{ y: -5 }}
                          onClick={() => switchView('pickups')}
                          className="p-6 bg-brand-green-deep rounded-3xl cursor-pointer shadow-lg shadow-brand-green-deep/20 flex flex-col justify-between group overflow-hidden relative"
                        >
                          <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Retiros Activos</span>
                                <div className="p-2 bg-white/10 rounded-xl text-brand-gold">
                                  <Package size={20} />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-brand-ivory mb-1">{activePickups.length}</p>
                            <p className="text-xs text-brand-ivory/60">Medicinas por retirar</p>
                          </div>
                          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-brand-gold uppercase tracking-widest z-10 relative">
                             Ver billetera <ArrowRight size={12} />
                          </div>
                          <Activity size={100} className="absolute -bottom-8 -right-8 text-white/5 rotate-12 group-hover:scale-125 transition-transform duration-500" />
                        </motion.div>
                      </div>

                      {/* Recent Activity with Interaction */}
                      <div className="bg-white/40 p-8 rounded-[40px] border border-brand-green-deep/5">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <Activity size={20} className="text-brand-green-mid" />
                            <h4 className="text-xl font-serif text-brand-green-deep">{t.portal.networkHistory}</h4>
                          </div>
                          <button className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em] hover:underline">{t.portal.blockchainAudit}</button>
                        </div>
                        
                        <div className="space-y-4">
                          { recentActivity.map((item, idx) => (
                            <motion.div 
                              key={item.id} 
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="flex items-center justify-between p-5 bg-white rounded-3xl border border-brand-green-deep/5 shadow-sm hover:shadow-md transition-all group cursor-default"
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="p-3 bg-brand-neutral rounded-2xl text-brand-green-deep group-hover:bg-brand-green-deep group-hover:text-brand-ivory transition-colors">
                                  {getActivityIcon(item.icon as string)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-brand-green-deep group-hover:text-brand-green-mid transition-colors">{item.action}</p>
                                  <p className="text-[10px] text-brand-green-mid/40 font-bold uppercase tracking-tighter mt-0.5">{item.date}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="hidden sm:block text-right">
                                    <p className="text-[8px] font-mono text-brand-green-mid/30 uppercase tracking-tighter">Verified Hash</p>
                                    <p className="text-[9px] font-mono text-brand-green-mid/50">0x{Math.random().toString(16).slice(2, 10)}</p>
                                 </div>
                                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeView === 'profile' && isViewAllowed('profile') && (
                    <motion.div
                      key="view-profile"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="rounded-[32px] border border-brand-green-deep/10 bg-[#fbf7ef] p-6 md:p-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                          <div className="max-w-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-gold">Identidad verificable</p>
                            <h3 className="mt-2 text-3xl md:text-4xl font-serif text-brand-green-deep">Mi Cuenta Trust Leaf</h3>
                            <p className="mt-3 text-sm md:text-base leading-relaxed text-brand-green-mid/70">
                              Esta cuenta no es una billetera para manejar saldo. Es tu identidad medica verificable: recetas, permisos, retiros y trazabilidad quedan bajo tu control, mientras Trust Leaf patrocina las fees de red.
                            </p>
                          </div>
                          <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5 lg:min-w-[340px]">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green-deep text-brand-gold">
                                <ShieldCheck size={22} />
                              </div>
                              <span className="rounded-full bg-green-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-green-700">
                                {walletConnected ? 'Activa' : 'Lista'}
                              </span>
                            </div>
                            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Cuenta Stellar del paciente</p>
                            <p className="mt-1 break-all font-mono text-sm font-bold text-brand-green-deep">{patientTrustAccountAddress}</p>
                            <p className="mt-3 rounded-2xl border border-brand-gold/20 bg-brand-gold/10 px-4 py-3 text-xs leading-relaxed text-brand-green-mid/75">
                              Fees patrocinadas por Trust Leaf. El paciente firma consentimiento y propiedad; no necesita cargar saldo.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {trustAccountMetrics.map(([label, value]) => (
                          <div key={label} className="rounded-3xl border border-brand-green-deep/10 bg-white p-5 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                            <p className="mt-2 text-3xl font-bold text-brand-green-deep">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
                        <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-6">
                          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Activos verificables</p>
                          <h4 className="mt-2 text-2xl font-serif text-brand-green-deep">Receta, permisos y pruebas</h4>
                          <div className="mt-5 space-y-3">
                            {[
                              ['Receta tipo soulbound', primaryPrescription ? `Receta #${primaryPrescription.id} vigente en testnet` : 'Lista para emitirse desde el panel medico'],
                              ['Permisos temporales', activePrivacyPermissions.length ? `${activePrivacyPermissions.length} permisos activos` : 'El paciente decide cuando compartir datos'],
                              ['Trazabilidad recibida', activePickups.length ? `${activePickups.length} retiros con lote y cantidad` : 'Aparece al registrar la primera entrega'],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-2xl border border-brand-green-deep/5 bg-brand-neutral/40 p-4">
                                <p className="text-xs font-bold text-brand-green-deep">{label}</p>
                                <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/65">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-6">
                          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Accesos</p>
                          <h4 className="mt-2 text-2xl font-serif text-brand-green-deep">Compartir sin exponer todo</h4>
                          <div className="mt-5 grid grid-cols-1 gap-3">
                            <button
                              type="button"
                              onClick={() => openDrawer('patient-permissions')}
                              className="rounded-2xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory"
                            >
                              Ver permisos activos
                            </button>
                            <button
                              type="button"
                              onClick={() => openDrawer('patient-prescription')}
                              className="rounded-2xl border border-brand-green-deep/10 bg-white px-4 py-3 text-sm font-bold text-brand-green-deep"
                            >
                              Ver recetas verificables
                            </button>
                            <button
                              type="button"
                              onClick={() => openDrawer('patient-traceability')}
                              className="rounded-2xl border border-brand-gold/30 bg-[#fbf7ef] px-4 py-3 text-sm font-bold text-brand-green-deep"
                            >
                              Ver retiros y trazabilidad
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeView === 'doctors' && isViewAllowed('doctors') && (
                    <motion.div 
                      key="view-doctors"
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                    <div className="space-y-6">
                      {isDoctorPortal && (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 md:p-6">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Mesa de emision</p>
                                <h3 className="mt-2 text-2xl font-serif text-brand-green-deep">Receta soulbound para paciente</h3>
                                <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
                                  Selecciona paciente, confirma wallet y define vigencia/cupo. La receta queda atada a la cuenta del paciente y el dispensario solo ve lo minimo para validar.
                                </p>
                              </div>
                              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                doctorSignerReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {doctorSignerReady ? 'Testnet listo' : 'Signer pendiente'}
                              </span>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              {DOCTOR_SESSION_PATIENTS.map((patient) => (
                                <button
                                  key={`quick-${patient.id}`}
                                  type="button"
                                  onClick={() => setDoctorPatientAddress(patient.wallet)}
                                  className={`rounded-2xl border p-4 text-left transition-colors ${
                                    doctorPatientAddress === patient.wallet
                                      ? 'border-brand-gold bg-brand-gold/10'
                                      : 'border-brand-green-deep/10 bg-brand-neutral/40 hover:border-brand-gold/40'
                                  }`}
                                >
                                  <p className="text-sm font-bold text-brand-green-deep">{patient.name}</p>
                                  <p className="mt-1 text-[11px] leading-relaxed text-brand-green-mid/60">{patient.reason}</p>
                                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{patient.status}</p>
                                </button>
                              ))}
                            </div>

                            <label className="mt-5 block">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Wallet destino del paciente</span>
                              <input
                                type="text"
                                value={prescriptionPatientAddress}
                                onChange={(event) => {
                                  if (!selectedConsultationBlock) {
                                    setDoctorPatientAddress(event.target.value);
                                  }
                                }}
                                disabled={Boolean(selectedConsultationBlock)}
                                placeholder={DEMO_PATIENT_ADDRESS}
                                className="mt-2 w-full rounded-xl border border-brand-green-deep/10 bg-brand-neutral px-4 py-3 font-mono text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40 disabled:opacity-70"
                              />
                            </label>

                            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <label>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Tratamiento</span>
                                <input
                                  type="text"
                                  value={doctorIssueForm.treatment}
                                  onChange={(event) => setDoctorIssueForm((prev) => ({ ...prev, treatment: event.target.value }))}
                                  className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                                />
                              </label>
                              <label>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Dosis</span>
                                <input
                                  type="text"
                                  value={doctorIssueForm.dosage}
                                  onChange={(event) => setDoctorIssueForm((prev) => ({ ...prev, dosage: event.target.value }))}
                                  className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                                />
                              </label>
                              <label>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Vigencia dias</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={365}
                                  value={doctorIssueForm.durationDays}
                                  onChange={(event) => setDoctorIssueForm((prev) => ({ ...prev, durationDays: Number(event.target.value) }))}
                                  className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                                />
                              </label>
                              <label>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Cupo gramos</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={doctorIssueForm.monthlyLimitGrams}
                                  onChange={(event) => setDoctorIssueForm((prev) => ({ ...prev, monthlyLimitGrams: Number(event.target.value) }))}
                                  className="mt-2 w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                                />
                              </label>
                            </div>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={handleDoctorIssuePrescription}
                                disabled={doctorIssueBusy || !prescriptionPatientAddress}
                                className="flex-1 rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {doctorIssueBusy ? 'Emitiendo...' : doctorSignerReady ? 'Emitir receta Testnet' : 'Generar receta de prueba'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrescriptionToolOpen(true)}
                                className="flex-1 rounded-2xl border border-brand-green-deep/10 bg-white px-5 py-4 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-neutral"
                              >
                                Abrir editor completo
                              </button>
                            </div>

                            {(doctorIssueError || doctorIssueSuccess) && (
                              <div className={`mt-4 rounded-2xl border p-4 text-sm ${
                                doctorIssueError
                                  ? 'border-red-100 bg-red-50 text-red-700'
                                  : 'border-green-100 bg-green-50 text-green-800'
                              }`}>
                                {doctorIssueError ? (
                                  <p>{doctorIssueError}</p>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-700/70">Receta lista</p>
                                        <p className="mt-1 font-bold text-brand-green-deep">{doctorIssueSuccess}</p>
                                        <p className="mt-2 text-xs leading-relaxed text-green-800/75">
                                          Paciente {shortenAddress(prescriptionPatientAddress, 8)} - cupo {doctorIssueForm.monthlyLimitGrams}g - vigencia {doctorIssueForm.durationDays} dias.
                                        </p>
                                      </div>
                                      <span className="w-fit rounded-full bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-green-700">
                                        QR listo
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                      <button
                                        type="button"
                                        onClick={() => createPrivacyPermission('dispensary-prescription')}
                                        className="rounded-xl border border-green-100 bg-white px-3 py-2 text-xs font-bold text-green-700"
                                      >
                                        Mostrar QR
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => window.location.assign('/paciente/recetas')}
                                        className="rounded-xl border border-green-100 bg-white px-3 py-2 text-xs font-bold text-green-700"
                                      >
                                        Ver paciente
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => window.location.assign('/dispensario/operacion')}
                                        className="rounded-xl bg-green-700 px-3 py-2 text-xs font-bold text-white"
                                      >
                                        Probar dispensario
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5 md:p-6">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-700/70">Privacidad y validez</p>
                            <h3 className="mt-2 text-2xl font-serif text-brand-green-deep">Lo que viaja al dispensario</h3>
                            <div className="mt-5 grid grid-cols-1 gap-3">
                              {[
                                ['Soulbound', 'La receta se emite para la cuenta del paciente, no para transferirse ni revenderse.'],
                                ['Caducidad', `${doctorIssueForm.durationDays} dias de vigencia antes de requerir nueva evaluacion.`],
                                ['Hash clinico', 'Diagnostico y notas quedan off-chain; Stellar recibe metadata verificable.'],
                                ['Cupo', `${doctorIssueForm.monthlyLimitGrams}g autorizados para retiros controlados.`],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-blue-100 bg-white p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/55">{label}</p>
                                  <p className="mt-1 text-sm leading-relaxed text-brand-green-mid/70">{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {isDoctorPortal && (
                        <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 shadow-sm">
                          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                            <div className="max-w-2xl">
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Credencial profesional</p>
                              <h3 className="mt-1 text-2xl font-serif text-brand-green-deep">Medico autorizado en Trust Leaf</h3>
                              <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/70">
                                La wallet profesional identifica al medico ante DoctorRegistry y deja auditoria de recetas, permisos revisados y consultas. Las fees quedan patrocinadas por Trust Leaf.
                              </p>
                              <p className="mt-3 break-all font-mono text-xs font-bold text-brand-green-deep">{doctorCredentialAddress}</p>
                            </div>
                            <div className="grid min-w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[520px]">
                              {doctorCredentialMetrics.map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-brand-green-deep/10 bg-[#fbf7ef] p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                                  <p className="mt-1 text-lg font-bold text-brand-green-deep">{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {isDoctorPortal && (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                          <ActionCard
                            icon={<Stethoscope size={20} />}
                            eyebrow="Agenda"
                            title="Horarios"
                            description="Crear disponibilidad, reservar o abrir una consulta desde una hora tomada."
                            status={`${reservedAgendaBlocks.length} reservas`}
                            onClick={() => openDrawer('doctor-agenda')}
                            tone="cream"
                          />
                          <ActionCard
                            icon={<ShieldCheck size={20} />}
                            eyebrow="Llegada"
                            title="Validar QR"
                            description="Confirmar identidad y permiso temporal antes de iniciar la consulta."
                            status={selectedConsultationStatus === 'checked_in' ? 'Validado' : 'Pendiente'}
                            onClick={() => openDrawer('doctor-consultation')}
                            disabled={!selectedConsultationBlock}
                          />
                          <ActionCard
                            icon={<FileText size={20} />}
                            eyebrow="Ficha"
                            title="Resumen clínico"
                            description="Revisar evidencia autorizada y guardar la nota de consulta."
                            status={`${consultationClinicalRecords.length} notas`}
                            onClick={() => openDrawer('doctor-clinical-summary')}
                            disabled={!selectedConsultationBlock}
                          />
                          <ActionCard
                            icon={<Database size={20} />}
                            eyebrow="Receta"
                            title="Emitir receta"
                            description="Preparar tratamiento, dosis, vigencia y saldo autorizado."
                            status="Testnet"
                            onClick={() => openDrawer('doctor-prescription')}
                            tone="green"
                            disabled={!prescriptionPatientAddress}
                          />
                        </div>
                      )}

                      {isDoctorPortal && (
                        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[0.78fr_1.22fr]">
                          <div className="rounded-3xl border border-brand-gold/25 bg-[#fbf7ef] p-5 text-brand-green-deep shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Workspace medico</p>
                            <h3 className="mt-2 text-2xl font-serif leading-tight">Consulta, ficha y receta en una misma mesa de trabajo.</h3>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-green-mid/70">
                              Selecciona una reserva, abre la ficha autorizada, registra el estado de consulta y emite la receta verificable sin salir del panel.
                            </p>
                            <div className="mt-5 grid grid-cols-3 gap-2">
                              {[
                                ['Pacientes', DOCTOR_SESSION_PATIENTS.length],
                                ['Reservadas', reservedAgendaBlocks.length],
                                ['Recetas activas', patientDashboard?.summary.active ?? 1],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-brand-gold/20 bg-white/65 p-3">
                                  <p className="text-2xl font-bold text-brand-green-deep">{value}</p>
                                  <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-green-mid/55">{label}</p>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/55">
                              {['1. Reserva', '2. Consulta', '3. Receta'].map((step) => (
                                <div key={step} className="rounded-xl border border-brand-green-deep/5 bg-white/50 px-3 py-2">
                                  {step}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-3xl border border-brand-gold/20 bg-[#fffdf8] p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Horarios</p>
                                <h4 className="mt-1 text-xl font-bold text-brand-green-deep">Disponibilidad</h4>
                              </div>
                              <button
                                type="button"
                                onClick={() => openDrawer('doctor-agenda')}
                                className="rounded-xl border border-brand-green-deep/15 bg-white px-4 py-2 text-xs font-bold text-brand-green-deep shadow-sm transition-colors hover:bg-brand-neutral/60"
                              >
                                Gestionar agenda
                              </button>
                            </div>
                            <div className="mt-4 rounded-2xl border border-brand-gold/20 bg-white/70 px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green-mid/45">Fecha actual</p>
                              <p className="mt-1 text-sm font-bold leading-relaxed text-brand-green-deep">
                                {formatLiveDate(currentNow)}
                                <span className="block text-xs font-semibold text-brand-green-mid/60">Actualizado {formatLiveTime(currentNow)}</span>
                              </p>
                            </div>
                            {false && showAgendaForm && (
                              <div className="mt-4 rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <label className="space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Fecha</span>
                                    <input
                                      value={agendaForm.date}
                                      onChange={(event) => setAgendaForm((current) => ({ ...current, date: event.target.value }))}
                                      className="w-full rounded-xl bg-brand-neutral/60 px-3 py-2 text-sm font-bold text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                                    />
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Hora</span>
                                    <input
                                      value={agendaForm.time}
                                      onChange={(event) => setAgendaForm((current) => ({ ...current, time: event.target.value }))}
                                      className="w-full rounded-xl bg-brand-neutral/60 px-3 py-2 text-sm font-bold text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                                    />
                                  </label>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                                  <select
                                    value={agendaForm.status}
                                    onChange={(event) => setAgendaForm((current) => ({
                                      ...current,
                                      status: event.target.value as DoctorAgendaBlock['status'],
                                    }))}
                                    className="rounded-xl bg-brand-neutral/60 px-3 py-2 text-sm font-bold text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                                  >
                                    <option value="Disponible">Disponible</option>
                                    <option value="Reservado">Reservado</option>
                                  </select>
                                  <input
                                    value={agendaForm.patient}
                                    onChange={(event) => setAgendaForm((current) => ({ ...current, patient: event.target.value }))}
                                    placeholder="Paciente, si ya esta reservado"
                                    className="rounded-xl bg-brand-neutral/60 px-3 py-2 text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={handleAddAgendaBlock}
                                  className="mt-3 w-full rounded-xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
                                >
                                  Guardar bloque horario
                                </button>
                              </div>
                            )}
                            <div className="mt-4 grid grid-cols-1 gap-2">
                              {doctorAgendaBlocks.slice(0, 3).map((block) => (
                                <div key={block.id} className="flex items-center justify-between gap-3 rounded-2xl border border-brand-green-deep/5 bg-white/70 px-4 py-3">
                                  <div>
                                    <p className="text-sm font-bold text-brand-green-deep">{block.date} · {block.time}</p>
                                    <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/45">
                                      {block.status}
                                      {block.patient ? ` · ${block.patient}` : ''}
                                    </p>
                                    {block.reason && (
                                      <p className="mt-1 text-xs text-brand-green-mid/55">{block.reason}</p>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 flex-col gap-2">
                                    {block.status === 'Reservado' && (
                                      <button
                                        type="button"
                                        onClick={() => openConsultationFromBlock(block)}
                                        className="rounded-full bg-brand-green-deep px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-ivory"
                                      >
                                        Consulta
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => toggleAgendaBlockStatus(block.id)}
                                      className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                                        block.status === 'Disponible'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-brand-gold/15 text-brand-green-deep'
                                      }`}
                                    >
                                      {block.status === 'Disponible' ? 'Reservar' : 'Liberar'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => openDrawer('doctor-agenda')}
                              className="mt-4 w-full rounded-xl border border-brand-green-deep/10 bg-white px-4 py-3 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-neutral"
                            >
                              Ver agenda completa
                            </button>
                          </div>
                        </div>
                      )}
                      {isDoctorPortal && (
                        <div className="hidden rounded-2xl border border-brand-green-deep/10 bg-brand-neutral p-4 text-sm text-brand-green-mid/70">
                          Portal profesional separado: emite recetas on-chain y entrega el comprobante para que el dispensario lo valide desde su propia URL.
                        </div>
                      )}
                      {isDoctorPortal && (
                        <div className={`rounded-3xl border p-5 shadow-sm ${
                          selectedConsultationBlock
                            ? 'border-brand-gold/25 bg-[#fbf7ef]'
                            : 'border-brand-green-deep/10 bg-white'
                        }`}>
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
                                {selectedConsultationBlock ? 'Consulta activa' : 'Mesa de consulta'}
                              </p>
                              <h4 className="mt-1 text-xl font-bold text-brand-green-deep">
                                {selectedConsultationBlock?.patient ?? 'Selecciona una reserva para comenzar'}
                              </h4>
                              <p className="mt-1 text-sm text-brand-green-mid/70">
                                {selectedConsultationBlock
                                  ? `${selectedConsultationBlock.date} · ${selectedConsultationBlock.time}`
                                  : 'La consulta abre el acceso a ficha privada, seguimiento y emisión de receta.'}
                              </p>
                              <p className="mt-2 max-w-2xl text-sm text-brand-green-mid/65">
                                {selectedConsultationBlock?.reason ?? 'Usa el botón Consulta en un bloque reservado para traer el paciente a esta mesa de trabajo.'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-brand-green-deep/10 bg-white/70 p-3 text-sm">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Estado</p>
                              <p className="mt-1 font-bold text-brand-green-deep">
                                {!selectedConsultationBlock
                                  ? 'Sin consulta'
                                  : selectedConsultationStatus === 'active'
                                  ? 'En consulta'
                                  : selectedConsultationStatus === 'completed'
                                    ? 'Finalizada'
                                    : selectedConsultationStatus === 'checked_in'
                                      ? 'Paciente validado'
                                    : 'Agendada'}
                              </p>
                            </div>
                          </div>
                          {false && selectedConsultationBlock && (
                            <div className="mt-4 rounded-2xl border border-brand-green-deep/10 bg-white/80 p-4">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Validacion de llegada</p>
                                  <h5 className="mt-1 text-lg font-bold text-brand-green-deep">
                                    Confirmar identidad antes de iniciar
                                  </h5>
                                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-brand-green-mid/65">
                                    El medico valida que el paciente llego a la hora reservada, confirma wallet/QR y deja evidencia local antes de abrir la consulta.
                                  </p>
                                  {latestMedicalPermission && (
                                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-blue-600/60">Permiso activo del paciente</p>
                                      <p className="mt-1 font-mono text-[10px] text-blue-700">{latestMedicalPermission.qrToken}</p>
                                    </div>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto]">
                                  <div className="rounded-xl bg-brand-neutral/70 px-3 py-2 text-xs">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/45">Ahora</p>
                                    <p className="font-bold text-brand-green-deep">{formatLiveTime(currentNow)}</p>
                                  </div>
                                  {latestMedicalPermission && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedQrPermission(latestMedicalPermission)}
                                      className="rounded-xl border border-brand-green-deep/10 bg-white px-4 py-2.5 text-xs font-bold text-brand-green-deep transition-colors hover:bg-brand-neutral"
                                    >
                                      Ver permiso
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={validatePatientQrForDoctor}
                                    disabled={selectedConsultationStatus !== 'scheduled'}
                                    className="rounded-xl bg-brand-green-deep px-4 py-2.5 text-xs font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid disabled:cursor-not-allowed disabled:opacity-45"
                                  >
                                    {selectedConsultationStatus === 'scheduled' ? 'Validar QR paciente' : 'Paciente validado'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {false && selectedConsultationBlock && (
                            <div className="mt-4 rounded-2xl border border-brand-green-deep/10 bg-white/75 p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="max-w-xl">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Resumen clinico privado</p>
                                  <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/60">
                                    Este texto queda en la ficha del paciente y alimenta la receta. On-chain solo viaja un hash verificable.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedClinicalRecord(
                                    consultationClinicalRecords.find((record) => record.id === `consultation-${selectedConsultationBlock.id}`) ?? portableClinicalDossier[0],
                                  )}
                                  className="rounded-xl border border-brand-green-deep/10 px-3 py-2 text-xs font-bold text-brand-green-deep transition-colors hover:bg-brand-neutral"
                                >
                                  Ver ficha
                                </button>
                              </div>
                              <textarea
                                value={consultationSummaryDraft}
                                onChange={(event) => setConsultationSummaryDraft(event.target.value)}
                                rows={3}
                                className="mt-3 w-full resize-none rounded-xl bg-brand-neutral/70 px-4 py-3 text-sm leading-relaxed text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                              />
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() => saveConsultationSummaryToRecord()}
                                  className="rounded-xl bg-brand-green-deep px-4 py-2.5 text-xs font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
                                >
                                  Guardar en ficha clinica
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConsultationStatus('completed');
                                    setPrescriptionToolOpen(true);
                                  }}
                                  disabled={selectedConsultationStatus !== 'active'}
                                  className="rounded-xl border border-brand-gold/30 bg-[#fbf7ef] px-4 py-2.5 text-xs font-bold text-brand-green-deep transition-colors hover:bg-brand-gold/10 disabled:opacity-45"
                                >
                                  Cerrar consulta y preparar receta
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <button
                              type="button"
                              onClick={() => openDrawer('doctor-clinical-summary')}
                              disabled={!selectedConsultationBlock}
                              className="rounded-2xl border border-brand-green-deep/10 bg-white px-4 py-3 text-sm font-bold text-brand-green-deep"
                            >
                              Ficha y resumen
                            </button>
                            <button
                              type="button"
                              onClick={() => openDrawer('doctor-consultation')}
                              disabled={!selectedConsultationBlock || selectedConsultationStatus !== 'checked_in'}
                              className="rounded-2xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory disabled:opacity-45"
                            >
                              Abrir consulta
                            </button>
                            <button
                              type="button"
                              onClick={() => openDrawer('doctor-prescription')}
                              disabled={!selectedConsultationBlock || selectedConsultationStatus !== 'active'}
                              className="rounded-2xl border border-brand-gold/30 bg-white px-4 py-3 text-sm font-bold text-brand-green-deep disabled:opacity-45"
                            >
                              Preparar receta
                            </button>
                          </div>
                        </div>
                      )}
                      {!isDoctorPortal && (
                        <p className="text-sm text-brand-green-mid/70">Todos los médicos en Trust Leaf están validados y poseen licencias vigentes para la prescripción de cannabis medicinal.</p>
                      )}
                      
                      {isDoctorPortal && (
                      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[0.64fr_1.36fr]">
                        <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Pacientes</p>
                          <h4 className="mt-1 text-xl font-bold text-brand-green-deep">Lista de trabajo</h4>
                          <p className="mt-2 text-xs leading-relaxed text-brand-green-mid/60">
                            Selecciona un paciente para preparar la receta o usa una reserva para abrir la consulta completa.
                          </p>
                          <div className="mt-4 space-y-3">
                            {DOCTOR_SESSION_PATIENTS.map((patient) => (
                              <button
                                key={patient.id}
                                type="button"
                                onClick={() => setDoctorPatientAddress(patient.wallet)}
                                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                                  doctorPatientAddress === patient.wallet
                                    ? 'border-brand-gold bg-brand-gold/5'
                                    : 'border-brand-green-deep/5 bg-brand-neutral/40 hover:border-brand-gold/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-brand-green-deep">{patient.name}</p>
                                    <p className="mt-1 text-xs text-brand-green-mid/60">{patient.reason}</p>
                                  </div>
                                  <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/60">
                                    {patient.status}
                                  </span>
                                </div>
                                <p className="mt-3 text-[10px] font-mono text-brand-green-mid/45">{shortenAddress(patient.wallet, 8)}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                      <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">Herramientas</p>
                            <h3 className="mt-1 text-xl font-bold text-brand-green-deep">Acciones de consulta</h3>
                            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-brand-green-mid/60">
                              Abre solo la herramienta que necesitas en el momento. La ficha y la receta se trabajan como ventanas separadas para mantener el workspace limpio.
                            </p>
                          </div>
                          <div className="rounded-2xl bg-brand-neutral px-3 py-2 text-xs text-brand-green-mid/70 md:max-w-[300px]">
                            <p className="mb-1 font-bold uppercase tracking-widest text-brand-green-mid/45">Paciente destino</p>
                            <p className="font-mono break-all">
                              {prescriptionPatientAddress
                                ? shortenAddress(prescriptionPatientAddress, 10)
                                : 'Paciente sin dirección'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
                          <button
                            type="button"
                            onClick={() => openDrawer('doctor-consultation')}
                            className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left transition-colors hover:bg-blue-100"
                          >
                            <ShieldCheck size={18} className="mb-3 text-blue-700" />
                            <p className="text-sm font-bold text-brand-green-deep">Validar QR paciente</p>
                            <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/60">Confirmar llegada, permiso y wallet antes de iniciar consulta.</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => openDrawer('doctor-clinical-summary')}
                            disabled={!selectedConsultationBlock}
                            className="rounded-2xl border border-brand-green-deep/10 bg-brand-neutral/40 p-4 text-left transition-colors hover:bg-brand-neutral disabled:opacity-45"
                          >
                            <ShieldCheck size={18} className="mb-3 text-brand-green-deep" />
                            <p className="text-sm font-bold text-brand-green-deep">Ficha privada</p>
                            <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/60">Revisar sintomas, examenes y permisos 402.</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => openDrawer('doctor-prescription')}
                            disabled={!prescriptionPatientAddress}
                            className="rounded-2xl bg-brand-green-deep p-4 text-left text-brand-ivory transition-colors hover:bg-brand-green-mid disabled:opacity-45"
                          >
                            <FileText size={18} className="mb-3 text-brand-gold" />
                            <p className="text-sm font-bold">Preparar receta</p>
                            <p className="mt-1 text-xs leading-relaxed text-brand-ivory/65">Tratamiento, dosis, vigencia y cupo autorizado.</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => window.location.assign('/dispensario/operacion')}
                            className="rounded-2xl border border-brand-gold/20 bg-[#fbf7ef] p-4 text-left transition-colors hover:bg-brand-gold/10"
                          >
                            <ArrowRight size={18} className="mb-3 text-brand-gold" />
                            <p className="text-sm font-bold text-brand-green-deep">Probar dispensario</p>
                            <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/60">Validar receta y registrar retiro parcial.</p>
                          </button>
                        </div>

                        {(doctorIssueError || doctorIssueSuccess) && (
                          <div className="mt-4 space-y-3">
                            {doctorIssueError && (
                              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                                {doctorIssueError}
                              </div>
                            )}
                            {doctorIssueSuccess && (
                              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-xs text-green-700">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <span className="leading-relaxed">{doctorIssueSuccess}</span>
                                  <span className="rounded-full bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-green-700">
                                    QR listo
                                  </span>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                  <button
                                    type="button"
                                    onClick={() => createPrivacyPermission('dispensary-prescription')}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-green-100 bg-white px-3 py-2 font-bold text-green-700 hover:border-green-200"
                                  >
                                    Mostrar QR receta
                                    <ShieldCheck size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => window.location.assign('/paciente')}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-green-100 bg-white px-3 py-2 font-bold text-green-700 hover:border-green-200"
                                  >
                                    Ver en paciente
                                    <ArrowRight size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => window.location.assign('/dispensario/operacion')}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-green-700 px-3 py-2 font-bold text-white hover:bg-green-800"
                                  >
                                    Ir a dispensar
                                    <ArrowRight size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      </div>
                      )}

                      {!isDoctorPortal && (
                      <>
                      <div className="relative max-w-3xl">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-green-mid/40" />
                        <input 
                          type="text" 
                          placeholder="Buscar por nombre o especialidad..." 
                          value={doctorSearchQuery}
                          onChange={(e) => setDoctorSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" 
                        />
                      </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-6xl">
                      {MOCK_DOCTORS.filter(doc => 
                        doc.name.toLowerCase().includes(doctorSearchQuery.toLowerCase()) || 
                        doc.specialty.toLowerCase().includes(doctorSearchQuery.toLowerCase())
                      ).map(doc => (
                        <div key={`portal-doctor-${doc.id}`} className="p-5 border border-brand-green-deep/5 rounded-2xl grid grid-cols-[auto_1fr] gap-4 hover:shadow-md transition-shadow">
                          <div className="w-14 h-14 bg-brand-neutral rounded-2xl flex items-center justify-center text-brand-green-mid flex-shrink-0">
                            <User size={26} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-bold text-brand-green-deep truncate">{doc.name}</h4>
                            <p className="text-sm text-brand-green-mid/60 mb-2 truncate">{doc.specialty}</p>
                            <div className="flex items-center gap-1 text-xs text-brand-gold font-bold">
                              <Star size={14} fill="currentColor" /> {doc.rating.toFixed(1)} <span className="text-brand-green-mid/40 font-medium">({doc.reviews} reseñas)</span>
                            </div>
                          </div>
                          <div className="col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-brand-green-deep/5">
                            <span className="text-[10px] text-center uppercase tracking-widest text-brand-green-mid font-bold opacity-60">Próxima: {doc.availability}</span>
                            <button 
                              onClick={() => {
                                setBookingDoctor(doc);
                                setBookingStep('date');
                              }}
                              className="w-full sm:w-auto px-5 py-3 bg-brand-green-deep text-brand-ivory rounded-xl text-sm font-bold hover:bg-brand-green-mid transition-all active:scale-95"
                            >
                              Agendar Cita
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    </>
                    )}
                    </div>
                  </motion.div>
                )}

                  {activeView === 'dispensaries' && (
                    <motion.div 
                      key="view-dispensaries"
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                    {false && patientDashboardLoading && (
                      <div className="bg-white rounded-[32px] border border-brand-green-deep/10 p-8">
                        <p className="text-sm text-brand-green-mid/60">Consultando recetas del paciente en testnet...</p>
                      </div>
                    )}

                    {false && !!patientDashboard?.prescriptions.length && (
                      <div className="space-y-4">
                        <div className="mb-2 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3 text-blue-700 text-xs">
                          <Star size={14} fill="currentColor" />
                          <span>Estas recetas se leen en tiempo real desde el contrato `Prescription` desplegado en Stellar Testnet.</span>
                        </div>

                        {patientDashboard.prescriptions.map((prescription) => (
                          <div
                            key={prescription.id}
                            onClick={() => openOnchainPrescription(prescription)}
                            className="group cursor-pointer p-6 bg-white border border-brand-green-deep/10 rounded-2xl hover:border-brand-gold hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-center gap-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-brand-neutral rounded-xl text-brand-green-deep group-hover:bg-brand-gold/10 group-hover:text-brand-gold transition-colors">
                                <FileText size={24} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs font-bold text-brand-green-mid/40 uppercase tracking-widest">
                                    ID receta #{prescription.id}
                                  </p>
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-[9px] text-blue-600 font-bold border border-blue-100 rounded-md">
                                    <Database size={10} /> ON-CHAIN
                                  </span>
                                </div>
                                <h4 className="font-bold text-brand-green-deep">
                                  {prescription.status === 'active'
                                    ? 'Receta vigente en testnet'
                                    : prescription.status === 'used'
                                      ? 'Receta consumida'
                                      : 'Receta expirada'}
                                </h4>
                                <p className="text-sm text-brand-green-mid/70">
                                  {shortenAddress(prescription.doctor, 6)} • {formatPortalDate(prescription.issuedAt)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                prescription.status === 'active'
                                  ? 'text-green-600 bg-green-50'
                                  : prescription.status === 'used'
                                    ? 'text-blue-600 bg-blue-50'
                                    : 'text-amber-700 bg-amber-50'
                              }`}>
                                {prescription.status}
                              </span>
                              <div className="p-2 text-brand-green-mid/40 group-hover:text-brand-gold transition-colors">
                                <ArrowRight size={20} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isDispensaryPortal ? (
                      <div className="space-y-6">
                        <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 shadow-sm">
                          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                            <div className="max-w-2xl">
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Credencial operativa</p>
                              <h3 className="mt-1 text-2xl font-serif text-brand-green-deep">Dispensario autorizado en Trust Leaf</h3>
                              <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/70">
                                La wallet operativa registra entregas, lotes y actividad verificable ante DispensaryRegistry. El equipo no necesita saldo manual: Trust Leaf patrocina las fees del flujo.
                              </p>
                              <p className="mt-3 break-all font-mono text-xs font-bold text-brand-green-deep">{dispensaryCredentialAddress}</p>
                            </div>
                            <div className="grid min-w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[520px]">
                              {dispensaryCredentialMetrics.map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-brand-green-deep/10 bg-[#fbf7ef] p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                                  <p className="mt-1 text-lg font-bold text-brand-green-deep">{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[32px] border border-brand-green-deep/10 bg-[#fbf7ef] p-5 md:p-6">
                          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                            <div className="max-w-3xl">
                              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">Operacion diaria</p>
                              <h3 className="mt-2 text-2xl md:text-3xl font-serif text-brand-green-deep">Inventario, QR del paciente y entrega parcial.</h3>
                              <p className="mt-3 text-sm leading-relaxed text-brand-green-mid/70">
                                El dispensario trabaja desde su propia pantalla: carga productos/lotes, recibe al paciente, valida receta y saldo, registra la entrega sin ver diagnostico ni ficha clinica completa.
                              </p>
                            </div>
                            <div className="grid min-w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[420px]">
                              {[
                                ['1', 'Escanear QR', 'Receta y permiso temporal'],
                                ['2', 'Validar saldo', 'Vigencia, formatos y gramos'],
                                ['3', 'Registrar entrega', 'Lote, cantidad y prueba'],
                              ].map(([step, title, desc]) => (
                                <div key={step} className="rounded-2xl border border-brand-green-deep/10 bg-white/75 p-3">
                                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green-deep text-xs font-bold text-brand-ivory">
                                    {step}
                                  </div>
                                  <p className="text-sm font-bold text-brand-green-deep">{title}</p>
                                  <p className="mt-1 text-[11px] leading-relaxed text-brand-green-mid/60">{desc}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
                            <button
                              type="button"
                              onClick={() => openDrawer('dispensary-qr')}
                              className="rounded-2xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
                            >
                              Escanear QR / validar receta
                            </button>
                            <button
                              type="button"
                              onClick={() => openDrawer('dispensary-qr')}
                              className="rounded-2xl border border-brand-green-deep/10 bg-white px-4 py-3 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-neutral"
                            >
                              Ingresar numero de receta
                            </button>
                            <button
                              type="button"
                              onClick={() => openDrawer('dispensary-inventory')}
                              className="rounded-2xl border border-brand-gold/30 bg-white px-4 py-3 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-gold/10"
                            >
                              Preparar desde inventario
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                          <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 md:p-6">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Mesa de validacion</p>
                                <h3 className="mt-2 text-2xl font-serif text-brand-green-deep">Recibir paciente con receta</h3>
                                <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
                                  El operador puede escanear QR o ingresar el numero de receta. Trust Leaf muestra vigencia, saldo y permiso minimo antes de preparar el retiro.
                                </p>
                              </div>
                              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                dispensaryValidation
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {dispensaryValidation ? 'QR valido' : 'Sin QR'}
                              </span>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                              <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Numero de receta</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={dispensePrescriptionId}
                                  onChange={(event) => setDispensePrescriptionId(event.target.value.replace(/[^\d]/g, ''))}
                                  placeholder={`Ej: ${DEMO_PRESCRIPTION_ID}`}
                                  className="mt-2 w-full rounded-xl border border-brand-green-deep/10 bg-brand-neutral px-4 py-3 text-sm font-mono text-brand-green-deep outline-none focus:ring-2 focus:ring-brand-gold/40"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={validatePrescriptionOnTestnet}
                                disabled={prescriptionValidationBusy}
                                className="self-end rounded-xl bg-brand-green-deep px-5 py-3 text-sm font-bold text-brand-ivory transition-colors hover:bg-brand-green-mid"
                              >
                                {prescriptionValidationBusy ? 'Validando...' : 'Validar Testnet'}
                              </button>
                            </div>

                            {(prescriptionValidation || prescriptionValidationError) && (
                              <div className={`mt-4 rounded-2xl border p-4 text-sm ${
                                prescriptionValidation?.validation.canDispense
                                  ? 'border-green-100 bg-green-50 text-green-800'
                                  : 'border-amber-100 bg-amber-50 text-amber-800'
                              }`}>
                                {prescriptionValidation ? (
                                  <>
                                    <p className="font-bold">
                                      {prescriptionValidation.validation.canDispense
                                        ? 'Receta vigente y dispensable'
                                        : 'Receta no dispensable'}
                                    </p>
                                    <p className="mt-1 leading-relaxed">{prescriptionValidation.validation.reason}</p>
                                    <p className="mt-2 font-mono text-xs">
                                      Paciente {shortenAddress(prescriptionValidation.prescription.patient, 8)} · Doctor {shortenAddress(prescriptionValidation.prescription.doctor, 8)}
                                    </p>
                                  </>
                                ) : (
                                  <p>{prescriptionValidationError}</p>
                                )}
                              </div>
                            )}

                            <div className="mt-5 grid grid-cols-2 gap-3">
                              {[
                                ['Receta', `#${resolvedPrescriptionId}`],
                                ['Disponible', `${prescriptionValidation?.prescription.remainingQuantity ?? prescriptionRemainingGrams}g`],
                                ['Este retiro', `${cartGrams}g`],
                                ['Retiros previos', String(previousPrescriptionPickups.length)],
                                ['Saldo post retiro', `${Math.max(0, prescriptionRemainingGrams - cartGrams)}g`],
                                ['Red', dispensarySignerReady ? 'Testnet' : 'Privado'],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl bg-brand-neutral/70 p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                                  <p className="mt-1 text-sm font-bold text-brand-green-deep">{value}</p>
                                </div>
                              ))}
                            </div>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDispensary(buildOperatorDispensary());
                                  setDispensaryStep('inventory');
                                }}
                                className="flex-1 rounded-2xl bg-brand-gold px-5 py-3 text-sm font-bold text-brand-green-deep transition-transform active:scale-95"
                              >
                                Elegir producto y lote
                              </button>
                              <button
                                type="button"
                                onClick={() => openDrawer('dispensary-dispense')}
                                className="flex-1 rounded-2xl border border-brand-green-deep/10 bg-white px-5 py-3 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-neutral"
                              >
                                Registrar retiro
                              </button>
                            </div>
                          </div>

                          <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5 md:p-6">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-700/70">Privacidad del paciente</p>
                            <h3 className="mt-2 text-2xl font-serif text-brand-green-deep">Solo lo necesario para dispensar</h3>
                            <div className="mt-5 space-y-3">
                              {[
                                ['Visible', 'Receta, vigencia, formatos autorizados y saldo.'],
                                ['Oculto', 'Diagnostico, notas clinicas y expediente completo.'],
                                ['Auditable', 'Lote, cantidad, dispensario y prueba de retiro.'],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-blue-100 bg-white p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/55">{label}</p>
                                  <p className="mt-1 text-sm leading-relaxed text-brand-green-mid/70">{value}</p>
                                </div>
                              ))}
                            </div>
                            {dispensaryValidation && (
                              <button
                                type="button"
                                onClick={() => setSelectedQrPermission(dispensaryValidation)}
                                className="mt-4 w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700"
                              >
                                Ver permiso QR temporal
                              </button>
                            )}
                          </div>
                        </div>

                        {false && dispensaryValidation && (
                          <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5 md:p-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600/70">QR validado</p>
                                <h3 className="mt-1 text-2xl font-serif text-brand-green-deep">Receta disponible sin datos clinicos</h3>
                                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-800/70">
                                  El QR contiene solo un token temporal. El dispensario ve receta, saldo, formatos y retiros previos, pero no diagnostico ni ficha completa.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => revokePrivacyPermission(dispensaryValidation.id)}
                                className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-700"
                              >
                                Revocar permiso
                              </button>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                              {[
                                ['Estado receta', 'Vigente'],
                                ['Saldo disponible', `${prescriptionRemainingGrams}g`],
                                ['Formatos', 'Flores, aceites, extractos'],
                                ['Retiros previos', `${activePickups.length}`],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-blue-100 bg-white p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/50">{label}</p>
                                  <p className="mt-1 text-sm font-bold text-brand-green-deep">{value}</p>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/50">Permiso privado</p>
                                  <p className="mt-1 font-mono text-xs text-brand-green-deep">{dispensaryValidation.qrToken}</p>
                                  <p className="mt-1 text-xs text-brand-green-mid/55">{dispensaryValidation.hash} - {dispensaryValidation.expiresAt}</p>
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedQrPermission(dispensaryValidation)}
                                    className="rounded-xl bg-brand-green-deep px-4 py-3 text-xs font-bold text-brand-ivory"
                                  >
                                    Ver QR
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDispensary(buildOperatorDispensary());
                                      setDispensaryStep('inventory');
                                    }}
                                    className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs font-bold text-blue-700"
                                  >
                                    Elegir producto
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="p-4 bg-white border border-brand-green-deep/10 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green-mid/50 mb-2">Productos</p>
                            <p className="text-2xl font-serif text-brand-green-deep">{dispensaryInventory.length}</p>
                          </div>
                          <div className="p-4 bg-white border border-brand-green-deep/10 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green-mid/50 mb-2">Stock total</p>
                            <p className="text-2xl font-serif text-brand-green-deep">
                              {dispensaryInventory.reduce((total, product) => total + Number(product.stockGrams ?? 0), 0)}g
                            </p>
                          </div>
                          <div className="p-4 bg-white border border-brand-green-deep/10 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green-mid/50 mb-2">Bajo stock</p>
                            <p className="text-2xl font-serif text-brand-green-deep">
                              {dispensaryInventory.filter((product) => Number(product.stockGrams ?? 0) <= 10).length}
                            </p>
                          </div>
                        </div>

                        <div className="hidden bg-white border border-brand-green-deep/10 rounded-[28px] p-5 md:p-6">
                          <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                              <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">Inventario dispensario</p>
                              <h3 className="text-2xl md:text-3xl font-serif text-brand-green-deep">Cargar producto trazable</h3>
                            </div>
                            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-brand-neutral items-center justify-center text-brand-green-deep">
                              <Package size={22} />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                              value={inventoryForm.name}
                              onChange={(event) => setInventoryForm(prev => ({ ...prev, name: event.target.value }))}
                              placeholder="Nombre del producto"
                              className="px-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                            <input
                              value={inventoryForm.type}
                              onChange={(event) => setInventoryForm(prev => ({ ...prev, type: event.target.value }))}
                              placeholder="Tipo o formato"
                              className="px-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                            <input
                              value={inventoryForm.batch}
                              onChange={(event) => setInventoryForm(prev => ({ ...prev, batch: event.target.value }))}
                              placeholder="Lote"
                              className="px-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                            <input
                              type="number"
                              min="1"
                              value={inventoryForm.stockGrams}
                              onChange={(event) => setInventoryForm(prev => ({ ...prev, stockGrams: Number(event.target.value) }))}
                              placeholder="Cantidad en gramos"
                              className="px-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                            <input
                              value={inventoryForm.thc}
                              onChange={(event) => setInventoryForm(prev => ({ ...prev, thc: event.target.value }))}
                              placeholder="THC"
                              className="px-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                            <input
                              value={inventoryForm.cbd}
                              onChange={(event) => setInventoryForm(prev => ({ ...prev, cbd: event.target.value }))}
                              placeholder="CBD"
                              className="px-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                            <input
                              value={inventoryForm.lab}
                              onChange={(event) => setInventoryForm(prev => ({ ...prev, lab: event.target.value }))}
                              placeholder="Laboratorio / QC"
                              className="px-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                            <input
                              value={inventoryForm.origin}
                              onChange={(event) => setInventoryForm(prev => ({ ...prev, origin: event.target.value }))}
                              placeholder="Origen"
                              className="px-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={addInventoryProduct}
                            className="mt-4 w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-green-deep text-brand-ivory rounded-xl text-sm font-bold hover:bg-brand-green-mid transition-all active:scale-95"
                          >
                            <Plus size={16} />
                            Agregar al inventario
                          </button>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">Inventario disponible</p>
                              <h3 className="text-2xl md:text-3xl font-serif text-brand-green-deep">Productos listos para dispensar</h3>
                            <p className="text-sm text-brand-green-mid/60 mt-2 max-w-2xl">
                              Cada tarjeta representa un producto/lote del dispensario. Ajusta stock si entra o sale mercadería, o prepara una dispensa para validar la receta del paciente.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openDrawer('dispensary-inventory')}
                            className="rounded-2xl border border-brand-green-deep/10 bg-white px-5 py-3 text-sm font-bold text-brand-green-deep transition-colors hover:bg-brand-neutral"
                          >
                            Gestionar inventario
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {dispensaryInventory.slice(0, 2).map((product) => {
                            const stock = Number(product.stockGrams ?? 0);
                            const isLowStock = stock <= 10;

                            return (
                              <div key={product.id} className="p-5 bg-white border border-brand-green-deep/10 rounded-2xl">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <h4 className="font-bold text-brand-green-deep text-lg">{product.name}</h4>
                                      <span className="text-[9px] bg-brand-green-deep text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                        {product.type}
                                      </span>
                                    </div>
                                    <p className="text-xs text-brand-green-mid/60">{product.batch}</p>
                                  </div>
                                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${isLowStock ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                    {isLowStock ? 'Bajo stock' : 'Disponible'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                  <div className="p-3 rounded-xl bg-brand-neutral/60">
                                    <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold mb-1">Stock disponible</p>
                                    <p className="font-bold text-brand-green-deep">{stock}g</p>
                                  </div>
                                  <div className="p-3 rounded-xl bg-brand-neutral/60">
                                    <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold mb-1">Concentración</p>
                                    <p className="font-bold text-brand-green-deep">THC {product.thc} / CBD {product.cbd}</p>
                                  </div>
                                  <div className="p-3 rounded-xl bg-brand-neutral/60">
                                    <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold mb-1">Certificado QC</p>
                                    <p className="font-bold text-brand-green-deep truncate">{product.lab}</p>
                                  </div>
                                  <div className="p-3 rounded-xl bg-brand-neutral/60">
                                    <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold mb-1">Origen</p>
                                    <p className="font-bold text-brand-green-deep line-clamp-2">{product.origin}</p>
                                  </div>
                                </div>

                                <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70">Hash trazable del lote</p>
                                      <p className="mt-1 font-mono text-xs text-blue-700">
                                        {shortenHash(makeDemoHash(`${product.name}-${product.batch}-${product.origin}`), 14)}
                                      </p>
                                    </div>
                                    <span className="rounded-full bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-blue-700">
                                      No revela proveedor completo
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Stock</span>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateInventoryStock(product.id, -1)}
                                        className="w-11 h-11 rounded-xl border border-brand-green-deep/10 flex items-center justify-center text-brand-green-deep hover:bg-brand-neutral active:scale-95"
                                        aria-label="Restar 1g de stock"
                                        title="Restar 1g de stock"
                                      >
                                        <Minus size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateInventoryStock(product.id, 1)}
                                        className="w-11 h-11 rounded-xl border border-brand-green-deep/10 flex items-center justify-center text-brand-green-deep hover:bg-brand-neutral active:scale-95"
                                        aria-label="Sumar 1g de stock"
                                        title="Sumar 1g de stock"
                                      >
                                        <Plus size={16} />
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => prepareInventoryDispense(product)}
                                    disabled={stock <= 0}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-brand-green-deep text-brand-ivory rounded-xl text-sm font-bold hover:bg-brand-green-mid transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Preparar dispensa
                                    <ArrowRight size={16} />
                                  </button>
                                </div>
                                <p className="mt-3 text-[11px] leading-relaxed text-brand-green-mid/55">
                                  Al confirmar, Trust Leaf registra receta, lote, cantidad, dispensario y prueba verificable. El diagnostico del paciente no se comparte.
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 md:p-6">
                          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">Registro operativo</p>
                              <h3 className="mt-1 text-2xl font-serif text-brand-green-deep">Entregas recientes</h3>
                            </div>
                            <span className="rounded-full bg-brand-neutral px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/60">
                              Registro local
                            </span>
                          </div>
                          <div className="mt-5 space-y-3">
                            {activePickups.length ? (
                              activePickups.slice(0, 4).map((pickup) => (
                                <div key={pickup.id} className="flex flex-col gap-3 rounded-2xl border border-brand-green-deep/5 bg-brand-neutral/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-sm font-bold text-brand-green-deep">{pickup.strain?.name ?? 'Producto medicinal'}</p>
                                    <p className="mt-1 text-xs text-brand-green-mid/60">
                                      {pickup.quantity}g · {pickup.dispensary?.name ?? 'Dispensario operador'} · receta validada
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-green-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-green-700">
                                      Parcial
                                    </span>
                                    <span className="font-mono text-[10px] text-brand-green-mid/45">{pickup.token}</span>
                                    <button
                                      type="button"
                                      onClick={() => openPickupTraceability(pickup)}
                                      className="rounded-full border border-brand-green-deep/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-deep transition-colors hover:bg-brand-green-deep hover:text-brand-ivory"
                                    >
                                      Ver trazabilidad
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-brand-green-deep/10 bg-brand-neutral/25 p-5">
                                <p className="text-sm leading-relaxed text-brand-green-mid/65">
                                  Aun no hay entregas registradas. Cuando valides una receta y confirmes retiro, aparecera aqui con lote, cantidad y prueba de entrega parcial.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : patientDashboardLoading ? (
                      <div className="bg-white rounded-[32px] border border-brand-green-deep/10 p-8">
                        <p className="text-sm text-brand-green-mid/60">Consultando recetas del paciente en testnet...</p>
                      </div>
                    ) : false && patientDashboard?.prescriptions.length ? (
                      <div className="space-y-4">
                        <div className="mb-2 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3 text-blue-700 text-xs">
                          <Star size={14} fill="currentColor" />
                          <span>Estas recetas se leen en tiempo real desde el contrato `Prescription` desplegado en Stellar Testnet.</span>
                        </div>

                        {patientDashboard.prescriptions.map((prescription) => (
                          <div
                            key={prescription.id}
                            onClick={() => openOnchainPrescription(prescription)}
                            className="group cursor-pointer p-6 bg-white border border-brand-green-deep/10 rounded-2xl hover:border-brand-gold hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-center gap-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-brand-neutral rounded-xl text-brand-green-deep group-hover:bg-brand-gold/10 group-hover:text-brand-gold transition-colors">
                                <FileText size={24} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs font-bold text-brand-green-mid/40 uppercase tracking-widest">
                                    ID receta #{prescription.id}
                                  </p>
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-[9px] text-blue-600 font-bold border border-blue-100 rounded-md">
                                    <Database size={10} /> ON-CHAIN
                                  </span>
                                </div>
                                <h4 className="font-bold text-brand-green-deep">
                                  {prescription.status === 'active'
                                    ? 'Receta vigente en testnet'
                                    : prescription.status === 'used'
                                      ? 'Receta consumida'
                                      : 'Receta expirada'}
                                </h4>
                                <p className="text-sm text-brand-green-mid/70">
                                  {shortenAddress(prescription.doctor, 6)} • {formatPortalDate(prescription.issuedAt)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                prescription.status === 'active'
                                  ? 'text-green-600 bg-green-50'
                                  : prescription.status === 'used'
                                    ? 'text-blue-600 bg-blue-50'
                                    : 'text-amber-700 bg-amber-50'
                              }`}>
                                {prescription.status}
                              </span>
                              <div className="p-2 text-brand-green-mid/40 group-hover:text-brand-gold transition-colors">
                                <ArrowRight size={20} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !canAccessDispensaries ? (
                      <div className="bg-brand-neutral/30 border-2 border-dashed border-brand-green-deep/10 rounded-[40px] p-12 text-center">
                         <div className="w-20 h-20 bg-brand-neutral rounded-full flex items-center justify-center mx-auto mb-6 text-brand-green-mid/30">
                             <ShoppingBag size={40} />
                          </div>
                         <h4 className="text-xl font-serif text-brand-green-deep mb-2">Acceso Restringido</h4>
                         <p className="text-brand-green-mid/60 text-sm max-w-xs mx-auto mb-8">Necesitas una receta activa antes de preparar una compra con medicina trazable. Agenda primero con un médico validado.</p>
                         <button 
                           onClick={() => switchView('doctors')}
                           className="px-8 py-4 bg-brand-green-deep text-brand-ivory rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-green-deep/20"
                         >
                            Buscar médico
                         </button>
                       </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.72fr]">
                          <div
                            onClick={() => setSelectedPrescription({
                              id: "TL-8829-QX",
                              doctor: "Dr. Alejandro Merino",
                              date: "29 Abr 2026",
                              validUntil: "29 Oct 2026",
                              treatment: "Cannabis Sativa L. (Flores secas)",
                              concentration: "THC 18%, CBD 2%",
                              dosage: "0.5g por via vaporizada cada 12hs",
                              notes: "Acompañamiento por dolor crónico lumbar. Control en 30 días."
                            })}
                            className="group cursor-pointer rounded-3xl border border-brand-green-deep/10 bg-white p-5 transition-all hover:border-brand-gold hover:shadow-md"
                          >
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                              <div className="flex items-start gap-4">
                                <div className="rounded-2xl bg-brand-neutral p-3 text-brand-green-deep transition-colors group-hover:bg-brand-gold/10 group-hover:text-brand-gold">
                                  <FileText size={24} />
                                </div>
                                <div>
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-bold uppercase tracking-widest text-brand-green-mid/45">Receta TL-8829-QX</p>
                                    <span className="flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-600">
                                      <Database size={10} /> ON-CHAIN
                                    </span>
                                    <span className="rounded-full bg-green-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-green-600">Vigente</span>
                                  </div>
                                  <h4 className="text-xl font-bold text-brand-green-deep">Tratamiento dolor crónico</h4>
                                  <p className="mt-1 text-sm text-brand-green-mid/70">Dr. Alejandro Merino - emitida hoy</p>
                                </div>
                              </div>
                              <ArrowRight size={20} className="hidden text-brand-green-mid/35 transition-colors group-hover:text-brand-gold lg:block" />
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                              {[
                                ['Dosis', '0.5g cada 12hs'],
                                ['Vigencia', 'Hasta 29 Oct 2026'],
                                ['Privacidad', 'Diagnostico no publico'],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl bg-brand-neutral/60 p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                                  <p className="mt-1 text-sm font-bold text-brand-green-deep">{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-3xl border border-brand-green-deep/10 bg-brand-neutral/40 p-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Uso de receta</p>
                            <h4 className="mt-2 text-xl font-serif text-brand-green-deep">Entregas parciales</h4>
                            <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
                              La receta no se quema en el primer retiro. Cada dispensario valida vigencia, identidad y cantidad entregada contra el saldo autorizado.
                            </p>
                            <div className="mt-5 grid grid-cols-2 gap-3">
                              <div className="rounded-2xl bg-white p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Autorizado</p>
                                <p className="mt-1 text-2xl font-bold text-brand-green-deep">30g</p>
                              </div>
                              <div className="rounded-2xl bg-white p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">Disponible</p>
                                <p className="mt-1 text-2xl font-bold text-brand-green-deep">20g</p>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-2">
                              <button
                                onClick={() => createPrivacyPermission('dispensary-prescription')}
                                className="w-full rounded-2xl border border-brand-gold/30 bg-white px-4 py-3 text-sm font-bold text-brand-green-deep"
                              >
                                Generar QR para dispensario
                              </button>
                              <button
                                onClick={() => switchView('dispensaries')}
                                className="w-full rounded-2xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory"
                              >
                                Buscar dispensario
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="hidden mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl items-center gap-3 text-blue-700 text-xs">
                          <Star size={14} fill="currentColor" />
                          <span>Receta validada para retiro fraccionado. El dispensario registra cada entrega semanal sin quemar todo el tratamiento.</span>
                        </div>
                        <div className="relative mb-8">
                           <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-green-mid/40" />
                           <input type="text" placeholder="Buscar dispensario o medicina..." className="w-full pl-12 pr-4 py-3 bg-brand-neutral rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {MOCK_DISPENSARIES.map(disp => (
                            <div key={`portal-dispensary-${disp.id}`} className="p-6 bg-brand-neutral/30 rounded-2xl border border-brand-green-deep/5">
                               <div className="flex justify-between items-start mb-4">
                                  <h4 className="font-bold text-brand-green-deep">{disp.name}</h4>
                                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${disp.status === 'Abierto' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {disp.status}
                                  </span>
                               </div>
                               <div className="space-y-2 mb-6">
                                  <div className="flex items-center gap-2 text-brand-gold bg-brand-gold/10 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest mb-2">
                                     <Star size={10} fill="currentColor" /> {t.portal.exclusiveBenefit}: {t.portal.discountLabel}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-brand-green-mid/60">
                                     <MapPin size={14} /> {disp.address} • {disp.distance}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-brand-green-mid/60">
                                     <Activity size={14} /> Stock: <span className="font-bold text-brand-green-deep">{disp.stock}</span>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => {
                                   setSelectedDispensary(disp);
                                   setDispensaryStep('inventory');
                                 }}
                                 className="w-full py-2 bg-brand-green-deep/5 border border-brand-green-deep/10 rounded-xl text-xs font-bold text-brand-green-deep hover:bg-brand-green-deep hover:text-white transition-all active:scale-95"
                               >
                                  Explorar Catálogo
                               </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
                
                  {activeView === 'prescriptions' && (
                    <motion.div 
                      key="view-prescriptions"
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                    {!hasPrescription ? (
                       <div className="bg-brand-neutral/30 border-2 border-dashed border-brand-green-deep/10 rounded-[40px] p-12 text-center">
                          <div className="w-20 h-20 bg-brand-neutral rounded-full flex items-center justify-center mx-auto mb-6 text-brand-green-mid/30">
                             <FileText size={40} />
                          </div>
                          <h4 className="text-xl font-serif text-brand-green-deep mb-2">Billetera de Recetas</h4>
                          <p className="text-brand-green-mid/60 text-sm max-w-xs mx-auto mb-8">Cuando un médico emita tu receta, aparecerá acá y podrás usarla en dispensarios.</p>
                          <button 
                            onClick={() => switchView('doctors')}
                            className="px-8 py-4 bg-brand-green-deep text-brand-ivory rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-green-deep/20"
                          >
                             Buscar medico
                          </button>
                       </div>
                    ) : (
                      <>
                        <div className="rounded-[32px] border border-green-100 bg-green-50 p-5 text-green-800">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-green-700">
                                <CheckCircle size={22} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-700/70">Receta recibida</p>
                                <h4 className="mt-1 text-xl font-bold text-brand-green-deep">Lista para presentar en dispensario autorizado</h4>
                                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-green-800/75">
                                  El dispensario valida vigencia, identidad y saldo disponible. No accede a tu diagnostico ni a la ficha clinica completa.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => createPrivacyPermission('dispensary-prescription')}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-white px-5 py-3 text-sm font-bold text-green-800 transition-all hover:border-green-300 active:scale-95"
                            >
                              Compartir QR receta
                              <ShieldCheck size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => switchView('dispensaries')}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-green-deep px-5 py-3 text-sm font-bold text-brand-ivory transition-all hover:bg-brand-green-mid active:scale-95"
                            >
                              Buscar dispensario
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3 text-blue-700 text-xs">
                      <Star size={14} fill="currentColor" />
                      <span>Este es un ejemplo de cómo verás tus recetas legales emitidas por nuestra red.</span>
                    </div>

                    {!!patientDashboard?.prescriptions.length && (
                      <div className="space-y-4">
                        {patientDashboard.prescriptions.map((prescription) => (
                          <button
                            key={`wallet-prescription-${prescription.id}`}
                            type="button"
                            onClick={() => openOnchainPrescription(prescription)}
                            className="group w-full cursor-pointer rounded-2xl border border-brand-green-deep/10 bg-white p-6 text-left transition-all hover:border-brand-gold hover:shadow-md"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-4">
                                <div className="rounded-xl bg-brand-neutral p-3 text-brand-green-deep transition-colors group-hover:bg-brand-gold/10 group-hover:text-brand-gold">
                                  <FileText size={24} />
                                </div>
                                <div>
                                  <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-bold uppercase tracking-widest text-brand-green-mid/40">
                                      Receta #{prescription.id}
                                    </p>
                                    <span className="flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">
                                      <Database size={10} /> {doctorSignerReady ? 'ON-CHAIN' : 'DEMO HASH'}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-brand-green-deep">
                                    {prescription.status === 'active' ? 'Receta vigente' : prescription.status === 'used' ? 'Receta usada' : 'Receta expirada'}
                                  </h4>
                                  <p className="text-sm text-brand-green-mid/70">
                                    {shortenAddress(prescription.doctor, 6)} · {formatPortalDate(prescription.issuedAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-4 sm:justify-end">
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                                  prescription.status === 'active'
                                    ? 'bg-green-50 text-green-600'
                                    : prescription.status === 'used'
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {prescription.status === 'active' ? 'Vigente' : prescription.status}
                                </span>
                                <ArrowRight size={20} className="text-brand-green-mid/40 transition-colors group-hover:text-brand-gold" />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div 
                      onClick={() => setSelectedPrescription({
                        id: "TL-8829-QX",
                        doctor: "Dr. Alejandro Merino",
                        date: "29 Abr 2026",
                        validUntil: "29 Oct 2026",
                        treatment: "Cannabis Sativa L. (Flores secas)",
                        concentration: "THC 18%, CBD 2%",
                        dosage: "0.5g p/vía vaporizada cada 12hs",
                        notes: "Acompañamiento por dolor crónico lumbar. Control en 30 días."
                      })}
                      className={`${patientDashboard?.prescriptions.length ? 'hidden' : 'group'} cursor-pointer p-6 bg-white border border-brand-green-deep/10 rounded-2xl hover:border-brand-gold hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-center gap-4`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-neutral rounded-xl text-brand-green-deep group-hover:bg-brand-gold/10 group-hover:text-brand-gold transition-colors">
                          <FileText size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-bold text-brand-green-mid/40 uppercase tracking-widest">ID: TL-8829-QX</p>
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-[9px] text-blue-600 font-bold border border-blue-100 rounded-md">
                              <Database size={10} /> ON-CHAIN
                            </span>
                          </div>
                          <h4 className="font-bold text-brand-green-deep">Tratamiento Dolor Crónico</h4>
                          <p className="text-sm text-brand-green-mid/70">Dr. Alejandro Merino • Emitida Hoy</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">Vigente</span>
                        <div className="p-2 text-brand-green-mid/40 group-hover:text-brand-gold transition-colors">
                          <ArrowRight size={20} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
                </motion.div>
                )}

                {activeView === 'pickups' && (
                  <motion.div 
                    key="view-pickups"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    {pickupStep === 'idle' ? (
                      <>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">Billetera de Medicamentos</p>
                            <h3 className="text-3xl md:text-4xl font-serif text-brand-green-deep">Retiros Activos</h3>
                          </div>
                        </div>

                        {activePickups.length === 0 ? (
                          <div className="bg-white border-2 border-dashed border-brand-green-deep/10 rounded-[40px] p-12 text-center">
                             <div className="w-20 h-20 bg-brand-neutral rounded-full flex items-center justify-center mx-auto mb-6 text-brand-green-mid/30">
                                <Package size={40} />
                             </div>
                             <h4 className="text-xl font-serif text-brand-green-deep mb-2">No hay retiros pendientes</h4>
                             <p className="text-brand-green-mid/60 text-sm max-w-xs mx-auto">Cuando adquieras una medicina en un dispensario, aquí aparecerá tu token de retiro.</p>
                             <button onClick={() => switchView('dispensaries')} className="mt-8 text-sm font-bold text-brand-gold uppercase tracking-widest hover:underline">Ver dispensarios cercanos</button>
                          </div>
                        ) : (
                          <>
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                            <div className="rounded-3xl bg-brand-green-deep p-5 text-brand-ivory lg:col-span-1">
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Retiros pendientes</p>
                              <p className="mt-2 text-4xl font-bold">{activePickups.length}</p>
                              <p className="mt-2 text-sm text-brand-ivory/60">Tokens listos para presentar en dispensario. No exponen diagnóstico ni notas clínicas.</p>
                            </div>
                            <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-5 lg:col-span-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Saldo de receta</p>
                              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {[
                                  ['Autorizado', `${prescriptionMonthlyLimitGrams}g`],
                                  ['Retirado', `${prescriptionUsedGrams}g`],
                                  ['Disponible', `${prescriptionRemainingGrams}g`],
                                  ['Vigencia', '29 Oct'],
                                ].map(([label, value]) => (
                                  <div key={label} className="rounded-2xl bg-brand-neutral/60 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                                    <p className="mt-1 text-lg font-bold text-brand-green-deep">{value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {activePickups.map((pickup) => (
                              <div key={`compact-${pickup.id}`} className="rounded-3xl border border-brand-green-deep/10 bg-white p-5 shadow-sm">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                  <div className="flex items-start gap-4">
                                    <div className="rounded-2xl bg-brand-neutral p-3 text-brand-green-deep">
                                      <Package size={22} />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">{pickup.dispensary.name}</p>
                                      <h4 className="mt-1 text-xl font-bold text-brand-green-deep">{pickup.strain.name}</h4>
                                      <p className="mt-1 text-sm text-brand-green-mid/65">Entrega parcial autorizada - {pickup.expires}</p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
                                    <div className="rounded-2xl bg-brand-neutral/60 px-4 py-3">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/45">Token</p>
                                      <p className="font-mono text-xs font-bold text-brand-green-deep">{pickup.token}</p>
                                    </div>
                                    <div className="rounded-2xl bg-brand-neutral/60 px-4 py-3">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/45">Estado</p>
                                      <p className="text-xs font-bold text-green-600">Validado</p>
                                    </div>
                                    <button
                                      onClick={() => handleStartPickup(pickup)}
                                      className="col-span-2 rounded-2xl bg-brand-green-deep px-5 py-3 text-sm font-bold text-brand-ivory sm:col-span-1"
                                    >
                                      Mostrar token
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="hidden grid-cols-1 md:grid-cols-2 gap-6">
                             {activePickups.map((pickup) => (
                               <div key={pickup.id} className="bg-brand-green-deep rounded-[40px] p-8 text-brand-ivory shadow-2xl relative overflow-hidden flex flex-col min-h-[460px]">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                  
                                  <div className="flex justify-between mb-8 relative z-10">
                                     <div>
                                        <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">{pickup.dispensary.name}</span>
                                        <h4 className="text-2xl font-serif">{pickup.strain.name}</h4>
                                     </div>
                                     <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-brand-gold">
                                        <ShieldCheck size={24} />
                                     </div>
                                  </div>

                                  <div className="bg-white rounded-3xl p-6 mb-8 flex flex-col items-center">
                                     <div className="w-full aspect-square bg-brand-neutral rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden">
                                        <div className="absolute inset-0 p-4">
                                          <div className="w-full h-full border-4 border-brand-green-deep/5 rounded-lg flex flex-col items-center justify-center p-4">
                                            <div className="grid grid-cols-3 gap-1 opacity-20">
                                              {[...Array(9)].map((_, i) => (
                                                <div key={i} className="w-4 h-4 bg-brand-green-deep rounded-sm"></div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                        <Database size={60} className="text-brand-green-deep/10" />
                                     </div>
                                     <p className="font-mono text-[10px] text-brand-green-deep/40 uppercase tracking-tighter mb-1">TOKEN DE RED</p>
                                     <p className="font-mono text-xs text-brand-green-deep font-bold tracking-widest">{pickup.token}</p>
                                  </div>

                                  <div className="space-y-4 mb-8 relative z-10">
                                     <div className="flex justify-between items-center text-xs border-b border-white/10 pb-3">
                                        <span className="opacity-40">Estado de Red</span>
                                        <span className="text-brand-gold font-bold flex items-center gap-1">
                                           <Activity size={12} /> Validado por Nodo
                                        </span>
                                     </div>
                                     <div className="flex justify-between items-center text-xs">
                                        <span className="opacity-40">Validez</span>
                                        <span className="font-medium text-brand-gold">{pickup.expires}</span>
                                     </div>
                                  </div>

                                  <div className="mt-auto relative z-10">
                                     <button 
                                      onClick={() => handleStartPickup(pickup)}
                                      className="w-full py-4 bg-brand-gold text-brand-green-deep rounded-2xl font-bold shadow-xl active:scale-95 transition-transform"
                                     >
                                        Mostrar al Dispensario
                                     </button>
                                     <p className="text-[9px] text-center mt-3 opacity-40 uppercase tracking-widest">Hash: 0x{pickup.token.toLowerCase()}...3a2f</p>
                                  </div>
                               </div>
                             ))}
                          </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="max-w-md mx-auto py-12">
                        <AnimatePresence mode="wait">
                          {pickupStep === 'scanning' && (
                            <motion.div 
                              key="step-scanning"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 1.05 }}
                              className="text-center"
                            >
                               <div className="relative w-48 h-48 mx-auto mb-8">
                                  <div className="absolute inset-0 bg-brand-gold/10 rounded-[40px] animate-pulse"></div>
                                  <div className="absolute inset-4 border-2 border-brand-gold/30 rounded-3xl flex items-center justify-center">
                                     <Database size={48} className="text-brand-gold animate-bounce" />
                                  </div>
                                  <motion.div 
                                    className="absolute top-0 left-0 right-0 h-1 bg-brand-gold shadow-[0_0_15px_rgba(212,175,55,0.8)] z-20"
                                    animate={{ top: ['0%', '100%', '0%'] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                  />
                               </div>
                               <h4 className="text-2xl font-serif text-brand-green-deep mb-2">Escaneando Token</h4>
                               <p className="text-brand-green-mid/60 text-sm">El dispensario está sincronizando con su billetera...</p>
                            </motion.div>
                          )}

                          {pickupStep === 'verifying' && (
                            <motion.div 
                              key="step-verifying"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 1.05 }}
                              className="text-center"
                            >
                               <div className="w-24 h-24 bg-brand-green-deep/5 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                                  <Activity size={32} className="text-brand-gold animate-spin-slow" />
                                  <div className="absolute inset-0 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
                               </div>
                               <h4 className="text-2xl font-serif text-brand-green-deep mb-2">Verificando en Red</h4>
                               <p className="text-brand-green-mid/60 text-sm mb-8">Validando contrato inteligente y reserva de stock...</p>
                               
                               <div className="space-y-3 max-w-xs mx-auto">
                                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/40">
                                     <span>Nodo de Red</span>
                                     <span className="text-brand-green-deep">Mendoza-West-04</span>
                                  </div>
                                  <div className="w-full h-1 bg-brand-green-deep/5 rounded-full overflow-hidden">
                                     <motion.div 
                                      className="h-full bg-brand-gold"
                                      initial={{ width: 0 }}
                                      animate={{ width: '100%' }}
                                      transition={{ duration: 3 }}
                                     />
                                  </div>
                               </div>
                            </motion.div>
                          )}

                          {pickupStep === 'success' && (
                            <motion.div 
                              key="step-success-final"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="text-center"
                            >
                               <div className="w-24 h-24 bg-brand-green-deep text-brand-gold rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                                  <CheckCircle size={48} />
                               </div>
                               <h4 className="text-3xl font-serif text-brand-green-deep mb-4">Retiro Completado</h4>
                               <p className="text-brand-green-mid/70 text-sm mb-10 px-6">
                                  La medicina ha sido entregada exitosamente. La transacción ha sido registrada en el historial de su receta.
                               </p>
                               
                               <div className="bg-white border border-brand-green-deep/5 rounded-3xl p-6 mb-10 text-left">
                                  <div className="flex justify-between mb-4">
                                     <span className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest">Medicina</span>
                                     <span className="text-sm font-bold text-brand-green-deep">{processingPickup?.strain.name}</span>
                                  </div>
                                  <div className="flex justify-between">
                                     <span className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest">Dispensario</span>
                                     <span className="text-sm font-bold text-brand-green-deep">{processingPickup?.dispensary.name}</span>
                                  </div>
                               </div>

                               <button 
                                onClick={() => {
                                  setPickupStep('idle');
                                  setProcessingPickup(null);
                                  switchView('overview');
                                }}
                                className="w-full py-4 bg-brand-green-deep text-brand-ivory rounded-2xl font-bold shadow-xl"
                               >
                                  Volver al Panel
                               </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeView === 'history' && (
                  <motion.div 
                    key="view-history"
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                      <div>
                        <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">Expediente privado</p>
                        <h3 className="text-3xl md:text-4xl font-serif text-brand-green-deep">Historial del Paciente</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="cursor-pointer rounded-xl bg-brand-green-deep px-4 py-3 text-xs font-bold text-brand-ivory shadow-sm transition-all active:scale-95 flex items-center gap-2">
                          <Upload size={15} />
                          Subir examen
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(event) => {
                              handleClinicalExamUpload(event.target.files);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        <div className="bg-brand-neutral px-4 py-2 rounded-xl border border-brand-green-deep/5 flex items-center gap-2">
                          <Database size={16} className="text-brand-gold" />
                          <span className="text-xs font-bold text-brand-green-deep uppercase tracking-tighter">Blockchain Sync: OK</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-brand-green-deep rounded-[32px] p-6 md:p-8 text-brand-ivory">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-6">
                        <div>
                          <p className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em] mb-2">Agente 402 privado</p>
                          <h4 className="text-2xl md:text-3xl font-serif">Resumen clínico portable</h4>
                          <p className="mt-2 text-sm text-brand-ivory/65 max-w-2xl">
                            Síntomas, exámenes y respaldos quedan cifrados. En otro país el médico recibe pruebas verificables y documentos autorizados por el paciente, no datos abiertos por defecto.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 min-w-[220px]">
                          <p className="text-[10px] uppercase tracking-widest text-brand-ivory/50 font-bold">Modo de acceso</p>
                          <p className="mt-1 text-sm font-bold text-brand-gold">Consentimiento temporal</p>
                          <p className="mt-2 text-xs text-brand-ivory/55">Lectura limitada, auditada y revocable.</p>
                          <button
                            onClick={() => setSelectedClinicalRecord(portableClinicalDossier[0])}
                            className="mt-4 w-full rounded-xl bg-brand-gold px-4 py-3 text-xs font-bold text-brand-green-deep"
                          >
                            Compartir con médico
                          </button>
                          <button
                            onClick={() => {
                              setSelectedClinicalRecord(portableClinicalDossier.find((record) => record.id === 'exams') ?? PRIVATE_CLINICAL_DOSSIER[1]);
                              setShowClinicalGallery(true);
                            }}
                            className="mt-2 w-full rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-brand-ivory"
                          >
                            Ver examenes
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {portableClinicalDossier.map((record) => (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() => {
                              setSelectedClinicalRecord(record);
                              setShowClinicalGallery(record.id === 'exams');
                            }}
                            className="text-left rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <FileText size={18} className="text-brand-gold" />
                              <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-brand-ivory/70">
                                {record.status}
                              </span>
                            </div>
                            <h5 className="text-sm font-bold text-brand-ivory">{record.title}</h5>
                            <p className="mt-2 text-xs leading-relaxed text-brand-ivory/55">{record.summary}</p>
                            <p className="mt-4 text-[10px] font-mono text-brand-gold">{record.proof}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-brand-green-deep/10 bg-white p-5 md:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">Permisos activos</p>
                          <h4 className="mt-1 text-2xl font-serif text-brand-green-deep">Contratos privados del paciente</h4>
                          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-green-mid/65">
                            Tu historial y receta se comparten por ventanas temporales. El QR nunca contiene datos clinicos: solo una referencia revocable, alcance y prueba verificable.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => createPrivacyPermission('medical-consultation')}
                            className="rounded-xl bg-brand-green-deep px-4 py-3 text-xs font-bold text-brand-ivory"
                          >
                            Compartir con medico
                          </button>
                          <button
                            type="button"
                            onClick={() => createPrivacyPermission('dispensary-prescription')}
                            className="rounded-xl border border-brand-gold/30 bg-[#fbf7ef] px-4 py-3 text-xs font-bold text-brand-green-deep"
                          >
                            Compartir receta con dispensario
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {privacyPermissions.length ? (
                          privacyPermissions.map((permission) => (
                            <div key={permission.id} className="rounded-2xl border border-brand-green-deep/10 bg-brand-neutral/35 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/45">{permission.role}</p>
                                  <h5 className="mt-1 text-base font-bold text-brand-green-deep">{permission.actor}</h5>
                                  <p className="mt-2 text-xs leading-relaxed text-brand-green-mid/60">{permission.scope}</p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${
                                  permission.status === 'active'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-red-50 text-red-700'
                                }`}>
                                  {permission.status === 'active' ? 'Activo' : 'Revocado'}
                                </span>
                              </div>
                              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="rounded-xl bg-white px-3 py-2">
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/45">Expira</p>
                                  <p className="mt-1 text-xs font-bold text-brand-green-deep">{permission.expiresAt}</p>
                                </div>
                                <div className="rounded-xl bg-white px-3 py-2">
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/45">Prueba</p>
                                  <p className="mt-1 font-mono text-[10px] text-brand-green-deep">{permission.hash}</p>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() => setSelectedQrPermission(permission)}
                                  className="flex-1 rounded-xl bg-brand-green-deep px-4 py-2.5 text-xs font-bold text-brand-ivory disabled:opacity-45"
                                  disabled={permission.status !== 'active'}
                                >
                                  Mostrar QR
                                </button>
                                <button
                                  type="button"
                                  onClick={() => revokePrivacyPermission(permission.id)}
                                  className="flex-1 rounded-xl border border-brand-green-deep/10 px-4 py-2.5 text-xs font-bold text-brand-green-deep"
                                >
                                  Revocar
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-brand-green-deep/10 bg-brand-neutral/30 p-5 lg:col-span-2">
                            <p className="text-sm text-brand-green-mid/65">
                              Aun no hay permisos activos. Genera uno para que un medico valide la consulta o para que un dispensario lea solo receta y saldo.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-4">
                      <div>
                        <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">Registros inmutables</p>
                        <h4 className="text-2xl font-serif text-brand-green-deep">Retiros y trazabilidad</h4>
                      </div>
                    </div>

                    {dispenseRecords.length > 0 && (
                      <div className="space-y-4">
                        {dispenseRecords.map((record, idx) => (
                          <motion.div
                            key={`dispense-record-${record.id}`}
                            onClick={() => setSelectedTraceRecord({
                              title: `Receta #${record.prescriptionId}`,
                              subtitle: `Dispensa #${record.id}`,
                              product: record.productHash,
                              batch: record.batchHash,
                              quantity: `${record.quantity}g`,
                              dispensary: shortenAddress(record.dispensary, 8),
                              txHash: record.txHash,
                              ledger: record.recordedLedger,
                              date: formatPortalDate(record.recordedAt),
                            })}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white border border-brand-green-deep/5 rounded-3xl p-6 hover:shadow-md transition-shadow group cursor-pointer"
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="w-12 h-12 bg-brand-neutral rounded-2xl flex items-center justify-center text-brand-green-deep group-hover:bg-brand-green-deep group-hover:text-brand-ivory transition-all shrink-0">
                                  <Database size={20} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest leading-none">
                                      Dispensa #{record.id}
                                    </span>
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded-full border border-blue-100">
                                      ON-CHAIN
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-brand-green-deep text-base sm:text-lg leading-none mb-1">
                                    Receta #{record.prescriptionId} retiro parcial
                                  </h4>
                                  <p className="text-[11px] text-brand-green-mid/70 truncate">
                                    {shortenAddress(record.dispensary, 6)} - {formatPortalDate(record.recordedAt)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-col sm:items-end w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-brand-green-deep/5 gap-2">
                                <div className="flex justify-between sm:block text-right">
                                  <p className="sm:text-lg font-bold text-brand-green-deep">{record.quantity}g</p>
                                  <p className="text-[10px] text-brand-green-mid/40 font-bold uppercase tracking-tighter sm:mt-0.5">
                                    Red #{record.recordedLedger}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 bg-brand-neutral/50 px-3 py-1.5 rounded-lg border border-brand-green-deep/5">
                                  <Database size={10} className="text-brand-gold" />
                                  <span className="font-mono text-[9px] text-brand-green-mid/60 truncate max-w-[80px]">
                                    {shortenHash(record.txHash, 6)}
                                  </span>
                                  <ArrowRight size={10} className="text-brand-gold" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {dispenseRecords.length === 0 && patientTraceablePickups.length > 0 && (
                      <div className="space-y-4">
                        {patientTraceablePickups.map((pickup, idx) => (
                          <motion.div
                            key={`local-dispense-record-${pickup.id}`}
                            onClick={() => openPickupTraceability(pickup)}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className="bg-white border border-brand-green-deep/5 rounded-3xl p-6 hover:shadow-md transition-shadow group cursor-pointer"
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="w-12 h-12 bg-brand-neutral rounded-2xl flex items-center justify-center text-brand-green-deep group-hover:bg-brand-green-deep group-hover:text-brand-ivory transition-all shrink-0">
                                  <ShoppingBag size={20} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest leading-none">
                                      Retiro parcial
                                    </span>
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded-full border border-amber-100">
                                      PERMISO PRIVADO
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-brand-green-deep text-base sm:text-lg leading-none mb-1">
                                    {pickup.strain?.name ?? 'Producto medicinal'}
                                  </h4>
                                  <p className="text-[11px] text-brand-green-mid/70 truncate">
                                    {pickup.dispensary?.name ?? 'Dispensario autorizado'} - receta {pickup.token ?? `#${resolvedPrescriptionId}`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-col sm:items-end w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-brand-green-deep/5 gap-2">
                                <div className="flex justify-between sm:block text-right">
                                  <p className="sm:text-lg font-bold text-brand-green-deep">{pickup.quantity}g</p>
                                  <p className="text-[10px] text-brand-green-mid/40 font-bold uppercase tracking-tighter sm:mt-0.5">
                                    Entrega fraccionada
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 bg-brand-neutral/50 px-3 py-1.5 rounded-lg border border-brand-green-deep/5">
                                  <Database size={10} className="text-brand-gold" />
                                  <span className="font-mono text-[9px] text-brand-green-mid/60 truncate max-w-[90px]">
                                    {shortenHash(pickup.token ?? pickup.id, 8)}
                                  </span>
                                  <ArrowRight size={10} className="text-brand-gold" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-4">
                      {dispenseRecords.length === 0 && patientTraceablePickups.length === 0 && MOCK_ORDERS.map((order, idx) => (
                        <motion.div 
                          key={order.id}
                          onClick={() => setSelectedTraceRecord({
                            title: order.item,
                            subtitle: `Orden #${order.id}`,
                            product: order.item,
                            batch: order.hash,
                            quantity: order.amount,
                            dispensary: order.dispensary,
                            txHash: order.hash,
                            ledger: 'Demo ledger',
                            date: order.date,
                          })}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="bg-white border border-brand-green-deep/5 rounded-3xl p-6 hover:shadow-md transition-shadow group cursor-pointer"
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                              <div className="w-12 h-12 bg-brand-neutral rounded-2xl flex items-center justify-center text-brand-green-deep group-hover:bg-brand-green-deep group-hover:text-brand-ivory transition-all shrink-0">
                                <ShoppingBag size={20} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest leading-none">Orden #{order.id}</span>
                                  <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[9px] font-bold rounded-full border border-green-100">{order.status}</span>
                                </div>
                                <h4 className="font-bold text-brand-green-deep text-base sm:text-lg leading-none mb-1">{order.item}</h4>
                                <p className="text-[11px] text-brand-green-mid/70 truncate">{order.dispensary} • {order.date}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:items-end w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-brand-green-deep/5 gap-2">
                              <div className="flex justify-between sm:block text-right">
                                <p className="sm:text-lg font-bold text-brand-green-deep">{order.price}</p>
                                <p className="text-[10px] text-brand-green-mid/40 font-bold uppercase tracking-tighter sm:mt-0.5">Cant: {order.amount}</p>
                              </div>
                              <div className="flex items-center gap-2 bg-brand-neutral/50 px-3 py-1.5 rounded-lg border border-brand-green-deep/5">
                                <Database size={10} className="text-brand-gold" />
                                <span className="font-mono text-[9px] text-brand-green-mid/60 truncate max-w-[80px]">{order.hash}</span>
                                <ArrowRight size={10} className="text-brand-gold" />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-12 p-8 bg-brand-neutral/30 rounded-[40px] border border-dashed border-brand-green-deep/10 text-center">
                       <p className="text-xs text-brand-green-mid/50 font-medium max-w-sm mx-auto">
                         Trust Leaf utiliza tecnología blockchain para asegurar que cada gramo de medicina sea rastreable desde el cultivo hasta sus manos. Esta información es auditable y protege su derecho al acceso legal.
                       </p>
                    </div>
                  </motion.div>
                )}

                {activeView === 'traveler' && (
                  <motion.div 
                    key="view-traveler"
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="space-y-4 md:space-y-8"
                  >
                    {regionStep === 'regions' && (
                      <>
                        <div className="bg-[#0A2619] rounded-[32px] md:rounded-[48px] p-6 md:p-12 text-brand-ivory relative overflow-hidden border border-white/5">
                           <div className="relative z-10 max-w-xl">
                              <div className="flex items-center gap-2 mb-6">
                                 <span className="w-8 h-[1px] bg-brand-gold"></span>
                                 <p className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.3em] leading-none">Global Health Identity</p>
                              </div>
                              <h3 className="text-3xl md:text-5xl font-serif mb-6 leading-[1.1]">Tu salud no tiene fronteras.</h3>
                              <p className="text-sm md:text-base text-brand-ivory/60 mb-10 leading-relaxed">Activa una credencial médica privada para presentar receta vigente, identidad y evidencia mínima en destinos compatibles.</p>
                              
                              <button 
                                onClick={() => setTravelerActive(!travelerActive)}
                                className={`group relative px-8 py-4 rounded-2xl font-bold transition-all duration-500 overflow-hidden ${
                                  travelerActive 
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                                    : 'bg-brand-gold text-brand-green-deep hover:shadow-[0_0_30px_rgba(196,160,82,0.3)]'
                                }`}
                              >
                                 <div className="relative z-10 flex items-center gap-3">
                                   {travelerActive ? (
                                     <> <CheckCircle size={20} className="text-green-400" /> Credencial activa </>
                                   ) : (
                                     <> <Globe size={20} className="group-hover:rotate-12 transition-transform" /> Activar credencial </>
                                   )}
                                 </div>
                                 {!travelerActive && <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>}
                              </button>
                           </div>
                           <div className="absolute top-1/2 -right-20 -translate-y-1/2 w-[400px] h-[400px] bg-brand-gold/5 rounded-full blur-[100px]"></div>
                           <Globe size={300} className="absolute -right-20 -bottom-20 text-white/[0.03] rotate-12 hidden md:block" />
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                           <div>
                              <h4 className="text-xl md:text-2xl font-serif text-brand-green-deep">Destinos Soportados</h4>
                              <p className="text-xs text-brand-green-mid/50 uppercase tracking-widest mt-1">Acuerdos bilaterales de salud 2024</p>
                           </div>
                           <div className="flex flex-wrap gap-2">
                              {['Todos', 'América', 'Europa', 'Oceanía'].map(tab => (
                                 <button 
                                   key={tab} 
                                   onClick={() => setRegionFilter(tab as any)}
                                   className={`px-4 py-2 rounded-full text-[10px] font-bold border transition-all ${
                                     regionFilter === tab 
                                       ? 'bg-brand-green-deep text-white border-brand-green-deep' 
                                       : 'border-brand-green-deep/5 text-brand-green-mid/60 hover:bg-brand-neutral'
                                   }`}
                                 >
                                    {tab}
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                           {MOCK_GLOBAL_REGIONS.filter(r => regionFilter === 'Todos' || r.continent === regionFilter).map((region) => (
                              <div key={region.id} className="bg-white border border-brand-green-deep/5 rounded-[28px] p-6 hover:border-brand-gold/20 hover:shadow-2xl hover:shadow-brand-green-deep/5 transition-all group flex flex-col h-full">
                                 <div className="flex items-center justify-between mb-6">
                                    <div className="w-14 h-14 bg-brand-neutral rounded-[20px] flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform">
                                       {region.flag}
                                    </div>
                                    <div className="flex flex-col items-end">
                                       <span className="text-[10px] font-extrabold text-brand-gold uppercase tracking-tighter mb-1">Status</span>
                                       <span className="px-2 py-0.5 bg-brand-green-deep/5 text-brand-green-deep text-[9px] font-bold rounded-full border border-brand-green-deep/10">
                                          {region.status}
                                       </span>
                                    </div>
                                 </div>

                                 <h4 className="text-xl font-bold text-brand-green-deep mb-2">{region.country}</h4>
                                 <p className="text-[13px] text-brand-green-mid/70 leading-relaxed mb-6 flex-grow">{region.description}</p>
                                 
                                 <div className="space-y-4 mb-8">
                                    <div className="flex items-center gap-2 mb-1">
                                       <FileText size={12} className="text-brand-gold" />
                                       <span className="text-[10px] font-extrabold text-brand-green-mid/40 uppercase tracking-widest">Requisitos Clave</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                       {region.requirements.map((req, i) => (
                                          <span key={i} className="px-3 py-1 bg-brand-neutral rounded-lg text-[10px] text-brand-green-deep font-semibold">
                                             {req}
                                          </span>
                                       ))}
                                    </div>
                                 </div>

                                 <button 
                                   disabled={!travelerActive}
                                   onClick={() => {
                                     setSelectedRegion(region);
                                     setRegionStep('dispensaries');
                                   }}
                                   className={`w-full py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                     travelerActive 
                                       ? 'bg-brand-green-deep text-brand-ivory hover:bg-brand-green-mid shadow-lg' 
                                       : 'bg-brand-neutral text-brand-green-mid/30 cursor-not-allowed opacity-50'
                                   }`}
                                 >
                                    Explorar Clubes & Shops <ArrowRight size={14} />
                                 </button>
                              </div>
                           ))}
                        </div>
                      </>
                    )}

                    {regionStep === 'dispensaries' && selectedRegion && (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                           <button 
                             onClick={() => setRegionStep('regions')} 
                             className="group flex items-center gap-2 px-4 py-2 rounded-full bg-brand-neutral hover:bg-brand-green-deep hover:text-white transition-all text-xs font-bold text-brand-green-deep uppercase tracking-tighter"
                           >
                              <ArrowRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" /> Regiones Globales
                           </button>
                           
                           <div className="flex items-center gap-3">
                              <span className="text-2xl">{selectedRegion.flag}</span>
                              <div className="h-8 w-[1px] bg-brand-green-deep/10"></div>
                              <span className="text-xs font-bold text-brand-green-mid/40 uppercase tracking-widest">Sincronizado vía {selectedRegion.partner}</span>
                           </div>
                        </div>

                        <div className="bg-white rounded-[32px] md:rounded-[40px] border border-brand-green-deep/5 p-8 md:p-12 relative overflow-hidden">
                           <div className="relative z-10">
                              <h4 className="text-2xl md:text-5xl font-serif text-brand-green-deep mb-4 leading-tight">Aliados en {selectedRegion.country}</h4>
                              <p className="text-sm md:text-base text-brand-green-mid/70 max-w-2xl">
                                Todos los establecimientos listados a continuación han completado la integración con Trust Leaf. Su historial de salud y receta digital será verificado automáticamente al ingresar con su código QR.
                              </p>
                           </div>
                           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                           {MOCK_GLOBAL_DISPENSARIES[selectedRegion.id]?.map((disp) => (
                              <div key={disp.id} className="bg-white border border-brand-green-deep/5 rounded-[28px] p-6 hover:shadow-2xl transition-all group flex flex-col md:flex-row items-center gap-6">
                                 <div className="w-24 h-24 bg-brand-neutral rounded-[20px] flex items-center justify-center text-brand-green-deep/20 shrink-0 group-hover:scale-105 transition-transform">
                                    <ShoppingBag size={40} />
                                 </div>
                                 
                                 <div className="flex-1 w-full text-center md:text-left">
                                    <div className="flex items-center justify-center md:justify-between mb-2">
                                       <h5 className="text-xl font-bold text-brand-green-deep">{disp.name}</h5>
                                       <div className="flex items-center gap-2 px-3 py-1 bg-brand-gold/10 text-brand-gold rounded-full text-[10px] font-bold">
                                          <Star size={12} fill="currentColor" /> {t.portal.discountLabel}
                                       </div>
                                       <div className="hidden md:flex items-center gap-1 text-brand-gold bg-brand-gold/5 px-2 py-0.5 rounded-full">
                                          <Star size={12} fill="currentColor" />
                                          <span className="text-[10px] font-extrabold">{disp.rating}</span>
                                       </div>
                                    </div>
                                    
                                    <p className="text-xs text-brand-green-mid/60 flex items-center justify-center md:justify-start gap-1 mb-4">
                                       <MapPin size={12} /> {disp.address}
                                    </p>
                                    
                                    <div className="flex items-center justify-center md:justify-between gap-4">
                                       <span className="text-[10px] font-bold text-brand-green-mid/30 uppercase tracking-[0.2em]">{disp.distance}</span>
                                       <button 
                                         onClick={() => {
                                           setSelectedDispensary(disp);
                                           setRegionStep('inventory');
                                         }}
                                         className="px-6 py-2 bg-brand-green-deep text-brand-ivory rounded-xl text-xs font-bold hover:bg-brand-gold hover:text-brand-green-deep transition-all shadow-md active:scale-95"
                                       >
                                          Abrir Inventario
                                       </button>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                      </motion.div>
                    )}

                    {regionStep === 'inventory' && selectedDispensary && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                           <button onClick={() => setRegionStep('dispensaries')} className="group flex items-center gap-2 px-4 py-2 rounded-full bg-brand-neutral hover:bg-brand-green-deep hover:text-white transition-all text-xs font-bold text-brand-green-deep uppercase tracking-tighter w-fit">
                              <ArrowRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" /> Clubes Regionales
                           </button>
                           
                           <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-100">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Precios & Stock en Tiempo Real</span>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                           {selectedDispensary.inventory?.map((strain: any) => (
                              <div key={strain.id} className="bg-white border border-brand-green-deep/5 rounded-[32px] p-6 md:p-10 hover:shadow-2xl transition-all group relative flex flex-col md:flex-row gap-8">
                                 <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-6">
                                       <span className="text-[10px] font-extrabold text-brand-gold uppercase tracking-[0.2em]">Cepa Validada</span>
                                       <div className="h-4 w-[1px] bg-brand-green-deep/10"></div>
                                       <span className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest">{strain.type}</span>
                                    </div>
                                    
                                    <h4 className="text-3xl md:text-4xl font-serif text-brand-green-deep mb-2">{strain.name}</h4>
                                    <div className="flex items-center gap-4 mb-6">
                                       <div>
                                          <p className="text-[9px] font-bold text-brand-green-mid/30 uppercase tracking-widest leading-none mb-1">Potencia</p>
                                          <p className="font-bold text-brand-gold">{strain.thc} THC</p>
                                       </div>
                                       <div className="w-px h-6 bg-brand-green-deep/10"></div>
                                       <div>
                                          <p className="text-[9px] font-bold text-brand-green-mid/30 uppercase tracking-widest leading-none mb-1">Origen</p>
                                          <p className="font-bold text-brand-green-deep">{selectedRegion?.country}</p>
                                       </div>
                                    </div>
                                    
                                    <div className="space-y-4 mb-8">
                                       <div className="p-4 bg-brand-neutral rounded-[20px] border border-brand-green-deep/5">
                                          <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest mb-1">Perfil Terpénico</p>
                                          <p className="text-[13px] text-brand-green-deep font-medium italic">{strain.terpenes}</p>
                                       </div>
                                       <div className="flex items-center gap-2 pl-2">
                                          <CheckCircle size={14} className="text-brand-gold" />
                                          <p className="text-xs text-brand-green-mid/70">{strain.effects}</p>
                                       </div>
                                    </div>

                                    <button 
                                      onClick={(e) => { e.stopPropagation(); addToCart(strain); }}
                                      className={`w-full py-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-3 transition-all ${
                                        cart.find(c => c.strain.id === strain.id) 
                                          ? 'bg-brand-green-deep text-brand-ivory shadow-lg' 
                                          : 'bg-brand-gold text-brand-green-deep hover:bg-[#D5B05E] shadow-xl'
                                      }`}
                                    >
                                       {cart.find(c => c.strain.id === strain.id) ? (
                                         <> <CheckCircle size={18} /> En Reserva Global ({cart.find(c => c.strain.id === strain.id).quantity}g) </>
                                       ) : (
                                         <> <ShoppingBag size={18} /> Añadir a la Bolsa Global </>
                                       )}
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>

                        {cart.length > 0 && (
                          <div className="sticky bottom-4 w-full z-[200]">
                             <div className="bg-brand-green-deep p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-32 h-32 bg-brand-gold/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                                <div className="relative z-10 text-center md:text-left">
                                   <p className="text-[10px] font-extrabold text-brand-gold uppercase tracking-[0.3em] mb-2">Checkout Internacional</p>
                                   <p className="text-2xl md:text-3xl font-serif text-brand-ivory tracking-tight">{cart.reduce((a, b) => a + b.quantity, 0)}g Reservados en {selectedRegion?.country}</p>
                                </div>
                                <button 
                                  onClick={() => {
                                    setDispensaryStep('confirm');
                                    switchView('dispensaries');
                                  }}
                                  className="relative z-10 w-full md:w-auto px-10 py-5 bg-brand-gold text-brand-green-deep rounded-2xl font-extrabold text-base hover:scale-[1.03] transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(196,160,82,0.4)]"
                                >
                                   Confirmar Reserva <ArrowRight size={20} />
                                </button>
                             </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    <div className="p-6 md:p-10 bg-brand-neutral rounded-[32px] border border-brand-green-deep/5 flex flex-col md:flex-row items-center gap-6">
                       <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center text-brand-gold shadow-xl shadow-brand-green-deep/5 shrink-0">
                          <ShieldCheck size={32} />
                       </div>
                       <div className="text-center md:text-left">
                          <p className="text-lg font-bold text-brand-green-deep mb-1">Compromiso Legal Transfronterizo</p>
                          <p className="text-[13px] text-brand-green-mid/70 leading-relaxed max-w-2xl">
                             Trust Leaf actúa como oráculo de datos criptográficos entre sistemas de salud nacionales. El acceso a la medicina en el extranjero está sujeto a las leyes locales. Siempre verifique las regulaciones del país de destino antes de compartir su credencial médica.
                          </p>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Booking Flow Overlay */}
      <AnimatePresence mode="wait" key="modal-booking-flow">
        {activeDrawer && (
          <ActionDrawer
            open={Boolean(activeDrawer)}
            eyebrow={drawerMeta[activeDrawer].eyebrow}
            title={drawerMeta[activeDrawer].title}
            description={drawerMeta[activeDrawer].description}
            onClose={() => setActiveDrawer(null)}
          >
            {renderDrawerContent()}
          </ActionDrawer>
        )}

        {bookingDoctor && (
          <motion.div
            key="booking-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-4 bg-brand-green-deep/90 backdrop-blur-md"
            onClick={resetBooking}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-brand-ivory w-full max-w-lg h-full md:h-auto md:max-h-[90vh] md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-brand-green-deep/5 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                   <h4 className="text-xl font-serif text-brand-green-deep">
                     {bookingStep === 'success' ? '¡Cita Confirmada!' : 'Agendar tu Consulta'}
                   </h4>
                   {bookingStep !== 'success' && (
                     <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mt-1">Con {bookingDoctor.name}</p>
                   )}
                </div>
                <button onClick={resetBooking} className="p-2 hover:bg-brand-neutral rounded-full transition-colors active:scale-90">
                  <X size={20} />
                </button>
              </div>

              {/* Steps Progress */}
              {bookingStep !== 'success' && (
                <div className="flex px-8 py-4 bg-white/50 border-b border-brand-green-deep/5">
                  {[
                    { id: 'date', label: 'Fecha' },
                    { id: 'time', label: 'Hora' },
                    { id: 'confirm', label: 'Validar' }
                  ].map((step, i) => (
                    <div key={`booking-step-${step.id}`} className="flex-1 flex items-center gap-2">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                         bookingStep === step.id ? 'bg-brand-green-deep text-white' : 
                         (i < ['date', 'time', 'confirm'].indexOf(bookingStep) ? 'bg-green-100 text-green-700' : 'bg-brand-neutral text-brand-green-mid/40')
                       }`}>
                          {i < ['date', 'time', 'confirm'].indexOf(bookingStep) ? <CheckCircle size={12} /> : i + 1}
                       </div>
                       {i < 2 && <div className="flex-1 h-[2px] bg-brand-neutral ml-2" />}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                 <AnimatePresence mode="wait" key="booking-step-transitions">
                    {/* Step: Date */}
                    {bookingStep === 'date' && (
                      <motion.div key="step-date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                         <p className="text-sm font-bold text-brand-green-deep mb-4">Selecciona una fecha</p>
                         <div className="grid grid-cols-1 gap-3">
                            {bookingDates.map((date, i) => (
                               <button 
                                 key={`booking-date-opt-${i}`}
                                 onClick={() => { setSelectedDate(date); setBookingStep('time'); }}
                                 className="w-full p-5 text-left border border-brand-green-deep/5 rounded-2xl hover:border-brand-gold hover:bg-brand-gold/5 transition-all flex justify-between items-center group active:scale-[0.98]"
                               >
                                  <span className="font-medium text-brand-green-deep">{date}</span>
                                  <ArrowRight size={18} className="text-brand-green-mid/40 group-hover:text-brand-gold transition-colors" />
                               </button>
                            ))}
                         </div>
                      </motion.div>
                    )}

                    {/* Step: Time */}
                    {bookingStep === 'time' && (
                      <motion.div key="step-time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                         <button onClick={() => setBookingStep('date')} className="mb-4 text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1">← Cambiar fecha</button>
                         <p className="text-sm font-bold text-brand-green-deep mb-4">Selecciona un horario ({selectedDate})</p>
                         <div className="grid grid-cols-2 gap-3">
                            {bookingTimeOptions.map((time, i) => (
                               <button 
                                 key={`booking-time-opt-${i}`}
                                 onClick={() => { setSelectedTime(time); setBookingStep('confirm'); }}
                                 className="p-5 text-center border border-brand-green-deep/5 rounded-2xl hover:border-brand-gold hover:bg-brand-gold/5 transition-all text-sm font-bold text-brand-green-deep active:scale-[0.98]"
                               >
                                  {time}
                               </button>
                            ))}
                         </div>
                      </motion.div>
                    )}

                    {/* Step: Confirm */}
                    {bookingStep === 'confirm' && (
                      <motion.div key="step-confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                         <p className="text-sm font-bold text-brand-green-deep mb-6">Confirma los detalles de tu cita</p>
                         <div className="bg-brand-neutral p-6 rounded-2xl space-y-4 mb-8">
                            <div className="flex justify-between border-b border-brand-green-deep/5 pb-3">
                               <span className="text-xs text-brand-green-mid/60 uppercase font-bold tracking-wider">Especialista</span>
                               <span className="text-sm font-bold text-brand-green-deep">{bookingDoctor.name}</span>
                            </div>
                            <div className="flex justify-between border-b border-brand-green-deep/5 pb-3">
                               <span className="text-xs text-brand-green-mid/60 uppercase font-bold tracking-wider">Fecha</span>
                               <span className="text-sm font-bold text-brand-green-deep">{selectedDate}</span>
                            </div>
                            <div className="flex justify-between">
                               <span className="text-xs text-brand-green-mid/60 uppercase font-bold tracking-wider">Hora</span>
                               <span className="text-sm font-bold text-brand-green-deep">{selectedTime}</span>
                            </div>
                         </div>
                         <div className="space-y-4">
                            <button 
                              onClick={handleCompleteBooking}
                              className="w-full py-5 bg-brand-green-deep text-brand-ivory rounded-2xl font-bold shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                            >
                               Confirmar y Reservar <CheckCircle size={20} />
                            </button>
                            <button onClick={() => setBookingStep('time')} className="w-full py-4 text-xs font-bold text-brand-green-mid/60 uppercase tracking-widest text-center">Modificar horario</button>
                         </div>
                      </motion.div>
                    )}

                    {/* Step: Success */}
                    {bookingStep === 'success' && (
                      <motion.div key="step-success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center">
                         <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={40} />
                         </div>
                         <h5 className="text-2xl font-serif text-brand-green-deep mb-3">Reserva Exitosa</h5>
                         <p className="text-brand-green-mid/70 text-sm mb-8 px-4">Hemmos enviado la confirmación a tu correo y hemos notificado al {bookingDoctor.name}.</p>
                         <button 
                           onClick={resetBooking}
                           className="px-10 py-4 bg-brand-green-deep text-brand-ivory rounded-full font-bold shadow-lg"
                         >
                            Volver al Portal
                         </button>
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" key="modal-acquisition-flow">
        {selectedDispensary && (
          <motion.div
            key="acquisition-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-4 bg-brand-green-deep/90 backdrop-blur-md"
            onClick={resetDispensaryFlow}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-brand-ivory w-full max-w-lg h-full md:h-auto md:max-h-[90vh] md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-brand-green-deep/5 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                   <h4 className="text-xl font-serif text-brand-green-deep">
                     {dispensaryStep === 'success' ? '¡Retiro Autorizado!' : isDispensaryPortal ? 'Registrar dispensa' : 'Adquirir Medicina'}
                   </h4>
                   {dispensaryStep !== 'success' && (
                     <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mt-1">En {selectedDispensary.name}</p>
                   )}
                </div>
                <button onClick={resetDispensaryFlow} className="p-2 hover:bg-brand-neutral rounded-full transition-colors active:scale-90">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                 <AnimatePresence mode="wait" key="acquisition-step-transitions">
                    {/* Step: Inventory Selection */}
                    {dispensaryStep === 'inventory' && (
                      <motion.div key="step-inventory" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                         <div className="flex justify-between items-end mb-6">
                            <div>
                               <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">Catálogo Disponible</p>
                               <h5 className="text-2xl font-serif text-brand-green-deep">Seleccione su Medicina</h5>
                            </div>
                         </div>
                         
                         <div className="mb-5 rounded-3xl border border-brand-green-deep/5 bg-white p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold mb-1">Cupo receta mensual</p>
                                <h6 className="text-lg font-bold text-brand-green-deep">
                                  {prescriptionUsedGrams}g usados de {prescriptionMonthlyLimitGrams}g
                                </h6>
                              </div>
                              <div className="rounded-2xl bg-brand-neutral px-4 py-3 text-right">
                                <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold">Disponible</p>
                                <p className="text-xl font-bold text-brand-green-deep">{prescriptionRemainingGrams}g</p>
                              </div>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-brand-neutral">
                              <div
                                className={`h-full rounded-full ${cartExceedsPrescriptionLimit ? 'bg-red-400' : 'bg-brand-gold'}`}
                                style={{ width: `${prescriptionUsagePercent}%` }}
                              />
                            </div>
                            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-brand-green-mid/60">
                              <span>Carrito actual: {cartGrams}g</span>
                              <span>Proyectado post retiro: {prescriptionProjectedGrams}g / {prescriptionMonthlyLimitGrams}g</span>
                            </div>
                            {cartExceedsPrescriptionLimit && (
                              <p className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                                Este carrito supera el cupo disponible de la receta. Reduce gramos o solicita actualización médica.
                              </p>
                            )}
                         </div>

                         <div className="space-y-4">
                            {selectedDispensary.inventory.map((strain: any) => (
                               <div 
                                 key={strain.id}
                                 onClick={() => {
                                   setSelectedStrain(strain);
                                   setDispensaryStep('validate');
                                 }}
                                 className="p-6 bg-white border border-brand-green-deep/5 rounded-[28px] cursor-pointer hover:border-brand-gold/50 hover:shadow-xl hover:shadow-brand-green-deep/5 transition-all group active:scale-[0.98] relative overflow-hidden"
                               >
                                  {/* Glassy Background Ornament */}
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-gold/10 transition-colors"></div>

                                  <div className="flex justify-between items-start mb-4 relative z-10">
                                     <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <h5 className="font-bold text-brand-green-deep text-xl">{strain.name}</h5>
                                          <span className="text-[9px] bg-brand-green-deep text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{strain.type}</span>
                                        </div>
                                        <p className="text-sm font-bold text-brand-gold italic">{strain.effect}</p>
                                     </div>
                                     <div className="text-right">
                                        <div className="flex items-center gap-4">
                                          <div>
                                             <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest leading-none mb-1">THC</p>
                                             <p className="text-lg font-bold text-brand-green-deep leading-none">{strain.thc}</p>
                                          </div>
                                          <div className="w-[1px] h-6 bg-brand-green-deep/10"></div>
                                          <div>
                                             <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest leading-none mb-1">CBD</p>
                                             <p className="text-lg font-bold text-brand-green-deep leading-none">{strain.cbd}</p>
                                          </div>
                                        </div>
                                     </div>
                                  </div>

                                  {(strain.description || strain.origin || strain.lab) && (
                                    <div className="bg-brand-neutral/50 p-4 rounded-2xl mb-5 relative z-10 border border-brand-green-deep/5">
                                       <p className="text-xs text-brand-green-deep/80 leading-relaxed">
                                          {strain.description || `${strain.origin ?? 'Origen certificado'} - ${strain.lab ?? 'QC verificado'}`}
                                       </p>
                                    </div>
                                  )}

                                  <div className="flex justify-between items-center relative z-10 pt-4 border-t border-brand-green-deep/5">
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setSelectedStrain(strain);
                                         setDispensaryStep('validate');
                                       }}
                                       className="text-[10px] font-bold text-brand-green-mid hover:text-brand-gold flex items-center gap-1 transition-colors group/link"
                                     >
                                        Ver Trazabilidad <ArrowRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
                                     </button>
                                     
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         addToCart(strain);
                                       }}
                                       className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm ${
                                         cart.find(c => c.strain.id === strain.id) 
                                           ? 'bg-brand-green-deep text-brand-ivory' 
                                           : 'bg-brand-neutral text-brand-green-deep hover:bg-brand-green-deep hover:text-brand-ivory'
                                       }`}
                                     >
                                        {cart.find(c => c.strain.id === strain.id) ? (
                                          <>En Carrito ({cart.find(c => c.strain.id === strain.id).quantity}g)</>
                                        ) : (
                                          <><Plus size={14} /> Añadir</>
                                        )}
                                     </button>
                                  </div>
                               </div>
                            ))}
                         </div>

                         {cart.length > 0 && (
                            <motion.div 
                              initial={{ y: 100 }}
                              animate={{ y: 0 }}
                              className="sticky bottom-4 left-0 right-0 z-50 px-0 mt-8"
                            >
                              <div className="bg-brand-green-deep p-4 rounded-[24px] shadow-2xl flex items-center justify-between border border-brand-gold/30">
                                 <div className="flex items-center gap-4 pl-2">
                                    <div className="w-10 h-10 bg-brand-gold rounded-xl flex items-center justify-center text-brand-green-deep relative">
                                       <ShoppingBag size={20} />
                                       <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-brand-green-deep rounded-full flex items-center justify-center text-[10px] font-extrabold shadow-lg border border-brand-gold/20">
                                         {cart.reduce((a, b) => a + b.quantity, 0)}
                                       </span>
                                    </div>
                                    <div>
                                       <p className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em] leading-none mb-1">Monto Estimado</p>
                                       <p className="text-brand-ivory font-bold text-lg leading-none">${cartTotal.toLocaleString()}</p>
                                    </div>
                                 </div>
                                 <button 
                                   onClick={() => setDispensaryStep('confirm')}
                                   className="px-6 py-3 bg-brand-gold text-brand-green-deep rounded-xl font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
                                 >
                                    Continuar <ArrowRight size={18} />
                                 </button>
                              </div>
                            </motion.div>
                         )}

                         <div className="mt-8 p-6 bg-brand-green-deep/5 rounded-3xl border border-brand-green-deep/5 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand-gold shadow-sm shrink-0">
                               <ShieldCheck size={24} />
                            </div>
                            <div>
                               <p className="text-sm font-bold text-brand-green-deep leading-tight">Seguridad Validada por Red</p>
                               <p className="text-[11px] text-brand-green-mid/60 mt-1">Todas las cepas en este catálogo poseen el sello Trust Leaf de trazabilidad digital.</p>
                            </div>
                         </div>
                      </motion.div>
                    )}

                    {/* Step: Validate & Traceability */}
                    {dispensaryStep === 'validate' && selectedStrain && (
                      <motion.div key="step-validate" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                         <button onClick={() => setDispensaryStep('inventory')} className="mb-6 text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                            <X size={14} /> Cancelar y elegir otra
                         </button>
                         
                         <div className="bg-brand-green-deep text-brand-ivory p-8 rounded-[40px] mb-8 relative overflow-hidden shadow-2xl">
                            <div className="relative z-10">
                               <div className="flex items-center gap-2 mb-4 text-[11px] font-bold text-brand-gold uppercase tracking-[0.2em]">
                                  <ShieldCheck size={16} /> Trust Leaf Verified
                               </div>
                               <h5 className="text-3xl font-serif mb-6 leading-tight">Certificado de Trazabilidad</h5>
                               
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div className="space-y-6 relative ml-4">
                                     <div className="absolute left-[-16px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-brand-gold via-white/20 to-white/5"></div>
                                     
                                     <div className="relative flex items-start gap-4">
                                        <div className="absolute left-[-22px] top-1.5 w-4 h-4 rounded-full bg-brand-gold border-4 border-brand-green-deep z-20"></div>
                                        <div>
                                           <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-1">Fase 1: Origen</p>
                                           <p className="text-sm font-bold">{selectedStrain.origin}</p>
                                           <p className="text-[10px] text-brand-ivory/40 mt-1">Cosechado: {selectedStrain.harvestDate}</p>
                                        </div>
                                     </div>

                                     <div className="relative flex items-start gap-4">
                                        <div className="absolute left-[-22px] top-1.5 w-4 h-4 rounded-full bg-white/40 border-4 border-brand-green-deep z-20"></div>
                                        <div>
                                           <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-1">Fase 2: Laboratorio</p>
                                           <p className="text-sm font-bold">{selectedStrain.lab}</p>
                                           <p className="text-[10px] text-brand-ivory/40 mt-1">Análisis de pureza completo</p>
                                        </div>
                                     </div>

                                     <div className="relative flex items-start gap-4">
                                        <div className="absolute left-[-22px] top-1.5 w-4 h-4 rounded-full bg-white/40 border-4 border-brand-green-deep z-20"></div>
                                        <div>
                                           <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-1">Fase 3: Blockchain</p>
                                           <p className="text-sm font-bold">{selectedStrain.batch}</p>
                                           <p className="text-[10px] text-brand-gold/60 font-mono mt-1 uppercase tracking-tighter">HASH: 0x9a7b...82f1</p>
                                        </div>
                                     </div>
                                  </div>

                                 <div className="bg-white/5 p-6 rounded-3xl border border-white/10 relative overflow-hidden">
                                     {/* Background Icon */}
                                     <Activity size={80} className="absolute -bottom-4 -right-4 text-white/5 rotate-12" />
                                     
                                     <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-4 relative z-10">Composición de Cannabinoides</p>
                                     <div className="space-y-3 relative z-10">
                                        {selectedStrain.components?.map((comp: any, i: number) => (
                                           <div key={i} className="flex justify-between items-end border-b border-white/5 pb-2">
                                              <span className="text-xs text-white/60">{comp.name}</span>
                                              <span className="text-sm font-bold text-white font-mono">{comp.value}</span>
                                           </div>
                                        ))}
                                     </div>
                                     <div className="mt-6 pt-4 border-t border-white/10 relative z-10">
                                        <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-2">Terpenos Destacados</p>
                                        <div className="flex flex-wrap gap-2">
                                           {selectedStrain.terpenes.split(',').map((t: string, i: number) => (
                                              <span key={i} className="text-[9px] bg-white/10 px-2 py-1 rounded-md text-white/80 border border-white/5">{t.trim()}</span>
                                           ))}
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            </div>
                            
                            {/* Decorative Background */}
                            <div className="absolute -bottom-16 -right-16 opacity-[0.05] scale-150 rotate-[-15deg] pointer-events-none">
                               <Database size={300} />
                            </div>
                         </div>

                         <div className="space-y-4">
                            <div className="p-5 bg-brand-neutral/50 rounded-3xl border border-brand-green-deep/5 mb-4">
                               <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest mb-2">Prescripción de Uso</p>
                               <p className="text-sm text-brand-green-deep leading-relaxed">
                                  {selectedStrain.recommendation}
                               </p>
                            </div>

                            <button 
                              onClick={() => setDispensaryStep('confirm')}
                              className="w-full flex items-center justify-between p-6 bg-brand-gold text-brand-green-deep rounded-3xl font-bold shadow-xl shadow-brand-gold/20 active:scale-[0.98] transition-all group"
                            >
                               <div className="text-left">
                                  <p className="text-[10px] uppercase tracking-widest opacity-60">Siguiente Paso</p>
                                  <p className="text-lg">Confirmar Retiro</p>
                               </div>
                               <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                  <ArrowRight size={24} />
                               </div>
                            </button>
                         </div>
                      </motion.div>
                    )}

                    {/* Step: Confirm (Multiple Items) */}
                    {dispensaryStep === 'confirm' && (
                      <motion.div key="step-confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                         <div className="flex items-center justify-between mb-6">
                            <button onClick={() => setDispensaryStep('inventory')} className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                                <X size={14} /> Seguir Comprando
                            </button>
                            <span className="text-[10px] font-bold text-brand-green-mid/40 uppercase tracking-widest leading-none">Resumen del Retiro</span>
                         </div>

                         <div className="space-y-3 mb-8">
                            {cart.map((item) => (
                               <div key={`cart-item-${item.strain.id}`} className="bg-white p-4 rounded-2xl border border-brand-green-deep/5 flex items-center justify-between group">
                                  <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 bg-brand-neutral rounded-xl flex items-center justify-center text-brand-green-deep">
                                        <Activity size={18} />
                                     </div>
                                     <div>
                                        <h6 className="font-bold text-brand-green-deep text-sm">{item.strain.name}</h6>
                                        <p className="text-[10px] text-brand-green-mid/60 uppercase font-bold tracking-tighter">{item.strain.type}</p>
                                     </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4">
                                     <div className="flex items-center gap-2 bg-brand-neutral/50 p-1 rounded-lg">
                                        <button 
                                          onClick={() => updateQuantity(item.strain.id, -1)}
                                          className="p-1 hover:bg-white rounded-md text-brand-green-deep transition-colors"
                                        >
                                           <Minus size={12} />
                                        </button>
                                        <span className="text-xs font-mono font-bold w-4 text-center">{item.quantity}</span>
                                        <button 
                                          onClick={() => updateQuantity(item.strain.id, 1)}
                                          className="p-1 hover:bg-white rounded-md text-brand-green-deep transition-colors"
                                        >
                                           <Plus size={12} />
                                        </button>
                                     </div>
                                     <button 
                                       onClick={() => removeFromCart(item.strain.id)}
                                       className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                     >
                                        <Trash2 size={16} />
                                     </button>
                                  </div>
                               </div>
                            ))}
                         </div>

                         <div className="bg-brand-neutral p-6 rounded-[32px] space-y-4 mb-8 border border-brand-green-deep/5">
                            <div className="flex justify-between border-b border-brand-green-deep/5 pb-3">
                               <span className="text-xs text-brand-green-mid/60 uppercase font-bold tracking-wider">Dispensario</span>
                               <span className="text-sm font-bold text-brand-green-deep">{selectedDispensary.name}</span>
                            </div>
                           <div className="flex justify-between border-brand-green-deep/5">
                               <span className="text-xs text-brand-green-mid/60 uppercase font-bold tracking-wider">Monto Total</span>
                               <div className="text-right">
                                  <span className="text-xl font-bold text-brand-gold">${cartTotal.toLocaleString()}</span>
                                  <p className="text-[9px] text-brand-green-mid/40 font-bold uppercase mt-0.5">ARS Estimado</p>
                               </div>
                            </div>
                            <div className="border-t border-brand-green-deep/5 pt-4">
                               <div className="flex justify-between text-xs font-bold text-brand-green-deep mb-2">
                                  <span>Cupo mensual receta</span>
                                  <span>{prescriptionProjectedGrams}g / {prescriptionMonthlyLimitGrams}g</span>
                               </div>
                               <div className="h-2 overflow-hidden rounded-full bg-white">
                                  <div
                                    className={`h-full rounded-full ${cartExceedsPrescriptionLimit ? 'bg-red-400' : 'bg-brand-gold'}`}
                                    style={{ width: `${prescriptionUsagePercent}%` }}
                                  />
                               </div>
                               <p className="mt-2 text-[10px] text-brand-green-mid/50">
                                  Disponible antes del retiro: {prescriptionRemainingGrams}g. Este retiro usa {cartGrams}g.
                               </p>
                            </div>
                         </div>

                         <div className="space-y-4">
                            <div className={`rounded-xl border p-3 text-xs ${
                              dispensarySignerReady
                                ? 'border-green-100 bg-green-50 text-green-700'
                                : 'border-amber-100 bg-amber-50 text-amber-800'
                            }`}>
                              {dispensarySignerReady
                                ? `Signer dispensario listo${runtimeReadiness?.signers.dispensary.address ? `: ${shortenAddress(runtimeReadiness.signers.dispensary.address, 8)}` : ''}.`
                                : 'Firma testnet pendiente. Puedes registrar retiros fraccionados con credencial gestionada mientras se conecta el signer operativo.'}
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => fundTestnetRole('dispensary')}
                                disabled={faucetBusy === 'dispensary'}
                                className="rounded-full border border-brand-green-deep/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid disabled:cursor-wait disabled:opacity-60"
                              >
                                {faucetBusy === 'dispensary' ? 'Fondeando...' : 'Faucet testnet'}
                              </button>
                            </div>
                            {faucetNotice && (
                              <div className="rounded-xl border border-brand-gold/20 bg-brand-gold/10 p-3 text-xs text-brand-green-deep">
                                {faucetNotice}
                              </div>
                            )}
                            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                              Agente 402: confirma que la receta pertenece al paciente y mantiene cupo disponible, sin revelar diagnóstico. Cada entrega registra solo prueba, lote y cantidad.
                            </div>
                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
                              Próxima versión: los contratos guardarán gramos restantes por periodo para permitir retiros parciales en distintos dispensarios.
                            </div>
                            <label className="block space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">
                                Receta on-chain detectada
                              </span>
                              <div className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-lg font-bold text-brand-green-deep">Receta #{resolvedPrescriptionId}</p>
                                    <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/55">
                                      {activePrescription
                                        ? 'Detectada automáticamente desde la wallet del paciente.'
                                        : 'Usamos la última receta emitida o la receta activa de testnet.'}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-green-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-green-700">
                                    Vigente
                                  </span>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                  <div className="rounded-xl bg-brand-neutral px-3 py-2">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/45">Disponible</p>
                                    <p className="mt-1 font-bold text-brand-green-deep">{prescriptionRemainingGrams}g</p>
                                  </div>
                                  <div className="rounded-xl bg-brand-neutral px-3 py-2">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/45">Este retiro</p>
                                    <p className="mt-1 font-bold text-brand-green-deep">{cartGrams}g</p>
                                  </div>
                                </div>

                                {!activePrescription && (
                                  <div className="mt-4">
                                    <button
                                      type="button"
                                      onClick={() => setManualPrescriptionEntry((current) => !current)}
                                      className="text-[10px] font-bold uppercase tracking-widest text-brand-gold"
                                    >
                                      {manualPrescriptionEntry ? 'Ocultar entrada manual' : 'Usar otro numero de receta'}
                                    </button>
                                    {manualPrescriptionEntry && (
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={dispensePrescriptionId}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => setDispensePrescriptionId(event.target.value.replace(/[^\d]/g, ''))}
                                        placeholder={`Ej: ${DEMO_PRESCRIPTION_ID}`}
                                        className="mt-3 w-full rounded-xl border border-brand-green-deep/10 bg-brand-neutral px-4 py-3 text-sm font-mono text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </label>
                            <button 
                              onClick={handleCompleteOnchainDispense}
                              disabled={dispenseBusy || cartExceedsPrescriptionLimit || !Number.isFinite(resolvedPrescriptionId)}
                              className="w-full py-5 bg-brand-green-deep text-brand-ivory rounded-2xl font-bold shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                            >
                               {dispenseBusy ? 'Registrando...' : dispensarySignerReady ? 'Validar cupo y registrar retiro' : 'Registrar retiro de prueba'} <CheckCircle size={20} />
                            </button>
                            {dispenseError && (
                              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                                {dispenseError}
                              </div>
                            )}
                            <p className="text-[10px] text-center text-brand-green-mid/40 font-bold uppercase tracking-widest px-8 leading-relaxed">
                               Al confirmar, Trust Leaf registra una entrega fraccionada vinculada a la receta médica y mantiene visible el cupo restante.
                            </p>
                         </div>
                      </motion.div>
                    )}

                    {/* Step: Success */}
                    {dispensaryStep === 'success' && (
                      <motion.div key="step-success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-8 text-center">
                         <div className="w-24 h-24 bg-brand-green-deep rounded-full mx-auto mb-6 flex items-center justify-center text-brand-gold">
                            <CheckCircle size={48} />
                         </div>
                         {dispenseSuccess && (
                           <div className="mb-6 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700">
                             {dispenseSuccess}
                           </div>
                         )}
                         <h5 className="text-2xl font-serif text-brand-green-deep mb-2">Retiro registrado</h5>
                         <p className="text-brand-green-mid/70 text-sm mb-8 px-4">Validamos tu receta y registramos una entrega parcial. El tratamiento conserva cupos para futuros retiros.</p>
                         
                         <button 
                           onClick={() => {
                             resetDispensaryFlow();
                             switchView('pickups');
                           }}
                           className="w-full py-4 bg-brand-green-deep text-brand-ivory rounded-full font-bold shadow-lg"
                         >
                            Ir a mis retiros
                         </button>
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" key="modal-prescription-tool">
        {prescriptionToolOpen && (
          <motion.div
            key="prescription-tool-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-green-deep/80 p-4 backdrop-blur-md"
            onClick={() => setPrescriptionToolOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-brand-green-deep/5 bg-[#fbf7ef] p-6">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Herramienta de receta</p>
                  <h4 className="text-2xl font-serif text-brand-green-deep">
                    {selectedConsultationBlock ? 'Receta desde consulta' : 'Preparar receta verificable'}
                  </h4>
                  <p className="mt-2 max-w-2xl text-sm text-brand-green-mid/65">
                    Define solo lo necesario para que el dispensario valide estado, vigencia, formatos y cupo sin acceder a la historia clínica completa.
                  </p>
                </div>
                <button onClick={() => setPrescriptionToolOpen(false)} className="rounded-full p-2 transition-colors hover:bg-white">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div className={`rounded-xl border p-3 text-xs ${
                  doctorSignerReady
                    ? 'border-green-100 bg-green-50 text-green-700'
                    : 'border-amber-100 bg-amber-50 text-amber-800'
                }`}>
                  {doctorSignerReady
                    ? `Signer médico listo${runtimeReadiness?.signers.doctor.address ? `: ${shortenAddress(runtimeReadiness.signers.doctor.address, 8)}` : ''}.`
                    : 'Firma testnet pendiente. Puedes completar el flujo con credencial gestionada mientras se conecta el signer médico.'}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => fundTestnetRole('doctor')}
                    disabled={faucetBusy === 'doctor'}
                    className="rounded-full border border-brand-green-deep/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid disabled:cursor-wait disabled:opacity-60"
                  >
                    {faucetBusy === 'doctor' ? 'Fondeando...' : 'Faucet testnet'}
                  </button>
                </div>
                {faucetNotice && (
                  <div className="rounded-xl border border-brand-gold/20 bg-brand-gold/10 p-3 text-xs text-brand-green-deep">
                    {faucetNotice}
                  </div>
                )}

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                  Agente 402: valida licencia médica y genera un hash clínico. La receta se emite sin publicar diagnóstico ni notas completas.
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">
                      Wallet Stellar del paciente
                    </span>
                    <input
                      type="text"
                      value={prescriptionPatientAddress}
                      onChange={(event) => {
                        if (!selectedConsultationBlock) {
                          setDoctorPatientAddress(event.target.value);
                        }
                      }}
                      disabled={Boolean(selectedConsultationBlock)}
                      placeholder={DEMO_PATIENT_ADDRESS}
                      className="w-full rounded-xl bg-brand-neutral px-4 py-3 font-mono text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50 disabled:opacity-70"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Tratamiento</span>
                    <input
                      type="text"
                      value={doctorIssueForm.treatment}
                      onChange={(event) =>
                        setDoctorIssueForm((prev) => ({
                          ...prev,
                          treatment: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Dosis</span>
                    <input
                      type="text"
                      value={doctorIssueForm.dosage}
                      onChange={(event) =>
                        setDoctorIssueForm((prev) => ({
                          ...prev,
                          dosage: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Vigencia en días</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={doctorIssueForm.durationDays}
                      onChange={(event) =>
                        setDoctorIssueForm((prev) => ({
                          ...prev,
                          durationDays: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Cupo autorizado gramos</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={doctorIssueForm.monthlyLimitGrams}
                      onChange={(event) =>
                        setDoctorIssueForm((prev) => ({
                          ...prev,
                          monthlyLimitGrams: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">Notas clínicas privadas</span>
                    <textarea
                      value={doctorIssueForm.notes}
                      onChange={(event) =>
                        setDoctorIssueForm((prev) => ({
                          ...prev,
                          notes: event.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full resize-none rounded-xl bg-brand-neutral px-4 py-3 text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-brand-green-deep/5 bg-[#fbf7ef] p-5">
                <button
                  type="button"
                  onClick={handleDoctorIssuePrescription}
                  disabled={doctorIssueBusy || !prescriptionPatientAddress}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {doctorIssueBusy ? (
                    <>
                      <Activity size={16} className="animate-spin" />
                      Emitiendo...
                    </>
                  ) : (
                    <>
                      <FileText size={16} />
                      {doctorSignerReady ? 'Emitir en testnet' : 'Generar receta de prueba'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" key="modal-privacy-qr">
        {selectedQrPermission && (
          <motion.div
            key="privacy-qr-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-brand-green-deep/80 p-4 backdrop-blur-md"
            onClick={() => setSelectedQrPermission(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="w-full max-w-xl overflow-hidden rounded-[28px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-brand-green-deep/5 bg-brand-neutral/30 p-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Permiso privado</p>
                  <h4 className="mt-1 text-2xl font-serif text-brand-green-deep">
                    {selectedQrPermission.kind === 'medical-consultation'
                      ? 'QR para consulta medica'
                      : 'QR para receta y saldo'}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-brand-green-mid/65">
                    Este QR contiene una referencia temporal local. No incluye diagnostico, documentos, imagenes ni notas clinicas.
                  </p>
                </div>
                <button onClick={() => setSelectedQrPermission(null)} className="rounded-full p-2 transition-colors hover:bg-white">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-[180px_1fr]">
                <div className="rounded-3xl border border-brand-green-deep/10 bg-white p-4 shadow-sm">
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 49 }).map((_, index) => {
                      const tokenIndex = index % selectedQrPermission.qrToken.length;
                      const filled = (selectedQrPermission.qrToken.charCodeAt(tokenIndex) + index * 7) % 3 !== 0;
                      return (
                        <div
                          key={`${selectedQrPermission.id}-${index}`}
                          className={`aspect-square rounded-[3px] ${filled ? 'bg-brand-green-deep' : 'bg-brand-neutral'}`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    ['Receptor', `${selectedQrPermission.role}: ${selectedQrPermission.actor}`],
                    ['Alcance', selectedQrPermission.scope],
                    ['Expiracion', selectedQrPermission.expiresAt],
                    ['Token', selectedQrPermission.qrToken],
                    ['Hash verificable', selectedQrPermission.hash],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-brand-neutral/60 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-green-mid/45">{label}</p>
                      <p className="mt-1 break-words text-sm font-bold text-brand-green-deep">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-brand-green-deep/5 p-6 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedQrPermission.kind === 'medical-consultation') {
                      setConsultationStatus('checked_in');
                    } else {
                      setDispensaryValidation(selectedQrPermission);
                    }
                    setSelectedQrPermission(null);
                  }}
                  className="rounded-2xl bg-brand-green-deep px-4 py-3 text-sm font-bold text-brand-ivory"
                >
                  Validar QR
                </button>
                <button
                  type="button"
                  onClick={() => revokePrivacyPermission(selectedQrPermission.id)}
                  className="rounded-2xl border border-brand-green-deep/10 px-4 py-3 text-sm font-bold text-brand-green-deep"
                >
                  Revocar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" key="modal-clinical-record">
        {selectedClinicalRecord && (
          <motion.div
            key="clinical-record-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-brand-green-deep/80 backdrop-blur-md"
            onClick={() => setSelectedClinicalRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="bg-white w-full max-w-2xl max-h-[92vh] rounded-[28px] overflow-hidden shadow-2xl flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-6 border-b border-brand-green-deep/5 flex items-start justify-between gap-4 bg-brand-neutral/30">
                <div>
                  <p className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">Dato clínico privado</p>
                  <h4 className="text-2xl font-serif text-brand-green-deep">{selectedClinicalRecord.title}</h4>
                  <p className="mt-2 text-sm text-brand-green-mid/65">{selectedClinicalRecord.summary}</p>
                </div>
                <button onClick={() => setSelectedClinicalRecord(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {selectedClinicalRecord.details.map((detail: string) => (
                    <div key={detail} className="flex items-start gap-3 rounded-2xl border border-brand-green-deep/5 bg-brand-neutral/40 p-4">
                      <ShieldCheck size={16} className="mt-0.5 text-brand-green-deep shrink-0" />
                      <p className="text-sm text-brand-green-deep">{detail}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/45 font-bold mb-1">Exámenes y documentos</p>
                      <p className="text-sm font-bold text-brand-green-deep">
                        {clinicalExamGallery.length} respaldos privados asociados
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowClinicalGallery((current) => !current)}
                      className="rounded-xl border border-brand-green-deep/10 px-4 py-2 text-xs font-bold text-brand-green-deep transition-all active:scale-95"
                    >
                      {showClinicalGallery ? 'Ocultar galeria' : 'Ver galeria'}
                    </button>
                  </div>

                  {showClinicalGallery && (
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {clinicalExamGallery.map((exam) => (
                        <div key={exam.id} className="rounded-2xl border border-brand-green-deep/5 bg-brand-neutral/50 p-3">
                          <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded-xl bg-white text-brand-green-deep">
                            <Images size={24} />
                          </div>
                          <p className="text-sm font-bold text-brand-green-deep leading-tight">{exam.name}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-green-mid/50">{exam.type}</p>
                          <div className="mt-3 border-t border-brand-green-deep/5 pt-2">
                            <p className="text-[10px] text-brand-green-mid/55">{exam.date}</p>
                            <p className="mt-1 font-mono text-[10px] text-brand-gold">{exam.proof}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-neutral px-4 py-3 text-xs font-bold text-brand-green-deep transition-all active:scale-95">
                    <Upload size={14} />
                    Subir nuevo examen privado
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(event) => {
                        handleClinicalExamUpload(event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="rounded-2xl border border-brand-green-deep/10 bg-white p-4">
                  <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/45 font-bold mb-2">Solicitud de acceso</p>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-brand-green-deep">{clinicalAccessDoctor}</p>
                      <p className="mt-1 text-xs leading-relaxed text-brand-green-mid/60">
                        Endocannabinología - solicita leer este dato para validar tratamiento y emitir receta verificable.
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-neutral px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/60">
                      24h
                    </span>
                  </div>
                </div>
                <div className={`rounded-2xl border p-4 text-xs leading-relaxed ${
                  selectedClinicalAccess === 'authorized'
                    ? 'border-green-100 bg-green-50 text-green-700'
                    : selectedClinicalAccess === 'revoked'
                      ? 'border-red-100 bg-red-50 text-red-700'
                      : 'border-blue-100 bg-blue-50 text-blue-700'
                }`}>
                  {selectedClinicalAccess === 'authorized'
                    ? `Acceso autorizado por 24h para ${clinicalAccessDoctor}. El médico recibe una ventana temporal con documentos cifrados y hashes verificables; Stellar registra solo prueba de permiso y estado.`
                    : selectedClinicalAccess === 'revoked'
                      ? `Acceso revocado para ${clinicalAccessDoctor}. El médico conserva solo el hash público y pierde la ventana temporal de lectura privada.`
                      : `402 privacy gate: ${clinicalAccessDoctor} solicita acceso, el paciente aprueba una ventana temporal, y el sistema entrega documentos cifrados + hashes verificables. Stellar recibe solo prueba de integridad y estado.`}
                </div>
                <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 p-4">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-widest text-brand-gold font-bold">Prueba publica</p>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${
                      selectedClinicalAccess === 'authorized'
                        ? 'bg-green-50 text-green-700'
                        : selectedClinicalAccess === 'revoked'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-white text-brand-green-mid/60'
                    }`}>
                      {selectedClinicalAccess === 'authorized'
                        ? 'Acceso 24h'
                        : selectedClinicalAccess === 'revoked'
                          ? 'Revocado'
                          : 'Privado'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-brand-green-deep">{selectedClinicalRecord.proof}</p>
                  <p className="mt-2 text-[10px] leading-relaxed text-brand-green-mid/55">
                    {selectedClinicalAccess === 'authorized'
                      ? `Permiso temporal para ${clinicalAccessDoctor}: permiso-${selectedClinicalRecord.id}-24h - expira mañana.`
                      : selectedClinicalAccess === 'revoked'
                        ? `Revocación para ${clinicalAccessDoctor}: revoke-${selectedClinicalRecord.id}-402.`
                        : 'Sin permiso activo. Solo esta prueba publica puede validarse fuera del portal.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClinicalAccessState((current) => ({
                        ...current,
                        [selectedClinicalRecord.id]: 'authorized',
                      }));
                      createPrivacyPermission('medical-consultation');
                    }}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                      selectedClinicalAccess === 'authorized'
                        ? 'bg-green-600 text-white'
                        : 'bg-brand-green-deep text-brand-ivory hover:bg-brand-green-mid'
                    }`}
                  >
                    {selectedClinicalAccess === 'authorized' ? 'Lectura autorizada' : 'Autorizar lectura 24h'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClinicalAccessState((current) => ({
                        ...current,
                        [selectedClinicalRecord.id]: 'revoked',
                      }));
                      if (latestMedicalPermission) {
                        revokePrivacyPermission(latestMedicalPermission.id);
                      }
                    }}
                    className={`rounded-2xl border px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                      selectedClinicalAccess === 'revoked'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-brand-green-deep/10 text-brand-green-deep hover:bg-brand-neutral'
                    }`}
                  >
                    Revocar acceso
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" key="modal-trace-details">
        {selectedTraceRecord && (
          <motion.div
            key="trace-detail-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 md:p-6 bg-brand-green-deep/80 backdrop-blur-md"
            onClick={() => setSelectedTraceRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="bg-white w-full max-w-3xl max-h-[92vh] rounded-[28px] overflow-hidden shadow-2xl flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-5 md:p-6 border-b border-brand-green-deep/5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">Trazabilidad medicina</p>
                  <h4 className="text-2xl md:text-3xl font-serif text-brand-green-deep">{selectedTraceRecord.title}</h4>
                  <p className="text-xs text-brand-green-mid/60 mt-1">{selectedTraceRecord.subtitle} - entrega parcial verificada</p>
                </div>
                <button onClick={() => setSelectedTraceRecord(null)} className="p-2 hover:bg-brand-neutral rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    ['Cantidad entregada', selectedTraceRecord.quantity],
                    ['Fecha del retiro', selectedTraceRecord.date],
                    ['Confirmacion en red', `#${selectedTraceRecord.ledger}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-brand-neutral/50 border border-brand-green-deep/5 p-4">
                      <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold mb-1">{label}</p>
                      <p className="text-lg font-bold text-brand-green-deep break-words">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    ['Dispensario autorizado', selectedTraceRecord.dispensary],
                    ['Lote del producto', shortenHash(String(selectedTraceRecord.batch ?? ''), 12)],
                    ['Prueba privada del producto', shortenHash(String(selectedTraceRecord.product ?? ''), 12)],
                    ['Comprobante de transacción', shortenHash(selectedTraceRecord.txHash ?? '', 10)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-brand-neutral/50 border border-brand-green-deep/5 p-4">
                      <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold mb-1">{label}</p>
                      <p className="text-sm font-bold text-brand-green-deep break-words">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 leading-relaxed">
                  Agente 402 muestra prueba verificable, lote y estado de entrega, sin revelar diagnóstico ni notas clínicas completas. Los hashes completos quedan disponibles para auditoría técnica, pero la vista del paciente prioriza información entendible.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" key="modal-cannabis-market">
        {cannabisMarketOpen && (
          <motion.div
            key="cannabis-market-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-green-deep/80 p-4 backdrop-blur-md"
            onClick={() => setCannabisMarketOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-brand-green-deep/5 bg-brand-neutral/30 p-6">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Marketplace aliado</p>
                  <h4 className="text-2xl font-serif text-brand-green-deep">Negocios desde el cannabis</h4>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-green-mid/65">
                    Marcas y productores que trabajan con cáñamo, fibras naturales y derivados no medicinales. Separado del flujo clínico y de dispensación.
                  </p>
                </div>
                <button onClick={() => setCannabisMarketOpen(false)} className="rounded-full p-2 transition-colors hover:bg-white">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-3">
                {[
                  ['Indumentaria de cañamo', 'Ropa tecnica, textiles y prendas regenerativas.', 'Cáñamo textil'],
                  ['Calzado y accesorios', 'Zapatillas, bolsos y materiales de fibra vegetal.', 'Diseño circular'],
                  ['Bienestar y cultura', 'Cosmetica, educacion y experiencias legales del ecosistema.', 'Aliados locales'],
                ].map(([title, desc, tag]) => (
                  <div key={title} className="rounded-2xl border border-brand-green-deep/10 bg-brand-neutral/40 p-4">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-gold">
                      <Leaf size={18} />
                    </div>
                    <p className="text-sm font-bold text-brand-green-deep">{title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-brand-green-mid/65">{desc}</p>
                    <span className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/60">
                      {tag}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-brand-green-deep/5 bg-brand-neutral/30 p-6">
                {cannabisMarketInterest && (
                  <div className="mb-3 rounded-2xl border border-green-100 bg-green-50 p-3 text-xs text-green-700">
                    Interés registrado. Esta sección abrirá el directorio de marcas y solicitudes para nuevos negocios del ecosistema.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setCannabisMarketInterest(true)}
                  className="w-full rounded-2xl bg-brand-green-deep px-5 py-4 text-sm font-bold text-brand-ivory transition-all active:scale-95"
                >
                  {cannabisMarketInterest ? 'Interés registrado' : 'Explorar negocios aliados'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prescription Detail Popup (Inner Modal) */}
      <AnimatePresence mode="wait" key="modal-prescription-details">
        {selectedPrescription && (
          <motion.div
            key="prescription-detail-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-brand-green-deep/80 backdrop-blur-md"
            onClick={() => setSelectedPrescription(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-lg h-full md:h-auto rounded-none md:rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 md:p-8 border-b border-brand-green-deep/5 flex justify-between items-center bg-brand-neutral/30">
                <div>
                  <h4 className="text-lg md:text-xl font-serif text-brand-green-deep">Detalle de Receta</h4>
                  <p className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em] mt-1">Validación Digital Trust Leaf</p>
                </div>
                <button onClick={() => setSelectedPrescription(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase mb-1">Médico Emisor</p>
                    <p className="text-sm font-bold text-brand-green-deep">{selectedPrescription.doctor}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase mb-1">ID de Documento</p>
                    <p className="text-sm font-mono text-brand-green-deep">{selectedPrescription.id}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:hidden">
                    <div>
                      <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase mb-1">F. Emisión</p>
                      <p className="text-sm font-bold text-brand-green-deep">{selectedPrescription.date}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase mb-1">Válida Hasta</p>
                      <p className="text-sm font-bold text-brand-green-deep">{selectedPrescription.validUntil}</p>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase mb-1">Fecha de Emisión</p>
                    <p className="text-sm font-bold text-brand-green-deep">{selectedPrescription.date}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase mb-1">Válida Hasta</p>
                    <p className="text-sm font-bold text-brand-green-deep">{selectedPrescription.validUntil}</p>
                  </div>
                </div>
                
                <div className="p-4 bg-brand-neutral rounded-2xl">
                   <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase mb-2">Prescripción Terapéutica</p>
                   <p className="text-sm font-bold text-brand-green-deep mb-1">{selectedPrescription.treatment}</p>
                   <p className="text-xs text-brand-green-mid/70 font-medium mb-3">{selectedPrescription.concentration}</p>
                   <div className="pt-3 border-t border-brand-green-deep/5">
                      <p className="text-[10px] font-bold text-brand-green-mid/40 uppercase mb-1">Dosificación</p>
                      <p className="text-sm italic text-brand-green-deep">"{selectedPrescription.dosage}"</p>
                   </div>
                </div>

                {/* On-Chain Proof Section */}
                <div className="p-4 border border-brand-gold/20 rounded-2xl bg-brand-gold/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">Validación On-Chain</p>
                    <div className="flex items-center gap-1 text-[9px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                      <ShieldCheck size={10} /> SINCRONIZADO
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-brand-green-mid/60 font-mono break-all opacity-60">
                      Tx: 0x72a1...f3b9e281c04ade19283
                    </p>
                    <p className="text-[9px] text-brand-green-mid/40 italic">
                      // Esta receta ha sido anclada en la blockchain para validación pública descentralizada por dispensarios autorizados.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 border border-brand-green-deep/5 rounded-2xl bg-white">
                  <div className="w-12 h-12 bg-brand-green-deep/5 rounded-full flex items-center justify-center">
                    <ShieldCheck className="text-brand-green-mid" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-green-deep">Certificado de Autenticidad</p>
                    <p className="text-[10px] text-brand-green-mid/60">Este documento ha sido verificado por la red Trust Leaf.</p>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-brand-neutral/30 flex flex-col sm:flex-row gap-3">
                 <button className="w-full py-4 bg-brand-green-deep text-brand-ivory rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-transform">Descargar PDF</button>
                 <button className="w-full py-4 border border-brand-green-deep/10 rounded-xl text-sm font-bold text-brand-green-deep hover:bg-white transition-colors active:scale-95">Compartir</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}


