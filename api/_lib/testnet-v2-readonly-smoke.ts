export const V2_READONLY_SMOKE_SCHEMA = 'trustleaf.testnet-v2-readonly-smoke.v1' as const;

const SHA256 = /^[a-f0-9]{64}$/i;
const SAFE_REF = /^[a-z][a-z0-9-]{2,63}$/;
const CONTRACT_ID = /^C[A-Z2-7]{55}$/;
const SAFE_CODE = /^[A-Z0-9_]{1,64}$/;

export type CredentialKind = 'doctor' | 'dispensary' | 'patient-eligibility';
export type CredentialState = 'active' | 'suspended' | 'revoked' | 'expired';
export type ReceiptV2State = 'issued' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired';

export interface ReadonlyContractDescriptor {
  schemaVersion: number;
  wasmSha256: string;
  linkedRegistryRef?: string;
}

export interface ReadonlyCredentialSnapshot {
  kind: CredentialKind;
  state: CredentialState;
  version: number;
}

export interface ReadonlyReceiptV2Snapshot {
  state: ReceiptV2State;
  version: number;
  doctorCredentialRef: string;
  eligibilityCredentialRef: string;
}

export interface ReadonlyAuthorizationChainSnapshot {
  registryRef: string;
  doctorCredentialRef: string;
  doctorActive: boolean;
  eligibilityCredentialRef: string;
  eligibilityActive: boolean;
  dispensaryCredentialRef?: string;
  dispensaryActive: boolean;
  grantEnabled: boolean;
}

export interface TestnetV2ReadonlyAdapter {
  readonly mode: 'local-fixture' | 'rpc-readonly';
  describeContract(contractRef: string, signal: AbortSignal): Promise<ReadonlyContractDescriptor | null>;
  readCredential(credentialRef: string, signal: AbortSignal): Promise<ReadonlyCredentialSnapshot | null>;
  readReceipt(receiptRef: string, signal: AbortSignal): Promise<ReadonlyReceiptV2Snapshot | null>;
  readAuthorizationChain(receiptRef: string, signal: AbortSignal): Promise<ReadonlyAuthorizationChainSnapshot | null>;
}

export interface TestnetV2ReadonlySmokeManifest {
  schema: typeof V2_READONLY_SMOKE_SCHEMA;
  network: 'testnet';
  submissionEnabled: false;
  mutationsAllowed: false;
  timeoutMs: number;
  contracts: {
    registry: { ref: string; expectedSchemaVersion: 1; expectedWasmSha256: string };
    receiptLedgerV2: {
      ref: string;
      expectedSchemaVersion: 2;
      expectedWasmSha256: string;
      expectedRegistryRef: string;
    };
  };
  credentials: readonly {
    ref: string;
    kind: CredentialKind;
    expectedState: CredentialState;
  }[];
  receipts: readonly {
    ref: string;
    expectedState: ReceiptV2State;
    doctorCredentialRef: string;
    eligibilityCredentialRef: string;
    dispensaryCredentialRef?: string;
    expectDispensaryActive?: boolean;
    expectGrantEnabled?: boolean;
  }[];
}

export interface TestnetV2ReadonlySmokeReport {
  schema: typeof V2_READONLY_SMOKE_SCHEMA;
  mode: TestnetV2ReadonlyAdapter['mode'];
  network: 'testnet';
  ready: boolean;
  submissionAttempts: 0;
  checks: {
    flagsClosed: boolean;
    registryArtifactMatched: boolean;
    receiptArtifactMatched: boolean;
    registryLinkMatched: boolean;
    credentialsMatched: boolean;
    receiptsMatched: boolean;
    authorizationChainsMatched: boolean;
    privacySafe: boolean;
  };
  counts: {
    contractsChecked: number;
    credentialsChecked: number;
    receiptsChecked: number;
    authorizationChainsChecked: number;
  };
  observed: {
    credentialStates: Record<CredentialState, number>;
    receiptStates: Record<ReceiptV2State, number>;
  };
  blockers: string[];
}

