// Provider boundaries only. The portal, read effects and private state remain real.
function record(kind, operation) {
  (window.__legacyServiceCalls ??= []).push({ kind, operation });
}
function forbidden(operation) {
  record('mutation', operation);
  throw new Error('SYNTHETIC_MUTATION_FORBIDDEN');
}
export const db = Object.freeze({ synthetic: true });
export const auth = { currentUser: null };
export const getFirebaseRuntimeStatus = () => ({ configured: false });
export const collection = (_db, name) => ({ name });
export const doc = (_db, ...path) => ({ path });
export const where = (...constraint) => ({ constraint });
export const query = (ref, ...constraints) => ({ ref, constraints });
export const orderBy = (...constraint) => ({ constraint });
export async function getDocs() { record('read', 'getDocs'); return { docs: [], empty: true }; }
export function onSnapshot(_ref, next) {
  record('read', 'onSnapshot'); next({ docs: [], docChanges: () => [] });
  return () => record('cleanup', 'unsubscribe');
}
export const addDoc = () => forbidden('addDoc');
export const deleteDoc = () => forbidden('deleteDoc');
export const updateDoc = () => forbidden('updateDoc');
export const setDoc = () => forbidden('setDoc');
export const serverTimestamp = () => forbidden('serverTimestamp');
export const logAuditEvent = () => forbidden('logAuditEvent');
const reads = new Set(['loadPickups', 'loadDispensaryInventory', 'loadDispensaryMembers', 'loadDispensaryPickupHistory']);
export const trustDataStore = new Proxy({}, { get(_target, operation) {
  if (['loadDoctorApplications', 'loadDispensaryApplications'].includes(operation)) return async () => {
    record('read', operation); return { records: [], source: 'local-demo' };
  };
  if (reads.has(operation)) return async () => { record('read', operation); return []; };
  return () => forbidden(`trustDataStore.${String(operation)}`);
} });

export const WALLET_A = `G${'A'.repeat(55)}`;
export const WALLET_B = `G${'B'.repeat(55)}`;
export const stellarConfig = { network: 'TESTNET', networkLabel: 'Synthetic isolated network', rpcUrl: '', walletWasmHash: '' };
export function shortenAddress(value, size = 4) {
  return !value || value.length <= size * 2 ? value : `${value.slice(0, size)}...${value.slice(-size)}`;
}
export const isTestnetPassphrase = () => true;
export async function deriveStellarPublicKey(email) {
  record('read', 'deriveSyntheticWallet'); return email.includes('-b@') ? WALLET_B : WALLET_A;
}
export const getStoredPasskeyWallet = () => null;
export const getPasskeyAvailability = () => ({ available: false, reason: 'Synthetic wallet fixture' });
export const connectOrCreatePasskeyWallet = () => forbidden('passkeyRegister');
export const addFreighterBackupSigner = () => forbidden('backupSigner');
export const signXdrWithFreighter = () => forbidden('signXdr');
export async function connectFreighterOnTestnet() {
  record('wallet', 'connectSyntheticFreighter');
  return { address: WALLET_B, network: 'TESTNET' };
}
export const passkeyService = {
  getRegisteredAccounts: () => [], isSupported: () => false,
  clearAll: () => record('cleanup', 'clearSyntheticPasskeys'),
  register: () => forbidden('passkeyRegister'), login: () => forbidden('passkeyLogin'),
};
export const generateECDHKeypair = () => forbidden('permissionCrypto.generateKey');
export const exportPublicKeyJWK = () => forbidden('permissionCrypto.exportPublic');
export const importPublicKeyJWK = () => forbidden('permissionCrypto.importPublic');
export const exportPrivateKeyJWK = () => forbidden('permissionCrypto.exportPrivate');
export const importPrivateKeyJWK = () => forbidden('permissionCrypto.importPrivate');
export const deriveSharedAESKey = () => forbidden('permissionCrypto.derive');
export const encryptText = () => forbidden('permissionCrypto.encrypt');
export const decryptText = () => forbidden('permissionCrypto.decrypt');
