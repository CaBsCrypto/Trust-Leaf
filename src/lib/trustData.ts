import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type ActorRegistrationStatus = 'pending' | 'needs_review' | 'approved' | 'rejected';
export type OnchainRegistryStatus = 'pending' | 'registered' | 'failed';
export type PersistenceSource = 'supabase' | 'firebase' | 'local-demo';

export interface DoctorApplication {
  id: string;
  name: string;
  licenseId: string;
  specialty: string;
  contact: string;
  wallet: string;
  status: ActorRegistrationStatus;
  onchainStatus: OnchainRegistryStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewerNote?: string;
  metadataHash?: string;
}

export interface DispensaryApplication {
  id: string;
  name: string;
  legalId: string;
  address: string;
  contact: string;
  wallet: string;
  status: ActorRegistrationStatus;
  onchainStatus: OnchainRegistryStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewerNote?: string;
  metadataHash?: string;
}

type ApplicationKind = 'doctor' | 'dispensary';

const STORAGE_KEYS = {
  doctor: 'trust_doctor_registrations',
  dispensary: 'trust_dispensary_registrations',
} satisfies Record<ApplicationKind, string>;

const COLLECTIONS = {
  doctor: 'doctorApplications',
  dispensary: 'dispensaryApplications',
} satisfies Record<ApplicationKind, string>;

const SUPABASE_TABLES = {
  doctor: 'doctor_applications',
  dispensary: 'dispensary_applications',
} satisfies Record<ApplicationKind, string>;

type ActorApplication = DoctorApplication | DispensaryApplication;
type SupabaseRow = Record<string, unknown>;
type SupabaseUpdate = Partial<ActorApplication>;

function nowIso() {
  return new Date().toISOString();
}

function readLocal<T extends ActorApplication>(kind: ApplicationKind): T[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS[kind]);
    const records = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(records)) return [];
    return records.map((record) => normalizeApplication(record)) as T[];
  } catch {
    return [];
  }
}

function writeLocal<T extends ActorApplication>(kind: ApplicationKind, records: T[]) {
  localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(records));
}

function normalizeApplication<T extends Partial<ActorApplication>>(record: T): T & {
  status: ActorRegistrationStatus;
  onchainStatus: OnchainRegistryStatus;
} {
  return {
    ...record,
    status: record.status ?? 'pending',
    onchainStatus: record.onchainStatus ?? 'pending',
  };
}

function canUseFirebase() {
  return Boolean(auth.currentUser);
}

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ''),
    anonKey,
  };
}

function canUseSupabase() {
  return Boolean(getSupabaseConfig());
}

function toSupabaseRow(record: ActorApplication): SupabaseRow {
  const base = {
    id: record.id,
    name: record.name,
    contact: record.contact,
    wallet: record.wallet,
    status: record.status,
    onchain_status: record.onchainStatus,
    submitted_at: record.submittedAt,
    reviewed_at: record.reviewedAt ?? null,
    reviewer_note: record.reviewerNote ?? null,
    metadata_hash: record.metadataHash ?? null,
  };

  if ('licenseId' in record) {
    return {
      ...base,
      license_id: record.licenseId,
      specialty: record.specialty,
    };
  }

  return {
    ...base,
    legal_id: record.legalId,
    address: record.address,
  };
}

function toSupabaseUpdate(updates: SupabaseUpdate): SupabaseRow {
  const row: SupabaseRow = {};

  if ('name' in updates) row.name = updates.name;
  if ('contact' in updates) row.contact = updates.contact;
  if ('wallet' in updates) row.wallet = updates.wallet;
  if ('status' in updates) row.status = updates.status;
  if ('onchainStatus' in updates) row.onchain_status = updates.onchainStatus;
  if ('submittedAt' in updates) row.submitted_at = updates.submittedAt;
  if ('reviewedAt' in updates) row.reviewed_at = updates.reviewedAt ?? null;
  if ('reviewerNote' in updates) row.reviewer_note = updates.reviewerNote ?? null;
  if ('metadataHash' in updates) row.metadata_hash = updates.metadataHash ?? null;
  if ('licenseId' in updates) row.license_id = updates.licenseId;
  if ('specialty' in updates) row.specialty = updates.specialty;
  if ('legalId' in updates) row.legal_id = updates.legalId;
  if ('address' in updates) row.address = updates.address;

  return row;
}

