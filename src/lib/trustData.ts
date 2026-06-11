import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
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
  rut?: string;
  sisRegistrationId?: string;
  uid?: string;
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
  rut?: string;
  ispResolutionNumber?: string;
  uid?: string;
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
    if (typeof localStorage === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEYS[kind]);
    const records = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(records)) return [];
    return records.map((record) => normalizeApplication(record)) as T[];
  } catch {
    return [];
  }
}

function writeLocal<T extends ActorApplication>(kind: ApplicationKind, records: T[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(records));
    }
  } catch (err) {
    console.warn('LocalStorage write failed:', err);
  }
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
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('trust_leaf_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode === 'demo') {
          return false;
        }
      }
    }
  } catch {}
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
    rut: record.rut ?? null,
  };

  if ('licenseId' in record) {
    return {
      ...base,
      license_id: record.licenseId,
      specialty: record.specialty,
      sis_registration_id: record.sisRegistrationId ?? null,
    };
  }

  return {
    ...base,
    legal_id: record.legalId,
    address: record.address,
    isp_resolution_number: record.ispResolutionNumber ?? null,
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
  if ('rut' in updates) row.rut = updates.rut ?? null;
  if ('sisRegistrationId' in updates) row.sis_registration_id = updates.sisRegistrationId ?? null;
  if ('ispResolutionNumber' in updates) row.isp_resolution_number = updates.ispResolutionNumber ?? null;

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
    rut: row.rut ? String(row.rut) : undefined,
  };

  if (kind === 'doctor') {
    return normalizeApplication({
      ...base,
      licenseId: String(row.license_id ?? ''),
      specialty: String(row.specialty ?? ''),
      sisRegistrationId: row.sis_registration_id ? String(row.sis_registration_id) : undefined,
    }) as T;
  }

  return normalizeApplication({
    ...base,
    legalId: String(row.legal_id ?? ''),
    address: String(row.address ?? ''),
    ispResolutionNumber: row.isp_resolution_number ? String(row.isp_resolution_number) : undefined,
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
  if (canUseFirebase()) {
    try {
      const snapshot = await getDocs(query(collection(db, COLLECTIONS[kind]), orderBy('submittedAt', 'desc')));
      const records = snapshot.docs.map((item) => normalizeApplication({ id: item.id, ...item.data() })) as T[];
      writeLocal(kind, records);
      return { records, source: 'firebase' };
    } catch {
      // Keep the demo usable if Firestore rules/env are not ready yet.
    }
  }

  if (canUseSupabase()) {
    try {
      return {
        records: await loadApplicationsFromSupabase<T>(kind),
        source: 'supabase',
      };
    } catch {
      // Supabase remains a documented fallback, not the primary pilot path.
    }
  }

  return { records: readLocal<T>(kind), source: 'local-demo' };
}

function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const cleaned = { ...obj };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
}

async function createApplication<T extends ActorApplication>(kind: ApplicationKind, record: T): Promise<PersistenceSource> {
  const cleanedRecord = cleanUndefined(record);
  const localRecords = [cleanedRecord, ...readLocal<T>(kind).filter((item) => item.id !== cleanedRecord.id)];
  writeLocal(kind, localRecords);

  if (canUseFirebase()) {
    try {
      await setDoc(doc(db, COLLECTIONS[kind], cleanedRecord.id), cleanedRecord);
      return 'firebase';
    } catch (err) {
      console.error(`[Firebase Firestore] Error al guardar solicitud de ${kind}:`, err);
      return 'local-demo';
    }
  }

  if (canUseSupabase()) {
    try {
      await createApplicationInSupabase(kind, cleanedRecord);
      return 'supabase';
    } catch (err) {
      console.error(`[Supabase] Error al guardar solicitud de ${kind}:`, err);
      return 'local-demo';
    }
  }

  return 'local-demo';
}

async function updateApplication<T extends ActorApplication>(
  kind: ApplicationKind,
  id: string,
  updates: Partial<T>,
): Promise<PersistenceSource> {
  const cleanedUpdates = cleanUndefined(updates);
  const localRecords = readLocal<T>(kind).map((record) =>
    record.id === id ? { ...record, ...cleanedUpdates } : record,
  );
  writeLocal(kind, localRecords);

  if (canUseFirebase()) {
    try {
      await updateDoc(doc(db, COLLECTIONS[kind], id), cleanedUpdates as Record<string, unknown>);
      return 'firebase';
    } catch (err) {
      console.error(`[Firebase Firestore] Error al actualizar solicitud de ${kind}:`, err);
      return 'local-demo';
    }
  }

  if (canUseSupabase()) {
    try {
      await updateApplicationInSupabase(kind, id, cleanedUpdates);
      return 'supabase';
    } catch (err) {
      console.error(`[Supabase] Error al actualizar solicitud de ${kind}:`, err);
      return 'local-demo';
    }
  }

  return 'local-demo';
}

