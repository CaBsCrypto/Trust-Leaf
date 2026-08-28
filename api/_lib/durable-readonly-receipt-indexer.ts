import { createSimulatedReceiptIndexer, type IndexedReceiptEvent, type SimulatedLedger } from './receipt-indexer.ts';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

export interface DurableReceiptIndexerSnapshot {
  schemaVersion: 1;
  revision: number;
  ledgers: readonly SimulatedLedger[];
  updatedAt: number;
}

/**
 * Storage boundary for a durable cursor/canonical-ledger journal.
 * Implementations must make compareAndSwap atomic. No clinical payload belongs here.
 */
export interface DurableReceiptIndexerStorePort {
  readonly kind: 'fixture-memory' | 'local-file' | 'durable-database';
  load(): Promise<DurableReceiptIndexerSnapshot | null>;
  compareAndSwap(expectedRevision: number, next: DurableReceiptIndexerSnapshot): Promise<boolean>;
}

export interface DurableReadonlyReceiptIndexer {
  recover(): Promise<void>;
  ingest(ledger: SimulatedLedger): Promise<'stored' | 'replayed'>;
  rewindFrom(sequence: number): Promise<void>;
  getCursor(): { sequence: number; hash: string } | null;
  getReceiptTimeline(receiptId: string): readonly IndexedReceiptEvent[];
  getHealth(): { mode: 'read-only'; durable: boolean; recovered: boolean; revision: number; ledgerCount: number };
}

const MAX_CANONICAL_LEDGERS = 10_000;

export function createMemoryDurableReceiptIndexerStore(): DurableReceiptIndexerStorePort {
  let value: DurableReceiptIndexerSnapshot | null = null;
  return {
    kind: 'fixture-memory',
    async load() { return value ? cloneSnapshot(value) : null; },
    async compareAndSwap(expectedRevision, next) {
      const currentRevision = value?.revision ?? 0;
      if (currentRevision !== expectedRevision) return false;
      value = cloneSnapshot(next);
      return true;
    },
  };
}

/**
 * Local single-host durability adapter for synthetic review and operator dry runs.
 * The journal contains only opaque chain evidence. A bounded atomic lock protects
 * compare-and-swap across local processes; production still requires a reviewed
 * durable database adapter.
 */
