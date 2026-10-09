import { MAX_SAVE_EVENTS } from '../game-constants';
import type { GameCommand, GameEvent, GameState } from '$lib/game-types';
import { completed, openVirtualPetDb, read } from './indexed-db';
import type { EventRecord, GameRecord, OutboxRecord } from './types';

const ACTIVE_GAME_KEY = 'activeGameHash';

function batchId(): string {
  return crypto.randomUUID();
}

function eventsSince(before: GameState, after: GameState): GameEvent[] {
  return after.events.slice(before.events.length);
}

function eventRecords(
  gameHash: string,
  start: number,
  events: GameEvent[],
): EventRecord[] {
  return events.map((event, index) => ({
    ...event,
    gameHash,
    sequence: start + index + 1,
  }));
}

async function database(): Promise<IDBDatabase | null> {
  return openVirtualPetDb();
}

export async function loadGame(gameHash: string): Promise<GameRecord | null> {
  const db = await database();
  if (!db) return null;
  const transaction = db.transaction('games', 'readonly');
  const game = await read(transaction.objectStore('games').get(gameHash));
  await completed(transaction);
  db.close();
  return (game as GameRecord | undefined) ?? null;
}

export async function loadActiveGameHash(): Promise<string | null> {
  const db = await database();
  if (!db) return null;
  const transaction = db.transaction('metadata', 'readonly');
  const record = (await read(
    transaction.objectStore('metadata').get(ACTIVE_GAME_KEY),
  )) as { value?: unknown } | undefined;
  await completed(transaction);
  db.close();
  return typeof record?.value === 'string' ? record.value : null;
}

export async function setActiveGameHash(gameHash: string): Promise<void> {
  const db = await database();
  if (!db) return;
  const transaction = db.transaction('metadata', 'readwrite');
  transaction
    .objectStore('metadata')
    .put({ key: ACTIVE_GAME_KEY, value: gameHash });
  await completed(transaction);
  db.close();
}

export async function listLocalGames(): Promise<GameRecord[]> {
  const db = await database();
  if (!db) return [];
  const transaction = db.transaction('games', 'readonly');
  const games = (await read(
    transaction.objectStore('games').getAll(),
  )) as GameRecord[];
  await completed(transaction);
  db.close();
  return games.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function saveNewGame(
  state: GameState,
  capturePosition?: OutboxRecord['capturePosition'],
): Promise<void> {
  const db = await database();
  if (!db) return;
  const gameHash = state.seed;
  const events = eventRecords(gameHash, 0, state.events);
  const creationBatchId = batchId();
  const transaction = db.transaction(
    ['games', 'gameEvents', 'outbox', 'metadata'],
    'readwrite',
  );
  transaction.objectStore('games').put({
    gameHash,
    state,
    stateVersion: 0,
    creationBatchId,
    lastAcknowledgedSequence: 0,
    lastAcknowledgedEventId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } satisfies GameRecord);
  for (const event of events) transaction.objectStore('gameEvents').put(event);
  transaction.objectStore('outbox').put({
    batchId: creationBatchId,
    creationBatchId,
    gameHash,
    baseStateVersion: 0,
    previousEventId: null,
    contentVersion: state.definitionVersion,
    commands: [],
    events,
    targetState: state,
    capturePosition,
    createdAt: Date.now(),
    retryCount: 0,
  } satisfies OutboxRecord);
  transaction
    .objectStore('metadata')
    .put({ key: ACTIVE_GAME_KEY, value: gameHash });
  await completed(transaction);
  db.close();
}

export async function saveTransition(
  before: GameState,
  after: GameState,
  command?: GameCommand,
  capturePosition?: OutboxRecord['capturePosition'],
): Promise<void> {
  if (after === before) return;
  const db = await database();
  if (!db) return;
  const gameHash = after.seed;
  const transaction = db.transaction(
    ['games', 'gameEvents', 'outbox'],
    'readwrite',
  );
  const games = transaction.objectStore('games');
  const current = (await read(games.get(gameHash))) as GameRecord | undefined;
  const acknowledgedSequence = current?.lastAcknowledgedSequence ?? 0;
  const newEvents = eventRecords(
    gameHash,
    before.events.length,
    eventsSince(before, after),
  );
  const existing = current ?? {
    gameHash,
    state: before,
    stateVersion: 0,
    lastAcknowledgedSequence: 0,
    lastAcknowledgedEventId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  games.put({
    ...existing,
    state: after,
    updatedAt: Date.now(),
  } satisfies GameRecord);
  for (const event of newEvents)
    transaction.objectStore('gameEvents').put(event);
  const outbox = transaction.objectStore('outbox');
  const pending = (await read(
    outbox.index('gameHash').getAll(IDBKeyRange.only(gameHash)),
  )) as OutboxRecord[];
  const last = pending
    .sort((left, right) => left.createdAt - right.createdAt)
    .at(-1);
  const unsentEvents = newEvents.filter(
    (event) => event.sequence > acknowledgedSequence,
  );
  if (
    last &&
    !last.attemptedAt &&
    last.batchId !== existing.lastSentBatchId &&
    last.events.length + unsentEvents.length <= MAX_SAVE_EVENTS
  ) {
    outbox.put({
      ...last,
      commands: command ? [...last.commands, command] : last.commands,
      events: [...last.events, ...unsentEvents],
      targetState: after,
      capturePosition,
      contentVersion: after.definitionVersion,
    });
  } else {
    const cursor = {
      baseStateVersion: existing.stateVersion,
      previousEventId: existing.lastAcknowledgedEventId,
    };
    outbox.put({
      batchId: batchId(),
      gameHash,
      ...cursor,
      contentVersion: after.definitionVersion,
      commands: command ? [command] : [],
      events: unsentEvents,
      targetState: after,
      capturePosition,
      createdAt: Math.max(Date.now(), (last?.createdAt ?? 0) + 1),
      retryCount: 0,
    } satisfies OutboxRecord);
  }
  await completed(transaction);
  db.close();
}