const credentialStates = (): Record<CredentialState, number> => ({ active: 0, suspended: 0, revoked: 0, expired: 0 });
const receiptStates = (): Record<ReceiptV2State, number> => ({ issued: 0, active: 0, partial: 0, dispensed: 0, revoked: 0, expired: 0 });

export async function runTestnetV2ReadonlySmoke(input: {
  manifest: TestnetV2ReadonlySmokeManifest;
  adapter: TestnetV2ReadonlyAdapter;
}): Promise<TestnetV2ReadonlySmokeReport> {
  const blockers = new Set<string>();
  const observedCredentials = credentialStates();
  const observedReceipts = receiptStates();
  const counts = { contractsChecked: 0, credentialsChecked: 0, receiptsChecked: 0, authorizationChainsChecked: 0 };

  try {
    validateManifest(input.manifest);
  } catch (error) {
    blockers.add(errorCode(error));
    return buildReport(input.adapter.mode, blockers, counts, observedCredentials, observedReceipts);
  }

  const registry = await safeRead(
    signal => input.adapter.describeContract(input.manifest.contracts.registry.ref, signal),
    input.manifest.timeoutMs,
    blockers,
    'REGISTRY',
  );
  if (registry) counts.contractsChecked += 1;
  const ledger = await safeRead(
    signal => input.adapter.describeContract(input.manifest.contracts.receiptLedgerV2.ref, signal),
    input.manifest.timeoutMs,
    blockers,
    'RECEIPT_LEDGER_V2',
  );
  if (ledger) counts.contractsChecked += 1;

  if (registry && !isContractDescriptor(registry, false)) blockers.add('UNSAFE_ADAPTER_PAYLOAD');
  if (ledger && !isContractDescriptor(ledger, true)) blockers.add('UNSAFE_ADAPTER_PAYLOAD');
  if (!matchesContract(registry, input.manifest.contracts.registry.expectedSchemaVersion, input.manifest.contracts.registry.expectedWasmSha256)) {
    blockers.add('REGISTRY_ARTIFACT_MISMATCH');
  }
  if (!matchesContract(ledger, input.manifest.contracts.receiptLedgerV2.expectedSchemaVersion, input.manifest.contracts.receiptLedgerV2.expectedWasmSha256)) {
    blockers.add('RECEIPT_ARTIFACT_MISMATCH');
  }
  if (!ledger || ledger.linkedRegistryRef !== input.manifest.contracts.receiptLedgerV2.expectedRegistryRef) {
    blockers.add('REGISTRY_LINK_MISMATCH');
  }

  for (const expected of input.manifest.credentials) {
    const snapshot = await safeRead(
      signal => input.adapter.readCredential(expected.ref, signal),
      input.manifest.timeoutMs,
      blockers,
      'CREDENTIAL',
    );
    if (!snapshot) {
      blockers.add('CREDENTIAL_UNKNOWN');
      continue;
    }
    counts.credentialsChecked += 1;
    if (!isCredentialSnapshot(snapshot)) {
      if (!hasExactKeys(snapshot, ['kind', 'state', 'version'])) blockers.add('UNSAFE_ADAPTER_PAYLOAD');
      blockers.add('CREDENTIAL_SCHEMA_MISMATCH');
      continue;
    }
    observedCredentials[snapshot.state] += 1;
    if (snapshot.kind !== expected.kind || snapshot.state !== expected.expectedState) blockers.add('CREDENTIAL_STATE_MISMATCH');
  }

  for (const expected of input.manifest.receipts) {
    const snapshot = await safeRead(
      signal => input.adapter.readReceipt(expected.ref, signal),
      input.manifest.timeoutMs,
      blockers,
      'RECEIPT',
    );
    if (!snapshot) {
      blockers.add('RECEIPT_UNKNOWN');
      continue;
    }
    counts.receiptsChecked += 1;
    if (!isReceiptSnapshot(snapshot)) {
      if (!hasExactKeys(snapshot, ['state', 'version', 'doctorCredentialRef', 'eligibilityCredentialRef'])) blockers.add('UNSAFE_ADAPTER_PAYLOAD');
      blockers.add('RECEIPT_SCHEMA_MISMATCH');
      continue;
    }
    observedReceipts[snapshot.state] += 1;
    if (snapshot.state !== expected.expectedState
      || snapshot.doctorCredentialRef !== expected.doctorCredentialRef
      || snapshot.eligibilityCredentialRef !== expected.eligibilityCredentialRef) {
      blockers.add('RECEIPT_STATE_MISMATCH');
    }

    const chain = await safeRead(
      signal => input.adapter.readAuthorizationChain(expected.ref, signal),
      input.manifest.timeoutMs,
      blockers,
      'AUTHORIZATION_CHAIN',
    );
    if (!chain) {
      blockers.add('AUTHORIZATION_CHAIN_UNKNOWN');
      continue;
    }
    counts.authorizationChainsChecked += 1;
    if (!isAuthorizationChain(chain)) blockers.add('UNSAFE_ADAPTER_PAYLOAD');
    if (!isAuthorizationChain(chain)
      || chain.registryRef !== input.manifest.contracts.registry.ref
      || chain.doctorCredentialRef !== expected.doctorCredentialRef
      || chain.eligibilityCredentialRef !== expected.eligibilityCredentialRef
      || (expected.dispensaryCredentialRef !== undefined && chain.dispensaryCredentialRef !== expected.dispensaryCredentialRef)
      || (expected.expectDispensaryActive !== undefined && chain.dispensaryActive !== expected.expectDispensaryActive)
      || (expected.expectGrantEnabled !== undefined && chain.grantEnabled !== expected.expectGrantEnabled)) {
      blockers.add('AUTHORIZATION_CHAIN_MISMATCH');
    }
  }

  return buildReport(input.adapter.mode, blockers, counts, observedCredentials, observedReceipts);
}

