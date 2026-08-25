import { createHash } from 'node:crypto';

const DIGEST = /^[a-f0-9]{64}$/i;
const ALIAS = /^[a-z][a-z0-9-]{2,63}$/;
const OPERATION_ID = /^[A-Za-z0-9_-]{16,128}$/;
const CONTRACT_ID = /^C[A-Z2-7]{55}$/;
const SIGNING_ROLES = ['admin-quorum', 'deployer', 'receipt-operator', 'doctor-service', 'dispensary-service'] as const;
const KEY_STATES = ['active', 'rotating', 'revoked', 'recovery-locked'] as const;

export const STELLAR_TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

export type SigningRole =
  | 'admin-quorum'
  | 'deployer'
  | 'receipt-operator'
  | 'doctor-service'
  | 'dispensary-service';

export type KeyLifecycleState = 'active' | 'rotating' | 'revoked' | 'recovery-locked';
export type KeyCustodyProviderKind = 'local-mock-no-secret' | 'kms' | 'hsm';

export interface KeyDescriptor {
  alias: string;
  role: SigningRole;
  version: number;
  state: KeyLifecycleState;
  providerKind: KeyCustodyProviderKind;
}

export interface KeyCustodyProviderPort {
  readonly kind: KeyCustodyProviderKind;
  describe(alias: string): Promise<KeyDescriptor | null>;
  authorizeDigest(request: {
    alias: string;
    version: number;
    role: SigningRole;
    digest: string;
    operationId: string;
  }): Promise<{ authorizationProof: string }>;
}

export interface KeyCustodyAuditPort {
  write(event: Readonly<{
    component: 'key-custody-gate';
    outcome: 'authorized-local-only' | 'denied';
    role: SigningRole | 'invalid-role';
    alias: string;
    reason: string;
    keyVersion: number;
  }>): void;
}

export interface KeyCustodyPolicy {
  runtime: 'local-mock';
  submissionEnabled: false;
  network: 'testnet';
  allowedPassphrases: readonly string[];
  allowedRpcOrigins: readonly string[];
  allowedContractIds: readonly string[];
  allowedWasmSha256: readonly string[];
  allowedAliasesByRole: Readonly<Record<SigningRole, readonly string[]>>;
  pinnedVersions: Readonly<Record<string, number>>;
  quorumByRole: Readonly<Record<SigningRole, number>>;
  allowedProviderKinds: readonly ['local-mock-no-secret'];
}

export interface CustodyAuthorizationRequest {
  role: SigningRole;
  alias: string;
  keyVersion: number;
  operationId: string;
  payloadDigest: string;
  network: 'testnet';
  passphrase: string;
  rpcUrl: string;
  contractId: string;
  wasmSha256: string;
}

export interface LocalOnlyAuthorization {
  role: SigningRole;
  alias: string;
  keyVersion: number;
  authorizationProof: string;
  providerKind: 'local-mock-no-secret';
  submissionEnabled: false;
  usableOnStellar: false;
}

/**
 * Local deterministic fixture only. It stores descriptors, never private material,
 * and its proof is deliberately not a Stellar signature.
 */
export function createNoSecretLocalCustodyProvider(descriptors: readonly KeyDescriptor[]): KeyCustodyProviderPort {
  const inventory = new Map<string, KeyDescriptor>();
  for (const descriptor of descriptors) {
    if (!ALIAS.test(descriptor.alias) || !SIGNING_ROLES.includes(descriptor.role) || !KEY_STATES.includes(descriptor.state)
      || !Number.isSafeInteger(descriptor.version) || descriptor.version < 1) {
      throw custodyError('MOCK_DESCRIPTOR_INVALID');
    }
    if (descriptor.providerKind !== 'local-mock-no-secret' || inventory.has(descriptor.alias)) {
      throw custodyError('MOCK_DESCRIPTOR_INVALID');
    }
    inventory.set(descriptor.alias, Object.freeze({ ...descriptor }));
  }

  return {
    kind: 'local-mock-no-secret',
    async describe(alias) {
      const descriptor = inventory.get(alias);
      return descriptor ? { ...descriptor } : null;
    },
    async authorizeDigest(request) {
      const descriptor = inventory.get(request.alias);
      if (!descriptor) throw custodyError('KEY_ALIAS_MISSING');
      if (descriptor.version !== request.version) throw custodyError('KEY_VERSION_STALE');
      if (descriptor.role !== request.role) throw custodyError('KEY_ROLE_MISMATCH');
      if (descriptor.state !== 'active') throw custodyError(stateError(descriptor.state));

      const authorizationProof = createHash('sha256')
        .update(['local-only-not-a-signature', request.alias, request.version, request.role, request.digest, request.operationId].join(':'))
        .digest('hex');
      return { authorizationProof: `local-proof-${authorizationProof}` };
    },
  };
}