function registerSubmittedId(id: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem('trust_submitted_ids');
    const ids = saved ? JSON.parse(saved) : [];
    if (Array.isArray(ids) && !ids.includes(id)) {
      ids.push(id);
      localStorage.setItem('trust_submitted_ids', JSON.stringify(ids));
    }
  } catch (e) {
    console.error('Error saving submitted ID:', e);
  }
}

export const trustDataStore = {
  loadDoctorApplications: () => loadApplications<DoctorApplication>('doctor'),
  loadDispensaryApplications: () => loadApplications<DispensaryApplication>('dispensary'),
  createDoctorApplication(input: Omit<DoctorApplication, 'id' | 'status' | 'submittedAt' | 'onchainStatus'>) {
    const id = `doc-req-${Date.now()}`;
    registerSubmittedId(id);
    return createApplication<DoctorApplication>('doctor', {
      ...input,
      id,
      status: 'pending',
      onchainStatus: 'pending',
      submittedAt: nowIso(),
      uid: auth.currentUser?.uid,
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
    const id = `disp-req-${Date.now()}`;
    registerSubmittedId(id);
    return createApplication<DispensaryApplication>('dispensary', {
      ...input,
      id,
      status: 'pending',
      onchainStatus: 'pending',
      submittedAt: nowIso(),
      uid: auth.currentUser?.uid,
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
  async loadPickups(patientId: string): Promise<any[]> {
    if (canUseFirebase()) {
      try {
        const snapshot = await getDocs(
          query(collection(db, 'pickups'), where('patientId', '==', patientId))
        );
        return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      } catch (err) {
        console.error('Error loading pickups from Firestore:', err);
      }
    }
    try {
      const saved = localStorage.getItem('trust_pickups');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },
  async loadPickupsForDispensary(dispensaryId: string): Promise<any[]> {
    if (canUseFirebase()) {
      try {
        const snapshot = await getDocs(
          query(collection(db, 'pickups'), where('dispensaryId', '==', dispensaryId))
        );
        return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      } catch (err) {
        console.error('Error loading dispensary pickups from Firestore:', err);
      }
    }
    try {
      const saved = localStorage.getItem('trust_pickups');
      const all: any[] = saved ? JSON.parse(saved) : [];
      return all.filter((p) => p.dispensaryId === dispensaryId);
    } catch {
      return [];
    }
  },
  async updatePickupStatus(pickupId: string, status: 'pending' | 'completed', txHash?: string): Promise<void> {
    try {
      const saved = localStorage.getItem('trust_pickups');
      let current = saved ? JSON.parse(saved) : [];
      current = current.map((p: any) => p.id === pickupId ? { ...p, status, txHash } : p);
      localStorage.setItem('trust_pickups', JSON.stringify(current));
    } catch (e) {
      console.error(e);
    }
    if (canUseFirebase()) {
      try {
        const docRef = doc(db, 'pickups', pickupId);
        await updateDoc(docRef, { status, txHash });
      } catch (err) {
        console.error('Error updating pickup status in Firestore:', err);
      }
    }
  },
  async createPickup(pickup: any): Promise<void> {
    try {
      const saved = localStorage.getItem('trust_pickups');
      const current = saved ? JSON.parse(saved) : [];
      localStorage.setItem('trust_pickups', JSON.stringify([pickup, ...current]));
    } catch (e) {
      console.error(e);
    }
    if (canUseFirebase()) {
      try {
        await setDoc(doc(db, 'pickups', pickup.id), pickup);
      } catch (err) {
        console.error('Error saving pickup in Firestore:', err);
      }
    }
  },
  async deletePickup(pickupId: string): Promise<void> {
    try {
      const saved = localStorage.getItem('trust_pickups');
      const current = saved ? JSON.parse(saved) : [];
      localStorage.setItem('trust_pickups', JSON.stringify(current.filter((p: any) => p.id !== pickupId)));
    } catch (e) {
      console.error(e);
    }
    if (canUseFirebase()) {
      try {
        await deleteDoc(doc(db, 'pickups', pickupId));
      } catch (err) {
        console.error('Error deleting pickup from Firestore:', err);
      }
    }
  },
};