export function createLocalV2ReadonlyFixture(input: {
  contracts: Readonly<Record<string, ReadonlyContractDescriptor>>;
  credentials: Readonly<Record<string, ReadonlyCredentialSnapshot>>;
  receipts: Readonly<Record<string, ReadonlyReceiptV2Snapshot>>;
  chains: Readonly<Record<string, ReadonlyAuthorizationChainSnapshot>>;
  delayMs?: number;
}): TestnetV2ReadonlyAdapter {
  const clone = <T>(value: T | undefined): T | null => value === undefined ? null : structuredClone(value);
  const wait = async (signal: AbortSignal) => {
    if (!input.delayMs) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, input.delayMs);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(Object.assign(new Error('Read timed out.'), { code: 'READ_TIMEOUT' }));
      }, { once: true });
    });
  };
  return {
    mode: 'local-fixture',
    async describeContract(ref, signal) { await wait(signal); return clone(input.contracts[ref]); },
    async readCredential(ref, signal) { await wait(signal); return clone(input.credentials[ref]); },
    async readReceipt(ref, signal) { await wait(signal); return clone(input.receipts[ref]); },
    async readAuthorizationChain(ref, signal) { await wait(signal); return clone(input.chains[ref]); },
  };
}

export function assertSafeV2ReadonlySmokeReport(report: TestnetV2ReadonlySmokeReport) {
  const serialized = JSON.stringify(report);
  if (serialized.length > 8192
    || /https?:\/\/|\bC[A-Z2-7]{55}\b|\bG[A-Z2-7]{55}\b|\bS[A-Z2-7]{55}\b|\b[a-f0-9]{64}\b|@/i.test(serialized)
    || /secret|seed|private.?key|xdr|signature|address|contract.?id|receipt.?id|credential.?id/i.test(serialized)
    || report.submissionAttempts !== 0
    || report.blockers.some(code => !SAFE_CODE.test(code))) {
    throw smokeError('UNSAFE_SMOKE_REPORT');
  }
}