export function createKeyCustodyGate(input: {
  provider: KeyCustodyProviderPort;
  policy: KeyCustodyPolicy;
  audit?: KeyCustodyAuditPort;
}) {
  validatePolicy(input.policy);
  if (input.provider.kind !== 'local-mock-no-secret' || !input.policy.allowedProviderKinds.includes(input.provider.kind)) {
    throw custodyError('PROVIDER_NOT_ALLOWED_IN_LOCAL_GATE');
  }

  const audit = (request: Pick<CustodyAuthorizationRequest, 'role' | 'alias' | 'keyVersion'>, outcome: 'authorized-local-only' | 'denied', reason: string) => {
    input.audit?.write({
      component: 'key-custody-gate',
      outcome,
      role: SIGNING_ROLES.includes(request.role) ? request.role : 'invalid-role',
      alias: ALIAS.test(request.alias) ? request.alias : 'invalid-alias',
      reason: safeCode(reason),
      keyVersion: Number.isSafeInteger(request.keyVersion) ? request.keyVersion : 0,
    });
  };

  const authorizeOne = async (request: CustodyAuthorizationRequest): Promise<LocalOnlyAuthorization> => {
    try {
      validateRequest(request, input.policy);
      const descriptor = await input.provider.describe(request.alias);
      if (!descriptor) throw custodyError('KEY_ALIAS_MISSING');
      if (descriptor.providerKind !== input.provider.kind) throw custodyError('KEY_PROVIDER_MISMATCH');
      if (descriptor.role !== request.role) throw custodyError('KEY_ROLE_MISMATCH');
      if (descriptor.version !== request.keyVersion || input.policy.pinnedVersions[request.alias] !== request.keyVersion) {
        throw custodyError('KEY_VERSION_STALE');
      }
      if (descriptor.state !== 'active') throw custodyError(stateError(descriptor.state));

      const result = await input.provider.authorizeDigest({
        alias: request.alias,
        version: request.keyVersion,
        role: request.role,
        digest: request.payloadDigest.toLowerCase(),
        operationId: request.operationId,
      });
      if (!/^local-proof-[a-f0-9]{64}$/.test(result.authorizationProof)) throw custodyError('LOCAL_PROOF_INVALID');
      audit(request, 'authorized-local-only', 'LOCAL_ONLY');
      return {
        role: request.role,
        alias: request.alias,
        keyVersion: request.keyVersion,
        authorizationProof: result.authorizationProof,
        providerKind: 'local-mock-no-secret',
        submissionEnabled: false,
        usableOnStellar: false,
      };
    } catch (error) {
      audit(request, 'denied', errorCode(error));
      throw custodyError(errorCode(error));
    }
  };

  return {
    authorize: authorizeOne,
    async authorizeQuorum(requests: readonly CustodyAuthorizationRequest[]): Promise<readonly LocalOnlyAuthorization[]> {
      if (requests.length === 0) throw custodyError('QUORUM_EMPTY');
      const role = requests[0].role;
      if (requests.some(request => request.role !== role)) throw custodyError('QUORUM_ROLE_MISMATCH');
      if (new Set(requests.map(request => request.alias)).size !== requests.length) throw custodyError('QUORUM_ALIAS_DUPLICATE');
      const required = input.policy.quorumByRole[role];
      if (!Number.isSafeInteger(required) || required < 1 || requests.length < required) throw custodyError('QUORUM_NOT_MET');
      return Promise.all(requests.map(authorizeOne));
    },
  };
}

