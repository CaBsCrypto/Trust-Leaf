import assert from 'node:assert/strict';
import {
  KEY_CUSTODY_ROLES,
  assertSafeCustodyReport,
  createSyntheticCustodyProbe,
  runKeyCustodyPreflight,
  type CustodyRoleFinding,
  type KeyCustodyPreflightConfig,
  type KeyCustodyPreflightReport,
  type KeyCustodyRole,
} from '../api/_lib/key-custody-preflight.ts';

function safeFinding(role: KeyCustodyRole): CustodyRoleFinding {
  return {
    providerPresent: true,
    aliasPresent: true,
    balanceSufficient: true,
    versionPinned: true,
    rotationReady: true,
    revocationReady: true,
    recoveryReady: true,
    signingDisabled: true,
    dutyBoundary: `fixture-${role}`,
  };
}

function findings() {
  return Object.fromEntries(KEY_CUSTODY_ROLES.map(role => [role, safeFinding(role)])) as Record<KeyCustodyRole, CustodyRoleFinding>;
}

function config(): KeyCustodyPreflightConfig {
  return {
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
}

const safe = await runKeyCustodyPreflight({ config: config(), probe: createSyntheticCustodyProbe(findings()) });
assert.equal(safe.ready, true);
assert.equal(safe.counts.readyRoles, KEY_CUSTODY_ROLES.length);
assert.deepEqual(safe.roles.map(item => item.role), KEY_CUSTODY_ROLES);
assert.doesNotMatch(JSON.stringify(safe), /https?:\/\/|\b[GCMA][A-Z2-7]{55}\b|\b[a-f0-9]{64}\b/i);

const openFlags = config();
openFlags.testnetSubmitEnabled = true;
openFlags.testnetMutationsAllowed = true;
const open = await runKeyCustodyPreflight({ config: openFlags, probe: createSyntheticCustodyProbe(findings()) });
assert.equal(open.ready, false);
assert.equal(open.checks.submissionDisabled, false);
assert.equal(open.checks.mutationsDisabled, false);

const incompleteAllowlists = config();
incompleteAllowlists.allowlist = { ...incompleteAllowlists.allowlist, rpcUrls: [], contractIds: [] };
const blockedAllowlist = await runKeyCustodyPreflight({ config: incompleteAllowlists, probe: createSyntheticCustodyProbe(findings()) });
assert.equal(blockedAllowlist.ready, false);
assert.equal(blockedAllowlist.checks.rpcAllowlisted, false);
assert.equal(blockedAllowlist.checks.contractAllowlisted, false);

const sharedDuty = findings();
sharedDuty.operator.dutyBoundary = sharedDuty.deployer.dutyBoundary;
const noSeparation = await runKeyCustodyPreflight({ config: config(), probe: createSyntheticCustodyProbe(sharedDuty) });
assert.equal(noSeparation.ready, false);
assert.equal(noSeparation.checks.separationOfDuties, false);

const missingGates = findings();
missingGates['doctor-service'] = { ...missingGates['doctor-service'], rotationReady: false, revocationReady: false, recoveryReady: false };
const blockedLifecycle = await runKeyCustodyPreflight({ config: config(), probe: createSyntheticCustodyProbe(missingGates) });
assert.equal(blockedLifecycle.ready, false);
assert.equal(blockedLifecycle.roles.find(item => item.role === 'doctor-service')?.ready, false);

const throwingProbe = createSyntheticCustodyProbe(findings());
throwingProbe.inspectRole = async role => {
  if (role === 'operator') throw new Error(`do-not-return-${'S'}${'B'.repeat(55)}`);
  return safeFinding(role);
};
const unavailable = await runKeyCustodyPreflight({ config: config(), probe: throwingProbe });
assert.equal(unavailable.ready, false);
assert.equal(unavailable.roles.find(item => item.role === 'operator')?.ready, false);
assert.doesNotMatch(JSON.stringify(unavailable), /do-not-return|S[B]{55}/);

for (const malicious of [
  { ...safe, providerConfig: 'synthetic-sensitive-value' },
  { ...safe, blockers: [`G${'A'.repeat(55)}`] },
  { ...safe, blockers: [`S${'B'.repeat(55)}`] },
  { ...safe, blockers: ['https://rpc.invalid'] },
  { ...safe, blockers: ['a'.repeat(64)] },
]) {
  assert.throws(() => assertSafeCustodyReport(malicious as KeyCustodyPreflightReport), (error: unknown) => (error as { code?: string }).code === 'UNSAFE_CUSTODY_REPORT');
}

console.log('key-custody-preflight: 7 safe inventory, fail-closed and redaction scenarios passed');