function validateManifest(manifest: TestnetV2ReadonlySmokeManifest) {
  if (manifest.schema !== V2_READONLY_SMOKE_SCHEMA || manifest.network !== 'testnet'
    || manifest.submissionEnabled !== false || manifest.mutationsAllowed !== false) throw smokeError('FLAGS_NOT_CLOSED');
  if (!Number.isSafeInteger(manifest.timeoutMs) || manifest.timeoutMs < 50 || manifest.timeoutMs > 10_000) throw smokeError('TIMEOUT_POLICY_INVALID');
  if (manifest.contracts.registry.expectedSchemaVersion !== 1 || manifest.contracts.receiptLedgerV2.expectedSchemaVersion !== 2) {
    throw smokeError('MANIFEST_SCHEMA_INVALID');
  }
  for (const contract of [manifest.contracts.registry, manifest.contracts.receiptLedgerV2]) {
    if (!validRef(contract.ref) || !SHA256.test(contract.expectedWasmSha256)) throw smokeError('MANIFEST_INVALID');
  }
  if (manifest.contracts.receiptLedgerV2.expectedRegistryRef !== manifest.contracts.registry.ref) throw smokeError('REGISTRY_LINK_MISMATCH');
  const refs = new Set<string>();
  const kinds = new Map<string, CredentialKind>();
  for (const item of manifest.credentials) {
    if (!validRef(item.ref) || refs.has(item.ref)
      || !['doctor', 'dispensary', 'patient-eligibility'].includes(item.kind)
      || !['active', 'suspended', 'revoked', 'expired'].includes(item.expectedState)) throw smokeError('MANIFEST_INVALID');
    refs.add(item.ref);
    kinds.set(item.ref, item.kind);
  }
  const receiptRefs = new Set<string>();
  for (const item of manifest.receipts) {
    if (!validRef(item.ref) || receiptRefs.has(item.ref)
      || !['issued', 'active', 'partial', 'dispensed', 'revoked', 'expired'].includes(item.expectedState)
      || !validRef(item.doctorCredentialRef) || kinds.get(item.doctorCredentialRef) !== 'doctor'
      || !validRef(item.eligibilityCredentialRef) || kinds.get(item.eligibilityCredentialRef) !== 'patient-eligibility'
      || (item.dispensaryCredentialRef !== undefined
        && (!validRef(item.dispensaryCredentialRef) || kinds.get(item.dispensaryCredentialRef) !== 'dispensary'))
      || (item.expectDispensaryActive !== undefined && typeof item.expectDispensaryActive !== 'boolean')
      || (item.expectGrantEnabled !== undefined && typeof item.expectGrantEnabled !== 'boolean')) throw smokeError('MANIFEST_INVALID');
    receiptRefs.add(item.ref);
  }
}

function validRef(value: string) { return SAFE_REF.test(value) || CONTRACT_ID.test(value); }
function isContractDescriptor(value: ReadonlyContractDescriptor, allowLink: boolean) {
  return hasExactKeys(value, allowLink ? ['schemaVersion', 'wasmSha256', 'linkedRegistryRef'] : ['schemaVersion', 'wasmSha256'])
    && Number.isSafeInteger(value.schemaVersion) && value.schemaVersion >= 1
    && SHA256.test(value.wasmSha256)
    && (!allowLink || (typeof value.linkedRegistryRef === 'string' && validRef(value.linkedRegistryRef)));
}
function matchesContract(value: ReadonlyContractDescriptor | null, schema: number, hash: string) {
  return value !== null && value.schemaVersion === schema && SHA256.test(value.wasmSha256) && value.wasmSha256.toLowerCase() === hash.toLowerCase();
}
function isCredentialSnapshot(value: ReadonlyCredentialSnapshot) {
  return hasExactKeys(value, ['kind', 'state', 'version'])
    && ['doctor', 'dispensary', 'patient-eligibility'].includes(value.kind)
    && ['active', 'suspended', 'revoked', 'expired'].includes(value.state)
    && Number.isSafeInteger(value.version) && value.version >= 1;
}
function isReceiptSnapshot(value: ReadonlyReceiptV2Snapshot) {
  return hasExactKeys(value, ['state', 'version', 'doctorCredentialRef', 'eligibilityCredentialRef'])
    && ['issued', 'active', 'partial', 'dispensed', 'revoked', 'expired'].includes(value.state)
    && Number.isSafeInteger(value.version) && value.version >= 1
    && validRef(value.doctorCredentialRef) && validRef(value.eligibilityCredentialRef);
}
function isAuthorizationChain(value: ReadonlyAuthorizationChainSnapshot) {
  return hasExactKeys(value, [
    'registryRef', 'doctorCredentialRef', 'doctorActive', 'eligibilityCredentialRef', 'eligibilityActive',
    'dispensaryCredentialRef', 'dispensaryActive', 'grantEnabled',
  ], ['dispensaryCredentialRef'])
    && validRef(value.registryRef) && validRef(value.doctorCredentialRef) && validRef(value.eligibilityCredentialRef)
    && (value.dispensaryCredentialRef === undefined || validRef(value.dispensaryCredentialRef))
    && [value.doctorActive, value.eligibilityActive, value.dispensaryActive, value.grantEnabled].every(flag => typeof flag === 'boolean');
}

