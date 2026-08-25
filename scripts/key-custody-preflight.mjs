import { runKeyCustodyPreflight, createSyntheticCustodyProbe, KEY_CUSTODY_ROLES } from '../api/_lib/key-custody-preflight.ts';

const safeFinding = role => ({
  providerPresent: true,
  aliasPresent: true,
  balanceSufficient: true,
  versionPinned: true,
  rotationReady: true,
  revocationReady: true,
  recoveryReady: true,
  signingDisabled: true,
  dutyBoundary: `fixture-${role}`,
});

const fixture = Object.fromEntries(KEY_CUSTODY_ROLES.map(role => [role, safeFinding(role)]));
const config = {
  testnetSubmitEnabled: false,
  testnetMutationsAllowed: false,
  network: 'testnet',
  networkPassphrase: 'synthetic-testnet-passphrase',
  rpcUrl: 'https://rpc.invalid',
  contractId: `C${'A'.repeat(55)}`,
  artifactHash: 'a'.repeat(64),
  allowlist: {
    networks: ['testnet'],
    networkPassphrases: ['synthetic-testnet-passphrase'],
    rpcUrls: ['https://rpc.invalid'],
    contractIds: [`C${'A'.repeat(55)}`],
    artifactHashes: ['a'.repeat(64)],
  },
  adminApproval: { multisigConfigured: true, quorumConfigured: true, noSingleSigner: true },
};

const report = await runKeyCustodyPreflight({ config, probe: createSyntheticCustodyProbe(fixture) });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ready) process.exitCode = 1;
