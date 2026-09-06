import type { GameState } from '$lib/game-types';
import { completed, openVirtualPetDb, read } from './indexed-db';
import type {
  EventRecord,
  GameRecord,
  OutboxRecord,
  SyncAcknowledgement,
} from './types';

export async function nextOutbox(
  gameHash: string,
): Promise<OutboxRecord | null> {
  const db = await openVirtualPetDb();
  if (!db) return null;
  const transaction = db.transaction('outbox', 'readonly');
  const index = transaction.objectStore('outbox').index('gameHash');
  const values = (await read(
    index.getAll(IDBKeyRange.only(gameHash)),
  )) as OutboxRecord[];
  await completed(transaction);
  return (
    values.sort((left, right) => left.createdAt - right.createdAt)[0] ?? null
  );
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
        updatedAt: Date.now(),
      });
    outbox.delete(sent.batchId);
    const hasMore =
      pending.events.length > sent.events.length ||
      pending.commands.length > sent.commands.length ||
      pending.targetState.stateVersion !== sent.targetState.stateVersion;
    if (hasMore)
      outbox.put({
        ...pending,
        batchId: crypto.randomUUID(),
        baseStateVersion: acknowledgement.stateVersion,
        previousEventId: acknowledgement.committedThroughEventId,
        commands: pending.commands.slice(sent.commands.length),
        events: pending.events.slice(sent.events.length),
        createdAt: Date.now(),
        retryCount: 0,
      } satisfies OutboxRecord);
  }
  await completed(transaction);
}

export async function replacePending(
  pending: OutboxRecord,
  state: GameState,
  events: EventRecord[],
  baseStateVersion: number,
  baseEventSequence: number,
  previousEventId: string | null,
  contentVersion: string,
): Promise<boolean> {
  const db = await openVirtualPetDb();
  if (!db) return false;
  const transaction = db.transaction(
    ['games', 'gameEvents', 'outbox'],
    'readwrite',
  );
  const outbox = transaction.objectStore('outbox');
  const current = (await read(outbox.get(pending.batchId))) as
    OutboxRecord | undefined;
  if (
    !current ||
    current.commands.length !== pending.commands.length ||
    current.events.length !== pending.events.length ||
    current.targetState.stateVersion !== pending.targetState.stateVersion
  ) {
    await completed(transaction);
    return false;
  }
  const games = transaction.objectStore('games');
  const existing = (await read(games.get(pending.gameHash))) as
    GameRecord | undefined;
  games.put({
    ...(existing ?? {
      gameHash: pending.gameHash,
      createdAt: Date.now(),
    }),
    state,
    stateVersion: baseStateVersion,
    lastAcknowledgedSequence: baseEventSequence,
    lastAcknowledgedEventId: previousEventId,
    updatedAt: Date.now(),
  } satisfies GameRecord);
  const eventStore = transaction.objectStore('gameEvents');
  eventStore.delete(
    IDBKeyRange.bound(
      [pending.gameHash, baseEventSequence + 1],
      [pending.gameHash, Number.MAX_SAFE_INTEGER],
    ),
  );
  for (const event of events) eventStore.put(event);
  outbox.delete(pending.batchId);
  outbox.put({
    ...pending,
    batchId: crypto.randomUUID(),
    baseStateVersion,
    previousEventId,
    contentVersion,
    events,
    targetState: state,
    createdAt: Date.now(),
    retryCount: 0,
  } satisfies OutboxRecord);
  await completed(transaction);
  return true;
}

export async function noteRetry(batchId: string): Promise<void> {
  const db = await openVirtualPetDb();
  if (!db) return;
  const transaction = db.transaction('outbox', 'readwrite');
  const store = transaction.objectStore('outbox');
  const pending = (await read(store.get(batchId))) as OutboxRecord | undefined;
  if (pending) store.put({ ...pending, retryCount: pending.retryCount + 1 });
  await completed(transaction);
}