function hasExactKeys(value: object, allowed: readonly string[], optional: readonly string[] = []) {
  const keys = Object.keys(value);
  const required = allowed.filter(key => !optional.includes(key));
  return keys.every(key => allowed.includes(key)) && required.every(key => keys.includes(key));
}

async function safeRead<T>(operation: (signal: AbortSignal) => Promise<T | null>, timeoutMs: number, blockers: Set<string>, scope: string): Promise<T | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<null>(resolve => {
        timer = setTimeout(() => {
          controller.abort();
          blockers.add(`${scope}_TIMEOUT`);
          resolve(null);
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    blockers.add(errorCode(error, `${scope}_UNAVAILABLE`));
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildReport(
  mode: TestnetV2ReadonlyAdapter['mode'],
  blockers: Set<string>,
  counts: TestnetV2ReadonlySmokeReport['counts'],
  credentials: Record<CredentialState, number>,
  receipts: Record<ReceiptV2State, number>,
): TestnetV2ReadonlySmokeReport {
  const has = (code: string) => blockers.has(code);
  const report: TestnetV2ReadonlySmokeReport = {
    schema: V2_READONLY_SMOKE_SCHEMA,
    mode,
    network: 'testnet',
    ready: blockers.size === 0,
    submissionAttempts: 0,
    checks: {
      flagsClosed: !has('FLAGS_NOT_CLOSED'),
      registryArtifactMatched: !has('REGISTRY_ARTIFACT_MISMATCH') && !has('REGISTRY_UNAVAILABLE') && !has('REGISTRY_TIMEOUT'),
      receiptArtifactMatched: !has('RECEIPT_ARTIFACT_MISMATCH') && !has('RECEIPT_LEDGER_V2_UNAVAILABLE') && !has('RECEIPT_LEDGER_V2_TIMEOUT'),
      registryLinkMatched: !has('REGISTRY_LINK_MISMATCH'),
      credentialsMatched: ![...blockers].some(code => code.startsWith('CREDENTIAL_')),
      receiptsMatched: ![...blockers].some(code => code.startsWith('RECEIPT_') && !code.startsWith('RECEIPT_LEDGER_V2_')),
      authorizationChainsMatched: ![...blockers].some(code => code.startsWith('AUTHORIZATION_CHAIN_')),
      privacySafe: !has('UNSAFE_ADAPTER_PAYLOAD'),
    },
    counts: { ...counts },
    observed: { credentialStates: { ...credentials }, receiptStates: { ...receipts } },
    blockers: [...blockers].map(code => SAFE_CODE.test(code) ? code : 'READONLY_SMOKE_UNAVAILABLE').sort(),
  };
  assertSafeV2ReadonlySmokeReport(report);
  return report;
}

function errorCode(error: unknown, fallback = 'READONLY_SMOKE_UNAVAILABLE') {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && SAFE_CODE.test(code) ? code : fallback;
}
function smokeError(code: string) { return Object.assign(new Error('Read-only Testnet V2 smoke unavailable.'), { code }); }
