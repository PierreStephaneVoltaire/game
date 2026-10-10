import { stateChanges } from '../telemetry/state-changes';
import { completed, openVirtualPetDb, read } from './indexed-db';
import type { GameRecord, OutboxRecord, SyncAcknowledgement } from './types';

export async function nextOutbox(
  gameHash: string,
): Promise<OutboxRecord | null> {
  const db = await openVirtualPetDb();
  if (!db) return null;
  const transaction = db.transaction('outbox', 'readonly');
  const values = (await read(
    transaction
      .objectStore('outbox')
      .index('gameHash')
      .getAll(IDBKeyRange.only(gameHash)),
  )) as OutboxRecord[];
  await completed(transaction);
  db.close();
  return values.sort((a, b) => a.createdAt - b.createdAt)[0] ?? null;
}

export async function markSent(
  pending: OutboxRecord,
): Promise<OutboxRecord | null> {
  const db = await openVirtualPetDb();
  if (!db) return pending;
  const transaction = db.transaction(['games', 'outbox'], 'readwrite');
  const outbox = transaction.objectStore('outbox');
  const current = (await read(outbox.get(pending.batchId))) as
    OutboxRecord | undefined;
  const games = transaction.objectStore('games');
  const game = (await read(games.get(pending.gameHash))) as
    GameRecord | undefined;
  let sent: OutboxRecord | null = null;
  if (current && game) {
    sent = current.attemptedAt
      ? current
      : {
          ...current,
          baseStateVersion: game.stateVersion,
          previousEventId: game.lastAcknowledgedEventId,
          attemptedAt: Date.now(),
        };
    outbox.put(sent);
    games.put({ ...game, lastSentBatchId: sent.batchId });
  }
  await completed(transaction);
  db.close();
  return sent;
}

export async function acknowledge(
  sent: OutboxRecord,
  acknowledgement: SyncAcknowledgement,
): Promise<void> {
  const db = await openVirtualPetDb();
  if (!db) return;
  const transaction = db.transaction(['games', 'outbox'], 'readwrite');
  const outbox = transaction.objectStore('outbox');
  const pending = (await read(outbox.get(sent.batchId))) as
    OutboxRecord | undefined;
  if (pending) {
    const games = transaction.objectStore('games');
    const game = (await read(games.get(pending.gameHash))) as
      GameRecord | undefined;
    if (game)
      games.put({
        ...game,
        stateVersion: acknowledgement.stateVersion,
        lastAcknowledgedSequence: acknowledgement.committedThroughSequence,
        lastAcknowledgedEventId: acknowledgement.committedThroughEventId,
        latestCommittedBatchId:
          acknowledgement.latestCommittedBatchId ?? sent.batchId,
      });
    outbox.delete(sent.batchId);
    const tail = pending.events.filter(
      (event) => event.sequence > acknowledgement.committedThroughSequence,
    );
    if (
      tail.length ||
      stateChanges(pending.targetState, sent.targetState).length > 0
    ) {
      outbox.put({
        ...pending,
        batchId: crypto.randomUUID(),
        creationBatchId: undefined,
        baseStateVersion: acknowledgement.stateVersion,
        previousEventId: acknowledgement.committedThroughEventId,
        commands: pending.commands.slice(sent.commands.length),
        events: tail,
        attemptedAt: undefined,
        retryCount: 0,
      } satisfies OutboxRecord);
    }
  }
  await completed(transaction);
  db.close();
}

export async function noteRetry(batchId: string): Promise<void> {
  const db = await openVirtualPetDb();
  if (!db) return;
  const transaction = db.transaction('outbox', 'readwrite');
  const store = transaction.objectStore('outbox');
  const pending = (await read(store.get(batchId))) as OutboxRecord | undefined;
  if (pending) store.put({ ...pending, retryCount: pending.retryCount + 1 });
  await completed(transaction);
  db.close();
}
