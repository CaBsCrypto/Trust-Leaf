import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const MANIFEST_SCHEMA = 'trustleaf.testnet.predeploy-manifest/v1';

export const CONTRACT_PROFILES = Object.freeze([
  {
    logicalName: 'TrustRegistry',
    packageName: 'trust-registry',
    artifactFile: 'trust_registry.wasm',
    specFile: 'trust_registry.spec.json',
    expectedWasmSha256: '43830be9fc0013f8361f24727e80f74be39c7f230f482e3e20d834e0f8078936',
    expectedFunctions: ['expire', 'get_admin', 'get_credential', 'init', 'is_active', 'issue_actor', 'issue_eligibility', 'renew', 'set_state'],
    init: {
      entrypoint: 'init',
      args: [{ name: 'admin', type: 'Address', placeholder: '<APPROVED_ADMIN_QUORUM_ADDRESS>' }],
    },
  },
  {
    logicalName: 'ReceiptLedgerV2',
    packageName: 'receipt-ledger-v2',
    artifactFile: 'receipt_ledger_v2.wasm',
    specFile: 'receipt_ledger_v2.spec.json',
    expectedWasmSha256: '93eade96ebbf63881aa691cbbc107da871607bbed78be8d539aea264b88b3e14',
    expectedFunctions: ['activate', 'authorization_chain', 'expire', 'get_receipt', 'get_registry', 'init', 'issue', 'mark_dispensed', 'record_partial', 'revoke', 'set_grant'],
    init: {
      entrypoint: 'init',
      args: [
        { name: 'admin', type: 'Address', placeholder: '<APPROVED_ADMIN_QUORUM_ADDRESS>' },
        { name: 'registry', type: 'Address', placeholder: '<DEPLOYED_TRUST_REGISTRY_CONTRACT_ADDRESS>' },
      ],
    },
  },
]);

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function normalizeEvidenceText(value) {
  return value.replace(/\r\n/g, '\n');
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function describeType(type) {
  if (typeof type === 'string') return type === 'address' ? 'Address' : type;
  if (type?.bytes_n?.n) return `BytesN<${type.bytes_n.n}>`;
  if (type?.option?.value_type) return `Option<${describeType(type.option.value_type)}>`;
  if (type?.udt?.name) return type.udt.name;
  throw new Error('Unsupported IDL type');
}

export function extractFunctions(spec) {
  if (!Array.isArray(spec)) throw new Error('IDL spec must be an array');
  return spec.filter(entry => entry?.function_v0).map(entry => ({
    name: entry.function_v0.name,
    inputs: entry.function_v0.inputs.map(input => ({ name: input.name, type: describeType(input.type_) })),
  }));
}

function assertExactSet(actual, expected, code) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(code);
}

export function validateContractEvidence(evidence, profile) {
  if (!Buffer.isBuffer(evidence.wasm) || evidence.wasm.length === 0) throw new Error('ARTIFACT_MISSING');
  const wasmSha256 = sha256(evidence.wasm);
  if (wasmSha256 !== profile.expectedWasmSha256) throw new Error('ARTIFACT_HASH_MISMATCH');
  const functions = extractFunctions(evidence.spec);
  assertExactSet(functions.map(item => item.name), profile.expectedFunctions, 'IDL_FUNCTION_MISMATCH');
  const init = functions.find(item => item.name === profile.init.entrypoint);
  if (!init || JSON.stringify(init.inputs) !== JSON.stringify(profile.init.args.map(({ name, type }) => ({ name, type })))) {
    throw new Error('INIT_ARGS_MISMATCH');
  }
  return { wasmSha256, wasmBytes: evidence.wasm.length, functions };
}

export function buildManifest(evidenceByContract, profiles = CONTRACT_PROFILES) {
  const contracts = profiles.map(profile => {
    const evidence = evidenceByContract[profile.logicalName];
    if (!evidence) throw new Error('ARTIFACT_MISSING');
    const verified = validateContractEvidence(evidence, profile);
    const specCanonical = canonicalJson(evidence.spec);
    return {
      logicalName: profile.logicalName,
      packageName: profile.packageName,
      artifact: { buildOutput: profile.artifactFile, sha256: verified.wasmSha256, bytes: verified.wasmBytes },
      interface: {
        specOutput: profile.specFile,
        sha256: sha256(specCanonical),
        functions: verified.functions.map(item => item.name).sort(),
      },
    };
  });

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA,
    purpose: 'predeploy-evidence-only',
    executable: false,
    dataClassification: 'synthetic-only-no-pii-no-phi',
    toolchain: {
      stellarCli: '26.0.0',
      stellarXdr: '26.0.0',
      rustc: '1.95.0',
      cargo: '1.95.0',
      sorobanSdkCargoLock: '25.3.1',
      buildTarget: 'wasm32v1-none',
      cargoLocked: true,
    },
    target: {
      network: 'testnet',
      mainnetAllowed: false,
      networkPassphraseAllowlist: ['stellar-testnet-exact-match'],
      rpcOriginAllowlist: ['approved-testnet-rpc-origin'],
    },
    safetyFlags: {
      TRUSTLEAF_TESTNET_SUBMIT_ENABLED: false,
      TRUSTLEAF_ALLOW_TESTNET_MUTATIONS: false,
    },
    contracts,
    initialization: profiles.map((profile, index) => ({
      order: index + 1,
      contract: profile.logicalName,
      entrypoint: profile.init.entrypoint,
      args: profile.init.args,
    })),
    approvals: [
      { role: 'artifact-reviewer', duty: 'confirm-wasm-and-interface-fingerprints' },
      { role: 'security-reviewer', duty: 'confirm-privacy-allowlists-and-fail-closed-flags' },
      { role: 'admin-quorum', duty: 'approve-initialization-authority-and-kill-switch' },
      { role: 'deployment-operator', duty: 'execute-only-inside-separately-authorized-window' },
    ],
    deploymentAuthorization: 'not-granted',
  };
  validateManifestSafety(manifest);
  return manifest;
}

const FORBIDDEN_KEY = /(^|_)(secret|private|seed|mnemonic|xdr|account_id|contract_id|rpc_url|transaction_hash)($|_)/i;
const STELLAR_IDENTIFIER = /\b[CGMS][A-Z2-7]{55}\b/;
const URL = /https?:\/\//i;

export function validateManifestSafety(manifest) {
  if (manifest.schemaVersion !== MANIFEST_SCHEMA || manifest.executable !== false) throw new Error('MANIFEST_NOT_PREDEPLOY_ONLY');
  if (manifest.target?.network !== 'testnet' || manifest.target?.mainnetAllowed !== false) throw new Error('NETWORK_NOT_FAIL_CLOSED');
  if (Object.values(manifest.safetyFlags ?? {}).some(value => value !== false)) throw new Error('SAFETY_FLAG_OPEN');
  if (manifest.deploymentAuthorization !== 'not-granted') throw new Error('DEPLOYMENT_AUTHORIZATION_PRESENT');
  const walk = (value, key = '') => {
    if (FORBIDDEN_KEY.test(key)) throw new Error('FORBIDDEN_FIELD');
    if (typeof value === 'string' && (STELLAR_IDENTIFIER.test(value) || URL.test(value))) throw new Error('FORBIDDEN_VALUE');
    if (Array.isArray(value)) value.forEach(item => walk(item, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, child]) => walk(child, childKey));
  };
  walk(manifest);
  return true;
}

export async function readEvidence(artifactPath, spec) {
  return { wasm: await readFile(artifactPath), spec };
}
