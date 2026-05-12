import { motion, AnimatePresence } from 'motion/react';
import { X, User, Activity, FileText, ShoppingBag, Search, Stethoscope, Star, MapPin, ArrowRight, ShieldCheck, CheckCircle, Database, Package, Trash2, Plus, Minus, Globe } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
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
  capabilities: {
    readContracts: boolean;
    issuePrescriptions: boolean;
    dispensePrescriptions: boolean;
    passkeyRelay: boolean;
    passkeyDiscovery: boolean;
  };
  signers: {
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

function shortenHash(value: string, size = 8) {
  if (!value || value.length <= size * 2) {
    return value;
  }

  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

const DEMO_PATIENT_ADDRESS = 'GBOVHFJQXZR5LMODPMKM766SHK5D7XOPZUHUYRPHENQKWDQI33DSWRJ6';
const DEMO_PRESCRIPTION_ID = '1';

// Future hardening: Agent 402 checks should resolve against a private vault
// (Supabase + encrypted storage) and publish only decisions, hashes and state
// transitions to Stellar. The UI below keeps that privacy model visible in MVP.

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
    effect: 'Equilibrado / analgesico',
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
    origin: 'Cultivo organico - Mendoza',
    effect: 'Sedativo / relajante',
    description: 'Inventario trazable con certificado de laboratorio cargado.',
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
    requirements: ['Cédula o Pasaporte', 'Validación Trust Leaf'],
    description: 'Pioneros en regulación. Acceso simple para pacientes internacionales validados.'
  },
  {
    id: 'reg-deu',
    country: 'Alemania',
    status: 'Legal con Receta',
    partner: 'Berlin Medical Botanical',
    flag: '🇩🇪',
    continent: 'Europa',
    requirements: ['Pasaporte Médico', 'Sync Blockchain Trust'],
    description: 'Protocolos estrictos de la UE. Su receta tiene validez transatlántica.'
  },
  {
    id: 'reg-usa-mia',
    country: 'Miami, USA',
    status: 'Medicinal Legal',
    partner: 'Florida Health Network',
    flag: '🇺🇸',
    continent: 'América',
    requirements: ['Pasaporte', 'Medical Registration'],
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
  const isDoctorPortal = roleLabel === 'Portal Medico';
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
  const [patientDashboard, setPatientDashboard] = useState<PatientDashboardData | null>(null);
  const [patientDashboardLoading, setPatientDashboardLoading] = useState(false);
  const [patientDashboardError, setPatientDashboardError] = useState<string | null>(null);
  const [runtimeReadiness, setRuntimeReadiness] = useState<RuntimeReadiness | null>(null);
  const [doctorIssueForm, setDoctorIssueForm] = useState({
    treatment: 'Cannabis medicinal para manejo de dolor crónico',
    dosage: '0.5g por vía vaporizada cada 12 horas',
    notes: 'Control clínico en 30 días.',
    durationDays: 30,
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
  const [dispenseBusy, setDispenseBusy] = useState(false);
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  const [dispenseSuccess, setDispenseSuccess] = useState<string | null>(null);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
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
    return saved ? JSON.parse(saved) : DISPENSARY_INVENTORY_SEED;
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
  }, [dispensePrescriptionId]);

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
  const dispenseRecords = patientDashboard?.dispenseRecords ?? [];
  const doctorSignerReady = runtimeReadiness?.capabilities.issuePrescriptions ?? false;
  const dispensarySignerReady = runtimeReadiness?.capabilities.dispensePrescriptions ?? false;

  useEffect(() => {
    if (!patientIdentityAddress) {
      setPatientDashboard(null);
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
      primaryMethod: 'freighter',
      hasFreighterBackup: false,
      walletLabel: 'Paciente demo testnet',
      contractAccount: DEMO_PATIENT_ADDRESS,
      freighterAddress: DEMO_PATIENT_ADDRESS,
      networkLabel: stellarConfig.networkLabel,
    }));
    setWalletError(null);
    setWalletHint('Paciente demo conectado. Esta identidad ya tiene historial real en Stellar Testnet.');
    setDoctorPatientAddress(DEMO_PATIENT_ADDRESS);
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
      id: `RX-${prescription.id}`,
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
    const targetPatientAddress = doctorPatientAddress.trim();

    if (!targetPatientAddress) {
      setDoctorIssueError('Ingresa la direccion Stellar del paciente para emitir la receta.');
      return;
    }

    if (!doctorSignerReady) {
      setDoctorIssueError('Produccion ya lee contratos, pero falta STELLAR_DOCTOR_SECRET en Vercel para firmar emisiones reales.');
      return;
    }

    setDoctorIssueBusy(true);
    setDoctorIssueError(null);
    setDoctorIssueSuccess(null);

    try {
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
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'No fue posible emitir la receta en testnet.');
      }

      setPatientDashboard(payload.dashboard);
      setHasPrescription(payload.dashboard.summary.total > 0);
      setDoctorIssueSuccess(
        `Receta emitida en testnet. RX-${payload.issuedId ?? 'pendiente'} • Tx ${shortenHash(payload.txHash)}`,
      );
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
    setHasPrescription(true);
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

  const handleCompleteOnchainDispense = async () => {
    const normalizedPrescriptionInput = dispensePrescriptionId.trim().replace(/^RX-/i, '');
    const manualPrescriptionId = normalizedPrescriptionInput
      ? Number(normalizedPrescriptionInput)
      : Number.NaN;
    const prescriptionId = activePrescription?.id ?? manualPrescriptionId;

    if (!Number.isFinite(prescriptionId)) {
      setDispenseError('Ingresa el numero RX on-chain que emitio el medico.');
      return;
    }

    if (!dispensarySignerReady) {
      setDispenseError('Produccion ya lee contratos, pero falta STELLAR_DISPENSARY_SECRET en Vercel para firmar dispensaciones reales.');
      return;
    }

    if (!cart.length) {
      setDispenseError('Agrega al menos una medicina al carrito antes de dispensar.');
      return;
    }

    setDispenseBusy(true);
    setDispenseError(null);
    setDispenseSuccess(null);

    try {
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
        throw new Error(payload.message || 'No fue posible dispensar la receta en testnet.');
      }

      setPatientDashboard(payload.dashboard);
      setHasPrescription(payload.dashboard.summary.total > 0);
      setDispenseSuccess(
        `Dispensacion registrada. Record ${payload.recordId ?? 'pendiente'} - Tx ${shortenHash(payload.txHash)}`,
      );
      setDispensaryStep('success');

      const newPickups = cart.map(item => ({
        id: `pick-${Date.now()}-${item.strain.id}`,
        strain: item.strain,
        quantity: item.quantity,
        dispensary: selectedDispensary,
        status: 'pending',
        token: `RX-${prescriptionId}-DR-${payload.recordId ?? 'TESTNET'}`,
        expires: 'Registrado on-chain'
      }));

      setActivePickups(prev => [...newPickups, ...prev]);
      setRecentActivity(prev => [
        {
          id: `act-disp-${Date.now()}`,
          action: `Dispensacion on-chain RX-${prescriptionId}`,
          date: "Recien",
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
      setDispenseError(
        error instanceof Error ? error.message : 'No fue posible dispensar la receta en testnet.',
      );
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

  const prepareInventoryDispense = (product: any) => {
    setSelectedDispensary({
      id: 'dispensary-operator',
      name: 'Mi dispensario',
      address: 'Operacion autorizada',
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

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity * 12500, 0); // Using mock price 12500
  }, [cart]);

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
                {isViewAllowed('doctors') && (
                <button 
                  onClick={() => switchView('doctors')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'doctors' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <Stethoscope size={18} /> {isDoctorPortal ? 'Emitir RX' : t.portal.navDoctors}
                </button>
                )}
                {isViewAllowed('dispensaries') && (
                <button 
                  onClick={() => switchView('dispensaries')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors ${activeView === 'dispensaries' ? 'bg-white/10 text-brand-ivory' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <ShoppingBag size={18} /> {isDispensaryPortal ? 'Operacion' : t.portal.navDispensaries}
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
              
              <div className="mt-auto p-4 bg-brand-gold/20 rounded-2xl border border-brand-gold/20">
                <p className="text-[10px] uppercase font-bold tracking-wider text-brand-gold mb-1">{t.portal.statusLabel}</p>
                <p className="text-sm font-medium">{t.portal.statusValue}</p>
              </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-2 left-4 right-4 bg-brand-green-deep/95 backdrop-blur-xl h-16 flex justify-around items-center z-[110] border border-white/10 rounded-[24px] pb-safe shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              {isViewAllowed('overview') && (
              <button 
                onClick={() => switchView('overview')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${activeView === 'overview' ? 'text-brand-gold' : 'text-white/40'}`}
              >
                <Activity size={20} className={activeView === 'overview' ? 'scale-110' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{t.portal.navHome}</span>
              </button>
              )}
              {isViewAllowed('prescriptions') && (
              <button 
                onClick={() => switchView('prescriptions')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${activeView === 'prescriptions' ? 'text-brand-gold' : 'text-white/40'}`}
              >
                <Activity size={20} className={activeView === 'prescriptions' ? 'scale-110' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{t.portal.navHealth}</span>
              </button>
              )}
              {isViewAllowed('doctors') && (
              <button 
                onClick={() => switchView('doctors')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${activeView === 'doctors' ? 'text-brand-gold' : 'text-white/40'}`}
              >
                <Stethoscope size={20} className={activeView === 'doctors' ? 'scale-110' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{isDoctorPortal ? 'Emitir RX' : t.portal.navDoctors}</span>
              </button>
              )}
              {isViewAllowed('dispensaries') && (
              <button 
                onClick={() => switchView('dispensaries')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${activeView === 'dispensaries' ? 'text-brand-gold' : 'text-white/40'}`}
              >
                <ShoppingBag size={20} className={activeView === 'dispensaries' ? 'scale-110' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{isDispensaryPortal ? 'Operar' : t.portal.navStore}</span>
              </button>
              )}
              {isViewAllowed('pickups') && (
              <button 
                onClick={() => switchView('pickups')}
                className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeView === 'pickups' ? 'text-brand-gold' : 'text-white/40'}`}
              >
                <Package size={20} />
                <span className="text-[10px] font-bold">{t.portal.navPickups}</span>
              </button>
              )}
              {isViewAllowed('history') && (
              <button 
                onClick={() => switchView('history')}
                className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeView === 'history' ? 'text-brand-gold' : 'text-white/40'}`}
              >
                <Database size={20} />
                <span className="text-[10px] font-bold">{t.portal.navRecord}</span>
              </button>
              )}
              {isViewAllowed('traveler') && (
              <button 
                onClick={() => switchView('traveler')}
                className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeView === 'traveler' ? 'text-brand-gold' : 'text-white/40'}`}
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
                  {activeView === 'doctors' && (isDoctorPortal ? 'Emision medica' : t.portal.viewDoctors)}
                  {activeView === 'dispensaries' && (isDispensaryPortal ? 'Operacion dispensario' : t.portal.viewDispensaries)}
                  {activeView === 'prescriptions' && t.portal.viewPrescriptions}
                  {activeView === 'pickups' && t.portal.navPickups}
                  {activeView === 'history' && t.portal.viewHistory}
                  {activeView === 'traveler' && t.portal.viewTraveler}
                  {activeView === 'profile' && t.portal.viewProfile}
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
                      </div>

                      {!walletConnected && (
                        <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          {[
                            ['1', 'Crear identidad', 'Passkey, Freighter o demo testnet.'],
                            ['2', 'Recibir receta', 'El medico emite un RX on-chain a tu wallet.'],
                            ['3', 'Retirar medicina', 'El dispensario valida el RX desde su propia URL.'],
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
                          onLinkFreighterBackup={linkFreighterBackup}
                          onContinue={() => switchView('doctors')}
                        />
                        <button
                          type="button"
                          onClick={connectDemoPatientWallet}
                          className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl border border-brand-green-deep/10 bg-white text-sm font-bold text-brand-green-deep hover:border-brand-gold/50 hover:text-brand-green-mid transition-colors"
                        >
                          <Database size={16} />
                          Entrar rapido con paciente demo testnet
                        </button>
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

                      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                        <div className="bg-white rounded-[32px] border border-brand-green-deep/10 p-6 shadow-sm">
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Estado On-Chain</p>
                              <h5 className="text-2xl font-serif text-brand-green-deep mt-1">Wallet del Paciente</h5>
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
                              <span className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold">Identidad paciente</span>
                              <span className="text-xs font-mono text-brand-green-deep">{shortenAddress(patientIdentityAddress ?? '', 8)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-green-deep/5 px-4 py-3">
                              <span className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold">Prescription Contract</span>
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
                                    RX-{primaryPrescription.id}
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
                          onClick={() => setActiveView('prescriptions')}
                          className="p-6 bg-brand-neutral/50 rounded-3xl border border-brand-green-deep/5 cursor-pointer transition-all shadow-sm hover:shadow-xl hover:shadow-brand-green-deep/5 group"
                        >
                          <div className="flex justify-between items-start mb-4">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/60">Receta Vigente</span>
                              <div className="p-2 bg-brand-green-deep/5 rounded-xl text-brand-green-deep group-hover:bg-brand-green-deep group-hover:text-brand-ivory transition-colors">
                                <FileText size={20} />
                              </div>
                          </div>
                          <p className="text-xl font-bold text-brand-green-deep mb-1">Cannabis Terapéutico</p>
                          <p className="text-xs text-brand-green-mid/70 flex items-center gap-1">
                            Dr. Alejandro Merino <span className="w-1 h-1 rounded-full bg-brand-gold"></span> Emitida hoy
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
                              setActiveView('dispensaries');
                            } else {
                              setActiveView('dispensaries');
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
                          onClick={() => setActiveView('pickups')}
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
                        <div className="rounded-2xl border border-brand-green-deep/10 bg-brand-neutral p-4 text-sm text-brand-green-mid/70">
                          Portal profesional separado: emite recetas on-chain y entrega el RX para que el dispensario lo valide desde su propia URL.
                        </div>
                      )}
                      <p className="text-sm text-brand-green-mid/70">Todos los médicos en Trust Leaf están validados y poseen licencias vigentes para la prescripción de cannabis medicinal.</p>
                      
                      {isDoctorPortal && (
                      <div className="bg-white border border-brand-green-deep/10 rounded-2xl p-5 shadow-sm space-y-5">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                              POV medico testnet
                            </p>
                            <h3 className="text-xl font-bold text-brand-green-deep mt-1">
                              Emitir receta soulbound al paciente objetivo
                            </h3>
                            <p className="text-xs text-brand-green-mid/60 mt-2 max-w-2xl">
                              La receta se firma con el medico autorizado de testnet, queda ligada a la cuenta del paciente y se valida contra los contratos Prescription y Registry.
                            </p>
                          </div>
                          <div className="px-3 py-2 rounded-xl bg-brand-neutral text-xs font-mono text-brand-green-mid/70 break-all md:max-w-[280px]">
                            {doctorPatientAddress.trim()
                              ? shortenAddress(doctorPatientAddress.trim(), 10)
                              : 'Paciente sin direccion'}
                          </div>
                        </div>

                        <div className={`rounded-xl border p-3 text-xs ${
                          doctorSignerReady
                            ? 'border-green-100 bg-green-50 text-green-700'
                            : 'border-amber-100 bg-amber-50 text-amber-800'
                        }`}>
                          {doctorSignerReady
                            ? `Signer medico listo${runtimeReadiness?.signers.doctor.address ? `: ${shortenAddress(runtimeReadiness.signers.doctor.address, 8)}` : ''}.`
                            : 'Modo lectura activo. Para emitir recetas reales en produccion falta configurar STELLAR_DOCTOR_SECRET en Vercel.'}
                        </div>

                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                          Agente 402: valida licencia medica y genera un hash clinico. El RX se emite sin publicar diagnostico ni notas completas.
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/55">
                          {['1. Paciente objetivo', '2. Emitir RX', '3. Dispensario valida'].map((step) => (
                            <div key={step} className="rounded-xl border border-brand-green-deep/5 bg-brand-neutral px-3 py-2">
                              {step}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="space-y-2 md:col-span-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">
                              Wallet Stellar del paciente
                            </span>
                            <input
                              type="text"
                              value={doctorPatientAddress}
                              onChange={(event) => setDoctorPatientAddress(event.target.value)}
                              placeholder={DEMO_PATIENT_ADDRESS}
                              className="w-full px-4 py-3 bg-brand-neutral rounded-xl text-sm font-mono text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">
                              Tratamiento
                            </span>
                            <input
                              type="text"
                              value={doctorIssueForm.treatment}
                              onChange={(event) =>
                                setDoctorIssueForm((prev) => ({
                                  ...prev,
                                  treatment: event.target.value,
                                }))
                              }
                              className="w-full px-4 py-3 bg-brand-neutral rounded-xl text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">
                              Dosis
                            </span>
                            <input
                              type="text"
                              value={doctorIssueForm.dosage}
                              onChange={(event) =>
                                setDoctorIssueForm((prev) => ({
                                  ...prev,
                                  dosage: event.target.value,
                                }))
                              }
                              className="w-full px-4 py-3 bg-brand-neutral rounded-xl text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                          </label>

                          <label className="space-y-2 md:col-span-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">
                              Notas clinicas
                            </span>
                            <textarea
                              value={doctorIssueForm.notes}
                              onChange={(event) =>
                                setDoctorIssueForm((prev) => ({
                                  ...prev,
                                  notes: event.target.value,
                                }))
                              }
                              rows={3}
                              className="w-full px-4 py-3 bg-brand-neutral rounded-xl text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">
                              Vigencia en dias
                            </span>
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
                              className="w-full px-4 py-3 bg-brand-neutral rounded-xl text-sm text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                            />
                          </label>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={handleDoctorIssuePrescription}
                              disabled={doctorIssueBusy || !doctorPatientAddress.trim() || !doctorSignerReady}
                              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-green-deep text-brand-ivory rounded-xl text-sm font-bold hover:bg-brand-green-mid transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                            >
                              {doctorIssueBusy ? (
                                <>
                                  <Activity size={16} className="animate-spin" />
                                  Emitiendo...
                                </>
                              ) : (
                                <>
                                  <FileText size={16} />
                                  Emitir en testnet
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {doctorIssueError && (
                          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                            {doctorIssueError}
                          </div>
                        )}

                        {doctorIssueSuccess && (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700">
                            <span>{doctorIssueSuccess}</span>
                            <button
                              type="button"
                              onClick={() => window.location.assign('/dispensario/operacion')}
                              className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-white border border-green-100 rounded-lg font-bold text-green-700 hover:border-green-200"
                            >
                              Ir a dispensar
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        )}
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
                                    ID: RX-{prescription.id}
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

                        <div className="bg-white border border-brand-green-deep/10 rounded-[28px] p-5 md:p-6">
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
                            <h3 className="text-2xl md:text-3xl font-serif text-brand-green-deep">Productos cargados para dispensar</h3>
                            <p className="text-sm text-brand-green-mid/60 mt-2 max-w-2xl">
                              Cada tarjeta representa un producto/lote del dispensario. Ajusta stock si entra o sale mercaderia, o prepara una dispensa para validar la receta del paciente.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {dispensaryInventory.map((product) => {
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
                                    <p className="text-[10px] uppercase tracking-widest text-brand-green-mid/50 font-bold mb-1">Concentracion</p>
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
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : patientDashboardLoading ? (
                      <div className="bg-white rounded-[32px] border border-brand-green-deep/10 p-8">
                        <p className="text-sm text-brand-green-mid/60">Consultando recetas del paciente en testnet...</p>
                      </div>
                    ) : patientDashboard?.prescriptions.length ? (
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
                                    ID: RX-{prescription.id}
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
                    ) : !hasPrescription && !isDispensaryPortal ? (
                      <div className="bg-brand-neutral/30 border-2 border-dashed border-brand-green-deep/10 rounded-[40px] p-12 text-center">
                         <div className="w-20 h-20 bg-brand-neutral rounded-full flex items-center justify-center mx-auto mb-6 text-brand-green-mid/30">
                             <ShoppingBag size={40} />
                          </div>
                         <h4 className="text-xl font-serif text-brand-green-deep mb-2">Acceso Restringido</h4>
                         <p className="text-brand-green-mid/60 text-sm max-w-xs mx-auto mb-8">Necesitas una receta activa antes de preparar una compra con medicina trazable. Agenda primero con un medico validado.</p>
                         <button 
                           onClick={() => switchView('doctors')}
                           className="px-8 py-4 bg-brand-green-deep text-brand-ivory rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-green-deep/20"
                         >
                            Buscar medico
                         </button>
                       </div>
                    ) : (
                      <>
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
                          <p className="text-brand-green-mid/60 text-sm max-w-xs mx-auto mb-8">Cuando un medico emita tu receta, aparecera aca y podras usarla en dispensarios.</p>
                          <button 
                            onClick={() => switchView('dispensaries')}
                            className="px-8 py-4 bg-brand-green-deep text-brand-ivory rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-green-deep/20"
                          >
                             Ver dispensarios
                          </button>
                       </div>
                    ) : (
                      <>
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3 text-blue-700 text-xs">
                      <Star size={14} fill="currentColor" />
                      <span>Este es un ejemplo de cómo verás tus recetas legales emitidas por nuestra red.</span>
                    </div>

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
                      className="group cursor-pointer p-6 bg-white border border-brand-green-deep/10 rounded-2xl hover:border-brand-gold hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-center gap-4"
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
                             <button onClick={() => setActiveView('dispensaries')} className="mt-8 text-sm font-bold text-brand-gold uppercase tracking-widest hover:underline">Ver dispensarios cercanos</button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                  setActiveView('overview');
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
                        <p className="text-xs font-bold text-brand-gold uppercase tracking-[0.2em] mb-1">Registros Inmutables</p>
                        <h3 className="text-3xl md:text-4xl font-serif text-brand-green-deep">Historial de Pedidos</h3>
                      </div>
                      <div className="bg-brand-neutral px-4 py-2 rounded-xl border border-brand-green-deep/5 flex items-center gap-2">
                        <Database size={16} className="text-brand-gold" />
                        <span className="text-xs font-bold text-brand-green-deep uppercase tracking-tighter">Blockchain Sync: OK</span>
                      </div>
                    </div>

                    {dispenseRecords.length > 0 && (
                      <div className="space-y-4">
                        {dispenseRecords.map((record, idx) => (
                          <motion.div
                            key={`dispense-record-${record.id}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white border border-brand-green-deep/5 rounded-3xl p-6 hover:shadow-md transition-shadow group"
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
                                    RX-{record.prescriptionId} consumida
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
                                    Ledger {record.recordedLedger}
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

                    <div className="space-y-4">
                      {dispenseRecords.length === 0 && MOCK_ORDERS.map((order, idx) => (
                        <motion.div 
                          key={order.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="bg-white border border-brand-green-deep/5 rounded-3xl p-6 hover:shadow-md transition-shadow group"
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
                              <p className="text-sm md:text-base text-brand-ivory/60 mb-10 leading-relaxed">Active su identificación Trust Leaf para acceder a dispensarios autorizados en todo el mundo con validación legal instantánea.</p>
                              
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
                                     <> <CheckCircle size={20} className="text-green-400" /> Trust ID Activo </>
                                   ) : (
                                     <> <Globe size={20} className="group-hover:rotate-12 transition-transform" /> Activar Trust ID </>
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
                                    setActiveView('dispensaries');
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
                             Trust Leaf actúa como oráculo de datos criptográficos entre sistemas de salud nacionales. El acceso a la medicina en el extranjero está sujeto a las leyes locales. Siempre verifique las regulaciones del país de destino en su Trust ID.
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
                            {['Mañana, 30 de Abril', 'Viernes, 1 de Mayo', 'Lunes, 4 de Mayo', 'Martes, 5 de Mayo'].map((date, i) => (
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
                            {['09:00 AM', '10:30 AM', '02:00 PM', '04:30 PM'].map((time, i) => (
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

                                  <div className="bg-brand-neutral/50 p-4 rounded-2xl mb-5 relative z-10 border border-brand-green-deep/5">
                                     <p className="text-xs text-brand-green-deep/80 leading-relaxed italic">
                                        "{strain.description}"
                                     </p>
                                  </div>

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
                         </div>

                         <div className="space-y-4">
                            <div className={`rounded-xl border p-3 text-xs ${
                              dispensarySignerReady
                                ? 'border-green-100 bg-green-50 text-green-700'
                                : 'border-amber-100 bg-amber-50 text-amber-800'
                            }`}>
                              {dispensarySignerReady
                                ? `Signer dispensario listo${runtimeReadiness?.signers.dispensary.address ? `: ${shortenAddress(runtimeReadiness.signers.dispensary.address, 8)}` : ''}.`
                                : 'Modo lectura activo. Para registrar dispensaciones reales en produccion falta configurar STELLAR_DISPENSARY_SECRET en Vercel.'}
                            </div>
                            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                              Agente 402: confirma que el RX esta vigente y no consumido sin revelar diagnostico. La entrega registra solo prueba, lote y estado on-chain.
                            </div>
                            <label className="block space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green-mid/50">
                                RX on-chain a validar
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={activePrescription ? `RX-${activePrescription.id}` : dispensePrescriptionId}
                                disabled={Boolean(activePrescription)}
                                onChange={(event) => setDispensePrescriptionId(event.target.value.replace(/^RX-/i, ''))}
                                placeholder="Ej: 1"
                                className="w-full px-4 py-3 bg-white rounded-xl border border-brand-green-deep/10 text-sm font-mono text-brand-green-deep focus:outline-none focus:ring-2 focus:ring-brand-gold/50 disabled:bg-brand-neutral disabled:text-brand-green-mid/60"
                              />
                              <p className="text-[10px] text-brand-green-mid/45 leading-relaxed">
                                Si no hay wallet paciente conectada, pega aqui el RX que emitio medico. El demo carga RX-{DEMO_PRESCRIPTION_ID} y luego recuerda el ultimo RX emitido.
                              </p>
                            </label>
                            <button 
                              onClick={handleCompleteOnchainDispense}
                              disabled={dispenseBusy || (!activePrescription && !dispensePrescriptionId.trim()) || !dispensarySignerReady}
                              className="w-full py-5 bg-brand-green-deep text-brand-ivory rounded-2xl font-bold shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                            >
                               {dispenseBusy ? 'Registrando en testnet...' : 'Validar Receta y Registrar Dispensa'} <CheckCircle size={20} />
                            </button>
                            {dispenseError && (
                              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                                {dispenseError}
                              </div>
                            )}
                            <p className="text-[10px] text-center text-brand-green-mid/40 font-bold uppercase tracking-widest px-8 leading-relaxed">
                               Al confirmar, la red Trust Leaf reservará el stock y generará los tokens únicos vinculados a su receta médica.
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
                         <h5 className="text-2xl font-serif text-brand-green-deep mb-2">¡Token Generado!</h5>
                         <p className="text-brand-green-mid/70 text-sm mb-8 px-4">Hemos validado tu receta. Tu token de retiro ya está disponible en tu billetera de medicamentos.</p>
                         
                         <button 
                           onClick={() => {
                             resetDispensaryFlow();
                             setActiveView('pickups');
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

