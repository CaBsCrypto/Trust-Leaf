import assert from 'node:assert/strict';
import { getPilotMutationSafety } from '../api/_lib/pilot-safety.ts';

const safeTestnet = {
  NODE_ENV: 'test',
  TRUSTLEAF_ALLOW_TESTNET_MUTATIONS: 'true',
  TRUSTLEAF_PILOT_RUNTIME: 'local-synthetic',
  STELLAR_NETWORK: 'testnet',
  STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org',
  STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
};

assert.equal(getPilotMutationSafety({}).enabled, false, 'mutations must be denied by default');

assert.equal(getPilotMutationSafety(safeTestnet).enabled, true, 'isolated testnet config should pass');

for (const [name, override] of Object.entries({
  production: { NODE_ENV: 'production' },
  mainnetPassphrase: { STELLAR_NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015' },
  foreignRpc: { STELLAR_RPC_URL: 'https://example.com' },
  foreignHorizon: { STELLAR_HORIZON_URL: 'https://example.com' },
  publicRelayer: { STELLAR_RELAYER_URL: 'https://relayer.example.com' },
  missingIsolationMode: { TRUSTLEAF_PILOT_RUNTIME: 'disabled' },
})) {
  assert.equal(
    getPilotMutationSafety({ ...safeTestnet, ...override }).enabled,
    false,
    `mutations must be denied for ${name}`,
  );
}

console.log('pilot-safety: 8 checks passed');
