import assert from 'node:assert/strict';
import {
  buildManifest,
  canonicalJson,
  CONTRACT_PROFILES,
  normalizeEvidenceText,
  sha256,
  validateContractEvidence,
  validateManifestSafety,
} from '../scripts/testnet-v2-predeploy-manifest-lib.mjs';

function typeOf(type) {
  if (type === 'Address') return 'address';
  throw new Error(`unsupported fixture type ${type}`);
}

function fixtureSpec(profile) {
  return profile.expectedFunctions.map(name => ({
    function_v0: {
      name,
      inputs: name === profile.init.entrypoint
        ? profile.init.args.map(arg => ({ name: arg.name, type_: typeOf(arg.type) }))
        : [],
      outputs: [],
      doc: '',
    },
  }));
}

function fixtureProfiles() {
  return CONTRACT_PROFILES.map((profile, index) => {
    const wasm = Buffer.from(`synthetic-wasm-${index}`);
    return { ...profile, expectedWasmSha256: sha256(wasm), wasm };
  });
}

const profiles = fixtureProfiles();
const evidence = Object.fromEntries(profiles.map(profile => [profile.logicalName, { wasm: profile.wasm, spec: fixtureSpec(profile) }]));
const manifest = buildManifest(evidence, profiles);
assert.equal(manifest.executable, false);
assert.equal(manifest.deploymentAuthorization, 'not-granted');
assert.deepEqual(Object.values(manifest.safetyFlags), [false, false]);
assert.equal(manifest.initialization[0].contract, 'TrustRegistry');
assert.equal(manifest.initialization[1].contract, 'ReceiptLedgerV2');
assert.equal(validateManifestSafety(manifest), true);

assert.throws(() => buildManifest({ ...evidence, TrustRegistry: undefined }, profiles), /ARTIFACT_MISSING/);
assert.throws(() => validateContractEvidence({ ...evidence.TrustRegistry, wasm: Buffer.from('tampered') }, profiles[0]), /ARTIFACT_HASH_MISMATCH/);

const missingFunction = fixtureSpec(profiles[0]).slice(1);
assert.throws(() => validateContractEvidence({ wasm: profiles[0].wasm, spec: missingFunction }, profiles[0]), /IDL_FUNCTION_MISMATCH/);

const wrongArgs = structuredClone(fixtureSpec(profiles[1]));
wrongArgs.find(item => item.function_v0.name === 'init').function_v0.inputs[1].name = 'untrusted_registry';
assert.throws(() => validateContractEvidence({ wasm: profiles[1].wasm, spec: wrongArgs }, profiles[1]), /INIT_ARGS_MISMATCH/);

for (const unsafe of [
  { ...manifest, executable: true },
  { ...manifest, target: { ...manifest.target, network: 'mainnet' } },
  { ...manifest, safetyFlags: { ...manifest.safetyFlags, TRUSTLEAF_TESTNET_SUBMIT_ENABLED: true } },
  { ...manifest, deploymentAuthorization: 'granted' },
  { ...manifest, secret_key: 'synthetic-but-forbidden' },
  { ...manifest, rpc_url: 'https://rpc.invalid' },
  { ...manifest, unexpected: `C${'A'.repeat(55)}` },
]) assert.throws(() => validateManifestSafety(unsafe));

assert.equal(canonicalJson(manifest), canonicalJson(buildManifest(evidence, profiles)), 'manifest must be deterministic');
assert.equal(normalizeEvidenceText(canonicalJson(manifest).replace(/\n/g, '\r\n')), canonicalJson(manifest), 'line endings must not invalidate Windows checkouts');
assert.equal(canonicalJson(manifest).includes(new Date().toISOString()), false);
console.log('testnet-v2-predeploy-manifest: 12 positive/negative deterministic and sanitization checks passed');
