import { completed, read } from '../persistence/indexed-db';
import type { Operation } from './capture';
import {
  byteLength,
  digest,
  fragments,
  json,
  makeBatches,
  type PendingBatch,
} from './batches';

type PendingOperation = {
  operationId: string;
  owner: string;
  operation: Operation;
  bytes: number;
};
let database: Promise<IDBDatabase> | undefined;
const memory = new Map<string, PendingOperation>();
let writing: Promise<void> | undefined;

export function openLoggingDb(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('companion-gameplay-logging', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('operations', {
          keyPath: 'operationId',
        });
        request.result.createObjectStore('batches', { keyPath: 'batchId' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        database = undefined;
        reject(new Error('Logging database blocked.'));
      };
    });
  return database;
}

export function enqueueOperation(owner: string, operation: Operation): void {
  memory.set(operation.operationId, {
    owner,
    operation,
    operationId: operation.operationId,
    bytes: byteLength(json(operation)),
  });
  void persistMemory();
}

export function persistMemory(): Promise<void> {
  if (!memory.size && !writing) return Promise.resolve();
  return (writing ??= writeMemory().finally(() => {
    writing = undefined;
  }));
}

async function writeMemory(): Promise<void> {
  try {
    const db = await openLoggingDb();
    while (memory.size) {
      const pending = [...memory.values()];
      const transaction = db.transaction('operations', 'readwrite');
      for (const item of pending)
        transaction.objectStore('operations').put(item);
      await completed(transaction);
      for (const item of pending) memory.delete(item.operationId);
    }
  } catch {
    console.warn(
      'Gameplay logging could not persist; records remain in memory.',
    );
  }
}

export async function pendingBytes(owner: string): Promise<number> {
  const db = await openLoggingDb();
  const transaction = db.transaction('operations', 'readonly');
  const values = (await read(
    transaction.objectStore('operations').getAll(),
  )) as PendingOperation[];
  await completed(transaction);
  return values
    .filter((item) => item.owner === owner)
    .reduce((sum, item) => sum + item.bytes, 0);
}

export async function sealBatches(owner: string): Promise<void> {
  const db = await openLoggingDb();
  const readTransaction = db.transaction('operations', 'readonly');
  const values = (await read(
    readTransaction.objectStore('operations').getAll(),
  )) as PendingOperation[];
  await completed(readTransaction);
  const pending = values
    .filter((item) => item.owner === owner)
    .sort(
      (a, b) =>
        a.operation.recordedAt - b.operation.recordedAt ||
        a.operation.sequence - b.operation.sequence,
    );
  const batches = await Promise.all(
    makeBatches(pending.flatMap((item) => fragments(item.operation))).map(
      async (batch) => {
        const body = json(batch);
        return {
          batchId: batch.batchId,
          owner,
          body,
          digest: await digest(body),
          retryCount: 0,
          retryAt: 0,
          blocked: null,
          createdAt: Date.now(),
        } satisfies PendingBatch;
      },
    ),
  );
  if (!batches.length) return;
  const transaction = db.transaction(['operations', 'batches'], 'readwrite');
  for (const batch of batches) transaction.objectStore('batches').add(batch);
  for (const item of pending)
    transaction.objectStore('operations').delete(item.operationId);
  await completed(transaction);
}

export async function pendingBatches(owner: string): Promise<PendingBatch[]> {
  const db = await openLoggingDb();
  const transaction = db.transaction('batches', 'readonly');
  const values = (await read(
    transaction.objectStore('batches').getAll(),
  )) as PendingBatch[];
  await completed(transaction);
  return values
    .filter((batch) => batch.owner === owner)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateBatch(
  batch: PendingBatch,
  acknowledged = false,
): Promise<void> {
  const db = await openLoggingDb();
  const transaction = db.transaction('batches', 'readwrite');
  const store = transaction.objectStore('batches');
  const current = (await read(store.get(batch.batchId))) as
    PendingBatch | undefined;
  if (current?.digest === batch.digest && current.owner === batch.owner) {
    if (acknowledged) store.delete(batch.batchId);
    else store.put(batch);
  }
  await completed(transaction);
}
