import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildManifest,
  canonicalJson,
  CONTRACT_PROFILES,
  normalizeEvidenceText,
  readEvidence,
} from './testnet-v2-predeploy-manifest-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'artifacts', 'testnet-v2');
const check = process.argv.includes('--check');

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`MISSING_ARGUMENT:${name}`);
  return path.resolve(process.argv[index + 1]);
}

async function emit(relativeName, contents) {
  const destination = path.join(outputDir, relativeName);
  if (check) {
    const current = await readFile(destination, 'utf8').catch(() => '');
    if (normalizeEvidenceText(current) !== normalizeEvidenceText(contents)) throw new Error(`CHECKED_IN_EVIDENCE_MISMATCH:${relativeName}`);
  } else {
    await writeFile(destination, contents, 'utf8');
  }
}

await mkdir(outputDir, { recursive: true });
const specInputs = {
  TrustRegistry: argument('--trust-spec'),
  ReceiptLedgerV2: argument('--receipt-spec'),
};
const evidenceByContract = {};
for (const profile of CONTRACT_PROFILES) {
  const wasmPath = path.join(outputDir, profile.artifactFile);
  const spec = JSON.parse(await readFile(specInputs[profile.logicalName], 'utf8'));
  evidenceByContract[profile.logicalName] = await readEvidence(wasmPath, spec);
  await emit(profile.specFile, canonicalJson(spec));
}

const manifest = buildManifest(evidenceByContract);
await emit('predeploy-manifest.json', canonicalJson(manifest));
process.stdout.write(JSON.stringify({
  status: check ? 'verified' : 'generated',
  deployAuthorized: false,
  networkAccessed: false,
  contractCount: manifest.contracts.length,
  artifacts: manifest.contracts.map(item => ({ logicalName: item.logicalName, bytes: item.artifact.bytes })),
}) + '\n');
