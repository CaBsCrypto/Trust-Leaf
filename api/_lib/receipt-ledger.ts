export type ReceiptState = 'issued' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired';
export type ReceiptActorRole = 'doctor' | 'patient' | 'dispensary' | 'admin';

export interface PublicReceiptProjection {
  demo: true;
  evidenceExists: boolean;
  proofMatches: boolean;
  status: 'active' | 'revoked' | 'expired' | 'unavailable';
}

export interface OperationalReceiptProjection {
  demo: true;
  receiptHandle: string;
  state: ReceiptState;
  version: number;
  remainingCommitment: string;
  events: ReadonlyArray<{ version: number; state: ReceiptState; operationId: string }>;
}

export interface ReceiptLedgerPort {
  verifyPublic(token: string, operationId: string): Promise<PublicReceiptProjection>;
  getOperational(handle: string, actor: { role: ReceiptActorRole }): Promise<OperationalReceiptProjection | null>;
  appendEvent(): Promise<never>;
}

const UNAVAILABLE: PublicReceiptProjection = {
  demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable',
};
const HANDLE = /^tl_demo_[A-Za-z0-9_-]{32,64}$/;
const TOKEN = /^(tl_demo_[A-Za-z0-9_-]{32,64})\.([A-Za-z0-9_-]{43})$/;

const FIXTURES = [
  { handle: 'tl_demo_A7mQ2vJ9xK4pR8wN6yT3uF5zB1cD0eGhL', signature: 'iNbZ8-2idR0rHqfXp-7YefpAq-svn1CjFmtUlXt2zbM', state: 'active', version: 2 },
  { handle: 'tl_demo_P9kL3sV7nM2qW8xR5tY1uC6bF4dE0aJzH', signature: 'baniiyTTPDUUazlt7h-wZ2rInt40x21IYklQ70PjbGE', state: 'revoked', version: 3 },
  { handle: 'tl_demo_Z4xC8vB2nM6qW1rT5yU9iO3pL7kJ0hGfD', signature: 'IpXapbzc_D7fnF9VkQu5SbaK1OfmoGTTHhqaPV4zSXg', state: 'expired', version: 3 },
] as const;

const PUBLIC_ROLES = new Set<ReceiptActorRole>(['doctor', 'patient', 'dispensary', 'admin']);

function equal(left: string, right: string) {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let i = 0; i < size; i += 1) difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  return difference === 0;
}

export function createSyntheticReceiptLedger(): ReceiptLedgerPort {
  const reads = new Map<string, { token: string; result: PublicReceiptProjection }>();
  return {
    async verifyPublic(token, operationId) {
      const prior = reads.get(operationId);
      if (prior) return equal(prior.token, token) ? prior.result : UNAVAILABLE;
      const match = TOKEN.exec(token);
      const record = match && FIXTURES.find(item => equal(item.handle, match[1]) && equal(item.signature, match[2]));
      const result: PublicReceiptProjection = record
        ? { demo: true, evidenceExists: true, proofMatches: true, status: record.state }
        : UNAVAILABLE;
      reads.set(operationId, { token, result });
      return result;
    },
    async getOperational(handle, actor) {
      if (!PUBLIC_ROLES.has(actor.role) || !HANDLE.test(handle)) return null;
      const record = FIXTURES.find(item => equal(item.handle, handle));
      if (!record) return null;
      return {
        demo: true,
        receiptHandle: record.handle,
        state: record.state,
        version: record.version,
        remainingCommitment: `synthetic-opaque-balance-v${record.version}`,
        events: Array.from({ length: record.version }, (_, index) => ({
          version: index + 1,
          state: index === 0 ? 'issued' : index === 1 ? 'active' : record.state,
          operationId: `synthetic-op-${index + 1}`,
        })),
      };
    },
    async appendEvent() { throw Object.assign(new Error('Receipt mutations are disabled.'), { code: 'RECEIPT_MUTATIONS_DISABLED' }); },
  };
}

export function createTestnetReceiptLedger(env: Record<string, string | undefined>): ReceiptLedgerPort {
  const rpc = env.STELLAR_RPC_URL;
  const network = env.STELLAR_NETWORK;
  const contract = env.STELLAR_RECEIPT_CONTRACT_ID;
  if (network !== 'testnet' || rpc !== 'https://soroban-testnet.stellar.org' || !contract) {
    throw Object.assign(new Error('Testnet receipt ledger is not safely configured.'), { code: 'RECEIPT_LEDGER_NOT_CONFIGURED' });
  }
  throw Object.assign(new Error('Testnet receipt adapter is intentionally unavailable before contract authorization.'), { code: 'RECEIPT_TESTNET_GATE_CLOSED' });
}