function fromSupabaseRow<T extends ActorApplication>(kind: ApplicationKind, row: SupabaseRow): T {
  const base = {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    contact: String(row.contact ?? ''),
    wallet: String(row.wallet ?? ''),
    status: (row.status ?? 'pending') as ActorRegistrationStatus,
    onchainStatus: (row.onchain_status ?? 'pending') as OnchainRegistryStatus,
    submittedAt: String(row.submitted_at ?? nowIso()),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    reviewerNote: row.reviewer_note ? String(row.reviewer_note) : undefined,
    metadataHash: row.metadata_hash ? String(row.metadata_hash) : undefined,
  };

  if (kind === 'doctor') {
    return normalizeApplication({
      ...base,
      licenseId: String(row.license_id ?? ''),
      specialty: String(row.specialty ?? ''),
    }) as T;
  }

  return normalizeApplication({
    ...base,
    legalId: String(row.legal_id ?? ''),
    address: String(row.address ?? ''),
  }) as T;
}

async function supabaseRequest<T>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    query?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error('Supabase no configurado.');
  }

  const response = await fetch(`${config.url}/rest/v1/${table}${options.query ?? ''}`, {
    method: options.method ?? 'GET',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

async function loadApplicationsFromSupabase<T extends ActorApplication>(kind: ApplicationKind) {
  const rows = await supabaseRequest<SupabaseRow[]>(
    SUPABASE_TABLES[kind],
    { query: '?select=*&order=submitted_at.desc' },
  );
  const records = rows.map((row) => fromSupabaseRow<T>(kind, row));
  writeLocal(kind, records);
  return records;
}

async function createApplicationInSupabase<T extends ActorApplication>(kind: ApplicationKind, record: T) {
  await supabaseRequest<SupabaseRow[]>(
    SUPABASE_TABLES[kind],
    {
      method: 'POST',
      body: toSupabaseRow(record),
    },
  );
}

async function updateApplicationInSupabase<T extends ActorApplication>(
  kind: ApplicationKind,
  id: string,
  updates: Partial<T>,
) {
  await supabaseRequest<SupabaseRow[]>(
    SUPABASE_TABLES[kind],
    {
      method: 'PATCH',
      query: `?id=eq.${encodeURIComponent(id)}`,
      body: toSupabaseUpdate(updates),
    },
  );
}

async function loadApplications<T extends ActorApplication>(kind: ApplicationKind): Promise<{
  records: T[];
  source: PersistenceSource;
}> {
  if (canUseSupabase()) {
    try {
      return {
        records: await loadApplicationsFromSupabase<T>(kind),
        source: 'supabase',
      };
    } catch {
      // Keep the demo usable if RLS/env is not ready yet.
    }
  }

  if (!canUseFirebase()) {
    return { records: readLocal<T>(kind), source: 'local-demo' };
  }

  try {
    const snapshot = await getDocs(query(collection(db, COLLECTIONS[kind]), orderBy('submittedAt', 'desc')));
    const records = snapshot.docs.map((item) => normalizeApplication({ id: item.id, ...item.data() })) as T[];
    writeLocal(kind, records);
    return { records, source: 'firebase' };
  } catch {
    return { records: readLocal<T>(kind), source: 'local-demo' };
  }
}

async function createApplication<T extends ActorApplication>(kind: ApplicationKind, record: T): Promise<PersistenceSource> {
  const localRecords = [record, ...readLocal<T>(kind).filter((item) => item.id !== record.id)];
  writeLocal(kind, localRecords);

  if (canUseSupabase()) {
    try {
      await createApplicationInSupabase(kind, record);
      return 'supabase';
    } catch {
      return 'local-demo';
    }
  }

  if (!canUseFirebase()) return 'local-demo';

  try {
    await setDoc(doc(db, COLLECTIONS[kind], record.id), record);
    return 'firebase';
  } catch {
    return 'local-demo';
  }
}

async function updateApplication<T extends ActorApplication>(
  kind: ApplicationKind,
  id: string,
  updates: Partial<T>,
): Promise<PersistenceSource> {
  const localRecords = readLocal<T>(kind).map((record) =>
    record.id === id ? { ...record, ...updates } : record,
  );
  writeLocal(kind, localRecords);

  if (canUseSupabase()) {
    try {
      await updateApplicationInSupabase(kind, id, updates);
      return 'supabase';
    } catch {
      return 'local-demo';
    }
  }

  if (!canUseFirebase()) return 'local-demo';

  try {
    await updateDoc(doc(db, COLLECTIONS[kind], id), updates as Record<string, unknown>);
    return 'firebase';
  } catch {
    return 'local-demo';
  }
}

export const trustDataStore = {
  loadDoctorApplications: () => loadApplications<DoctorApplication>('doctor'),
  loadDispensaryApplications: () => loadApplications<DispensaryApplication>('dispensary'),
  createDoctorApplication(input: Omit<DoctorApplication, 'id' | 'status' | 'submittedAt' | 'onchainStatus'>) {
    return createApplication<DoctorApplication>('doctor', {
      ...input,
      id: `doc-req-${Date.now()}`,
      status: 'pending',
      onchainStatus: 'pending',
      submittedAt: nowIso(),
    });
  },
  createApprovedDoctor(input: Omit<DoctorApplication, 'id' | 'status' | 'submittedAt' | 'reviewedAt' | 'onchainStatus'>) {
    return createApplication<DoctorApplication>('doctor', {
      ...input,
      id: `doc-manual-${Date.now()}`,
      status: 'approved',
      onchainStatus: 'pending',
      submittedAt: nowIso(),
      reviewedAt: nowIso(),
    });
  },
  reviewDoctorApplication(
    id: string,
    status: Extract<ActorRegistrationStatus, 'approved' | 'rejected' | 'needs_review'>,
    reviewerNote?: string,
  ) {
    return updateApplication<DoctorApplication>('doctor', id, {
      status,
      reviewedAt: nowIso(),
      reviewerNote,
      onchainStatus: 'pending',
    });
  },
  updateDoctorOnchainStatus(
    id: string,
    onchainStatus: OnchainRegistryStatus,
    metadataHash?: string,
    reviewerNote?: string,
  ) {
    return updateApplication<DoctorApplication>('doctor', id, {
      onchainStatus,
      metadataHash,
      reviewerNote,
      reviewedAt: nowIso(),
    });
  },
  updateDispensaryOnchainStatus(
    id: string,
    onchainStatus: OnchainRegistryStatus,
    metadataHash?: string,
    reviewerNote?: string,
  ) {
    return updateApplication<DispensaryApplication>('dispensary', id, {
      onchainStatus,
      metadataHash,
      reviewerNote,
      reviewedAt: nowIso(),
    });
  },
  createDispensaryApplication(input: Omit<DispensaryApplication, 'id' | 'status' | 'submittedAt' | 'onchainStatus'>) {
    return createApplication<DispensaryApplication>('dispensary', {
      ...input,
      id: `disp-req-${Date.now()}`,
      status: 'pending',
      onchainStatus: 'pending',
      submittedAt: nowIso(),
    });
  },
  createApprovedDispensary(input: Omit<DispensaryApplication, 'id' | 'status' | 'submittedAt' | 'reviewedAt' | 'onchainStatus'>) {
    return createApplication<DispensaryApplication>('dispensary', {
      ...input,
      id: `disp-manual-${Date.now()}`,
      status: 'approved',
      onchainStatus: 'pending',
      submittedAt: nowIso(),
      reviewedAt: nowIso(),
    });
  },
  reviewDispensaryApplication(
    id: string,
    status: Extract<ActorRegistrationStatus, 'approved' | 'rejected' | 'needs_review'>,
    reviewerNote?: string,
  ) {
    return updateApplication<DispensaryApplication>('dispensary', id, {
      status,
      reviewedAt: nowIso(),
      reviewerNote,
      onchainStatus: 'pending',
    });
  },
};
