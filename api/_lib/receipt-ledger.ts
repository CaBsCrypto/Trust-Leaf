import {
  createSyntheticReceiptStore,
  isSyntheticHandle,
  matchesSyntheticToken,
  operationalProjection,
  publicProjection,
  SYNTHETIC_RECEIPT_HANDLE,
  UNAVAILABLE_PUBLIC_RECEIPT,
  type OperationalReceiptProjection,
  type PublicReceiptProjection,
  type ReceiptActorRole,
  type SyntheticReceiptStore,
} from '../../shared/receipt-demo-contract.ts';

export type { OperationalReceiptProjection, PublicReceiptProjection, ReceiptActorRole } from '../../shared/receipt-demo-contract.ts';
export interface ReceiptLedgerPort {
  verifyPublic(token: string, operationId: string): Promise<PublicReceiptProjection>;
  getOperational(handle: string, actor: { role: ReceiptActorRole }): Promise<OperationalReceiptProjection | null>;
  appendEvent(): Promise<never>;
}

export interface SyntheticReceiptLedger extends ReceiptLedgerPort {
  getReadCacheSize(): number;
}

const AUTHORIZED_ROLES = new Set<ReceiptActorRole>(['doctor', 'patient', 'dispensary', 'admin']);
function equal(left: string, right: string) { const size = Math.max(left.length, right.length); let difference = left.length ^ right.length; for (let i = 0; i < size; i += 1) difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0); return difference === 0; }

function activeFixtureStore() {
  const store = createSyntheticReceiptStore();
  store.apply({ kind: 'issue', operationId: 'backend-fixture-issue' });
  return store;
}

export function createSyntheticReceiptLedger(
  input: SyntheticReceiptStore | { maxReadCacheEntries?: number; store?: SyntheticReceiptStore } = {},
): SyntheticReceiptLedger {
  const options = 'read' in input ? { store: input } : input;
  const store = options.store ?? activeFixtureStore();
  const maxReadCacheEntries = Math.max(1, Math.min(options.maxReadCacheEntries ?? 256, 1_024));
  const reads = new Map<string, { token: string; result: PublicReceiptProjection }>();
  const cache = (operationId: string, value: { token: string; result: PublicReceiptProjection }) => {
    if (reads.has(operationId)) reads.delete(operationId);
    reads.set(operationId, value);
    while (reads.size > maxReadCacheEntries) reads.delete(reads.keys().next().value as string);
  };
  return {
    async verifyPublic(token, operationId) {
      const prior = reads.get(operationId);
      if (prior) return equal(prior.token, token) ? prior.result : UNAVAILABLE_PUBLIC_RECEIPT;
      const receipt = store.read();
      const result = matchesSyntheticToken(token, receipt) ? publicProjection(receipt) : UNAVAILABLE_PUBLIC_RECEIPT;
      cache(operationId, { token, result });
      return result;
    },
    async getOperational(handle, actor) {
      const receipt = store.read();
      if (!AUTHORIZED_ROLES.has(actor.role) || !isSyntheticHandle(handle) || handle !== receipt.handle) return null;
      return operationalProjection(receipt);
    },
    async appendEvent() { throw Object.assign(new Error('Receipt mutations are disabled.'), { code: 'RECEIPT_MUTATIONS_DISABLED' }); },
    getReadCacheSize() { return reads.size; },
  };
}

export { createSyntheticReceiptStore, SYNTHETIC_RECEIPT_HANDLE };

export function createTestnetReceiptLedger(env: Record<string, string | undefined>): ReceiptLedgerPort {
  const rpc = env.STELLAR_RPC_URL;
  const network = env.STELLAR_NETWORK;
  const contract = env.STELLAR_RECEIPT_CONTRACT_ID;
  if (network !== 'testnet' || rpc !== 'https://soroban-testnet.stellar.org' || !contract) throw Object.assign(new Error('Testnet receipt ledger is not safely configured.'), { code: 'RECEIPT_LEDGER_NOT_CONFIGURED' });
  throw Object.assign(new Error('Testnet receipt adapter is intentionally unavailable before contract authorization.'), { code: 'RECEIPT_TESTNET_GATE_CLOSED' });
}