function validatePolicy(policy: KeyCustodyPolicy) {
  if (policy.runtime !== 'local-mock' || policy.submissionEnabled !== false || policy.network !== 'testnet') {
    throw custodyError('CUSTODY_POLICY_INVALID');
  }
  if (policy.allowedProviderKinds.length !== 1 || policy.allowedProviderKinds[0] !== 'local-mock-no-secret') {
    throw custodyError('CUSTODY_POLICY_INVALID');
  }
  if (policy.allowedPassphrases.length !== 1 || policy.allowedPassphrases[0] !== STELLAR_TESTNET_PASSPHRASE) throw custodyError('CUSTODY_POLICY_INVALID');
  const configuredRoles = Object.keys(policy.allowedAliasesByRole);
  if (configuredRoles.length !== SIGNING_ROLES.length || SIGNING_ROLES.some(role => !configuredRoles.includes(role))) throw custodyError('CUSTODY_POLICY_INVALID');
  const allAliases: string[] = [];
  for (const role of SIGNING_ROLES) {
    const aliases = policy.allowedAliasesByRole[role];
    if (!aliases.length || aliases.some(alias => !ALIAS.test(alias) || policy.pinnedVersions[alias] < 1)) throw custodyError('CUSTODY_POLICY_INVALID');
    allAliases.push(...aliases);
    const quorum = policy.quorumByRole[role];
    if (!Number.isSafeInteger(quorum) || quorum < 1 || quorum > aliases.length) throw custodyError('CUSTODY_POLICY_INVALID');
  }
  if (new Set(allAliases).size !== allAliases.length || policy.quorumByRole['admin-quorum'] < 2) throw custodyError('CUSTODY_POLICY_INVALID');
  if (!policy.allowedRpcOrigins.length || policy.allowedRpcOrigins.some(origin => safeOrigin(origin) !== origin)) throw custodyError('CUSTODY_POLICY_INVALID');
  if (!policy.allowedContractIds.length || policy.allowedContractIds.some(value => !CONTRACT_ID.test(value))) throw custodyError('CUSTODY_POLICY_INVALID');
  if (!policy.allowedWasmSha256.length || policy.allowedWasmSha256.some(value => !DIGEST.test(value))) throw custodyError('CUSTODY_POLICY_INVALID');
}

function validateRequest(request: CustodyAuthorizationRequest, policy: KeyCustodyPolicy) {
  if (policy.submissionEnabled !== false) throw custodyError('SUBMISSION_MUST_REMAIN_DISABLED');
  if (!SIGNING_ROLES.includes(request.role)) throw custodyError('KEY_ROLE_MISMATCH');
  if (request.network !== 'testnet' || !policy.allowedPassphrases.includes(request.passphrase)) throw custodyError('NETWORK_ALLOWLIST_MISMATCH');
  if (!policy.allowedRpcOrigins.includes(safeOrigin(request.rpcUrl))) throw custodyError('RPC_ALLOWLIST_MISMATCH');
  if (!CONTRACT_ID.test(request.contractId) || !policy.allowedContractIds.includes(request.contractId)) throw custodyError('CONTRACT_ALLOWLIST_MISMATCH');
  if (!DIGEST.test(request.wasmSha256) || !policy.allowedWasmSha256.map(value => value.toLowerCase()).includes(request.wasmSha256.toLowerCase())) {
    throw custodyError('WASM_ALLOWLIST_MISMATCH');
  }
  if (!ALIAS.test(request.alias) || !policy.allowedAliasesByRole[request.role]?.includes(request.alias)) throw custodyError('KEY_ROLE_MISMATCH');
  if (!Number.isSafeInteger(request.keyVersion) || request.keyVersion < 1) throw custodyError('KEY_VERSION_INVALID');
  if (!OPERATION_ID.test(request.operationId) || !DIGEST.test(request.payloadDigest)) throw custodyError('AUTHORIZATION_REQUEST_INVALID');
}

function safeOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
    return url.origin;
  } catch {
    return '';
  }
}

function stateError(state: KeyLifecycleState) {
  if (state === 'rotating') return 'KEY_ROTATION_PENDING';
  if (state === 'revoked') return 'KEY_REVOKED';
  if (state === 'recovery-locked') return 'KEY_RECOVERY_LOCKED';
  return 'KEY_STATE_INVALID';
}

function errorCode(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'CUSTODY_UNAVAILABLE';
}

function safeCode(value: string) {
  return /^[A-Z0-9_]{1,64}$/.test(value) ? value : 'CUSTODY_UNAVAILABLE';
}

function custodyError(code: string) {
  return Object.assign(new Error('Key custody authorization unavailable.'), { code: safeCode(code) });
}
