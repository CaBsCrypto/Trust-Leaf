import {
  DEPLOYED_RECEIPT_EVIDENCE_THROUGH_LEDGER,
  createDeployedStellarV1RpcDurableReader,
  loadDeployedV1ReaderConfig,
} from '../api/_lib/stellar-v1-durable-reader.ts';

const safeFailure = (code) => ({
  mode: 'testnet-readonly',
  ready: false,
  submissionAttempts: 0,
  mutationsAllowed: false,
  code: typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'READONLY_LIVE_CHECK_FAILED',
});

try {
  if (process.env.TRUSTLEAF_V1_READONLY_LIVE_ENABLED !== 'true') {
    throw Object.assign(new Error('Read-only live check disabled.'), { code: 'LIVE_READ_NOT_ENABLED' });
  }
  const stateDirectory = process.env.TRUSTLEAF_V1_INDEXER_STATE_DIRECTORY ?? '';
  const maxPolls = Number(process.env.TRUSTLEAF_V1_READONLY_MAX_POLLS ?? '64');
  if (!stateDirectory || !Number.isSafeInteger(maxPolls) || maxPolls < 1 || maxPolls > 128) {
    throw Object.assign(new Error('Read-only live configuration unavailable.'), { code: 'LIVE_READ_CONFIG_REJECTED' });
  }
  const config = loadDeployedV1ReaderConfig(process.env);
  const service = createDeployedStellarV1RpcDurableReader({
    config,
    stateDirectory,
  });
  let report = await service.start();
  let evidenceWindowComplete = false;
  for (let poll = 0; report.attested && poll < maxPolls; poll += 1) {
    report = await service.pollOnce();
    evidenceWindowComplete = (service.getCursor()?.sequence ?? 0) >= DEPLOYED_RECEIPT_EVIDENCE_THROUGH_LEDGER;
    if (evidenceWindowComplete) break;
    if (report.pollStatus === 'caught-up' || report.pollStatus === 'unknown' || report.pollStatus === 'rejected') break;
  }
  // The report intentionally contains no RPC URL, contract/receipt/event ID,
  // cursor/hash, XDR, identity or event body.
  console.log(JSON.stringify({ ...report, evidenceWindowComplete }));
  if (!report.ready || !evidenceWindowComplete) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify(safeFailure(error?.code)));
  process.exitCode = 1;
}