export function createLocalFileDurableReceiptIndexerStore(input: {
  stateDirectory: string;
  fileName?: string;
  lockAttempts?: number;
  lockDelayMs?: number;
}): DurableReceiptIndexerStorePort {
  if (!isAbsolute(input.stateDirectory)) throw safe('INDEXER_STATE_DIRECTORY_REJECTED');
  const stateDirectory = resolve(input.stateDirectory);
  const fileName = input.fileName ?? 'receipt-indexer-v2.json';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}\.json$/.test(fileName) || basename(fileName) !== fileName) {
    throw safe('INDEXER_STATE_FILE_REJECTED');
  }
  const filePath = resolve(join(stateDirectory, fileName));
  if (dirname(filePath) !== stateDirectory) throw safe('INDEXER_STATE_FILE_REJECTED');
  const lockPath = `${filePath}.lock`;
  const lockAttempts = Math.max(1, Math.min(input.lockAttempts ?? 20, 100));
  const lockDelayMs = Math.max(1, Math.min(input.lockDelayMs ?? 10, 250));

  const loadFile = async (): Promise<DurableReceiptIndexerSnapshot | null> => {
    try {
      const metadata = await stat(filePath);
      if (!metadata.isFile() || metadata.size > 16 * 1024 * 1024) throw safe('INDEXER_SNAPSHOT_INVALID');
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as DurableReceiptIndexerSnapshot;
      validateSnapshot(parsed);
      return cloneSnapshot(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      if ((error as { code?: string }).code === 'INDEXER_SNAPSHOT_INVALID') throw error;
      throw safe('INDEXER_SNAPSHOT_INVALID');
    }
  };

  const withLock = async <T>(operation: () => Promise<T>): Promise<T> => {
    await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    for (let attempt = 1; attempt <= lockAttempts; attempt += 1) {
      try {
        handle = await open(lockPath, 'wx', 0o600);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw safe('INDEXER_STORAGE_UNAVAILABLE');
        if (attempt === lockAttempts) throw safe('INDEXER_STORAGE_BUSY');
        await new Promise(resolveDelay => setTimeout(resolveDelay, lockDelayMs));
      }
    }
    try {
      return await operation();
    } finally {
      await handle?.close();
      await unlink(lockPath).catch(error => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw safe('INDEXER_STORAGE_UNAVAILABLE');
      });
    }
  };

  return {
    kind: 'local-file',
    load: loadFile,
    async compareAndSwap(expectedRevision, next) {
      validateSnapshot(next);
      return withLock(async () => {
        const current = await loadFile();
        if ((current?.revision ?? 0) !== expectedRevision) return false;
        const temporaryPath = `${filePath}.tmp-${process.pid}-${next.revision}`;
        try {
          await writeFile(temporaryPath, `${JSON.stringify(next)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
          await rename(temporaryPath, filePath);
        } catch {
          await unlink(temporaryPath).catch(() => undefined);
          throw safe('INDEXER_STORAGE_UNAVAILABLE');
        }
        return true;
      });
    },
  };
}

export function createDurableReadonlyReceiptIndexer(input: {
  store: DurableReceiptIndexerStorePort;
  finalityDepth?: number;
  now?: () => number;
}): DurableReadonlyReceiptIndexer {
  const now = input.now ?? (() => Date.now());
  let snapshot = emptySnapshot(now());
  let indexer = createSimulatedReceiptIndexer({ finalityDepth: input.finalityDepth });
  let recovered = false;

  const hydrate = (candidate: DurableReceiptIndexerSnapshot) => {
    validateSnapshot(candidate);
    const rebuilt = createSimulatedReceiptIndexer({ finalityDepth: input.finalityDepth });
    for (const ledger of candidate.ledgers) rebuilt.ingest(cloneLedger(ledger));
    snapshot = cloneSnapshot(candidate);
    indexer = rebuilt;
  };

  return {
    async recover() {
      const stored = await input.store.load();
      hydrate(stored ?? emptySnapshot(now()));
      recovered = true;
    },
    async ingest(ledger) {
      if (!recovered) throw safe('INDEXER_NOT_RECOVERED');
      const existing = snapshot.ledgers.find(candidate => candidate.sequence === ledger.sequence);
      if (existing?.hash === ledger.hash) return 'replayed';
      const cursor = indexer.getCursor();
      if (cursor && !existing && ledger.sequence <= cursor.sequence) throw safe('INDEXER_SEQUENCE_REJECTED');

      // A replacement at the same height is a canonical reorg. Higher ledgers are
      // discarded and must be fetched again from the read-only source.
      const canonical = snapshot.ledgers
        .filter(candidate => candidate.sequence < ledger.sequence)
        .concat(cloneLedger(ledger))
        .sort((left, right) => left.sequence - right.sequence);
      if (canonical.length > MAX_CANONICAL_LEDGERS) throw safe('INDEXER_RETENTION_LIMIT');

      const candidate: DurableReceiptIndexerSnapshot = {
        schemaVersion: 1,
        revision: snapshot.revision + 1,
        ledgers: canonical,
        updatedAt: now(),
      };
      // Rebuild before persistence so gaps, parent mismatch, invalid opaque IDs and
      // event-version conflicts fail without advancing the durable cursor.
      const rebuilt = createSimulatedReceiptIndexer({ finalityDepth: input.finalityDepth });
      for (const item of candidate.ledgers) rebuilt.ingest(cloneLedger(item));
      if (!await input.store.compareAndSwap(snapshot.revision, candidate)) throw safe('INDEXER_CONCURRENT_UPDATE');
      snapshot = cloneSnapshot(candidate);
      indexer = rebuilt;
      return 'stored';
    },
    async rewindFrom(sequence) {
      if (!recovered) throw safe('INDEXER_NOT_RECOVERED');
      if (!Number.isSafeInteger(sequence) || sequence < 1) throw safe('INDEXER_SEQUENCE_REJECTED');
      const retained = snapshot.ledgers.filter(candidate => candidate.sequence < sequence).map(cloneLedger);
      if (retained.length === snapshot.ledgers.length) return;
      const candidate: DurableReceiptIndexerSnapshot = {
        schemaVersion: 1,
        revision: snapshot.revision + 1,
        ledgers: retained,
        updatedAt: now(),
      };
      const rebuilt = createSimulatedReceiptIndexer({ finalityDepth: input.finalityDepth });
      for (const item of candidate.ledgers) rebuilt.ingest(cloneLedger(item));
      if (!await input.store.compareAndSwap(snapshot.revision, candidate)) throw safe('INDEXER_CONCURRENT_UPDATE');
      snapshot = cloneSnapshot(candidate);
      indexer = rebuilt;
    },
    getCursor() {
      if (!recovered) return null;
      return indexer.getCursor();
    },
    getReceiptTimeline(receiptId) {
      if (!recovered || !/^[a-zA-Z0-9_-]{16,128}$/.test(receiptId)) return [];
      return indexer.getReceiptTimeline(receiptId);
    },
    getHealth() {
      return {
        mode: 'read-only',
        durable: input.store.kind !== 'fixture-memory',
        recovered,
        revision: snapshot.revision,
        ledgerCount: snapshot.ledgers.length,
      };
    },
  };
}

function validateSnapshot(value: DurableReceiptIndexerSnapshot) {
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0) throw safe('INDEXER_SNAPSHOT_INVALID');
  if (!Array.isArray(value.ledgers) || value.ledgers.length > MAX_CANONICAL_LEDGERS) throw safe('INDEXER_SNAPSHOT_INVALID');
  for (let index = 1; index < value.ledgers.length; index += 1) {
    if (value.ledgers[index].sequence !== value.ledgers[index - 1].sequence + 1) throw safe('INDEXER_SNAPSHOT_INVALID');
  }
}

function emptySnapshot(updatedAt: number): DurableReceiptIndexerSnapshot {
  return { schemaVersion: 1, revision: 0, ledgers: [], updatedAt };
}
function cloneLedger(value: SimulatedLedger): SimulatedLedger {
  return { ...value, events: value.events.map(event => ({ ...event })) };
}
function cloneSnapshot(value: DurableReceiptIndexerSnapshot): DurableReceiptIndexerSnapshot {
  return { ...value, ledgers: value.ledgers.map(cloneLedger) };
}
function safe(code: string) {
  return Object.assign(new Error('Read-only receipt indexer unavailable.'), { code });
}
