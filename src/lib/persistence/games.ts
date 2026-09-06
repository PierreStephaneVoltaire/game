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
}

export async function listLocalGames(): Promise<GameRecord[]> {
  const db = await database();
  if (!db) return [];
  const transaction = db.transaction('games', 'readonly');
  const games = (await read(
    transaction.objectStore('games').getAll(),
  )) as GameRecord[];
  await completed(transaction);
  return games.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function saveNewGame(state: GameState): Promise<void> {
  const db = await database();
  if (!db) return;
  const gameHash = state.seed;
  const events = eventRecords(gameHash, 0, state.events);
  const transaction = db.transaction(
    ['games', 'gameEvents', 'outbox', 'metadata'],
    'readwrite',
  );
  transaction.objectStore('games').put({
    gameHash,
    state,
    stateVersion: 0,
    lastAcknowledgedSequence: 0,
    lastAcknowledgedEventId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } satisfies GameRecord);
  for (const event of events) transaction.objectStore('gameEvents').put(event);
  transaction.objectStore('outbox').put({
    batchId: batchId(),
    gameHash,
    baseStateVersion: 0,
    previousEventId: null,
    contentVersion: state.definitionVersion,
    commands: [],
    events,
    targetState: state,
    createdAt: Date.now(),
    retryCount: 0,
  } satisfies OutboxRecord);
  transaction
    .objectStore('metadata')
    .put({ key: ACTIVE_GAME_KEY, value: gameHash });
  await completed(transaction);
}

export async function saveTransition(
  before: GameState,
  after: GameState,
  command?: GameCommand,
): Promise<void> {
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
  if (last) {
    outbox.put({
      ...last,
      commands: command ? [...last.commands, command] : last.commands,
      events: [
        ...last.events,
        ...newEvents.filter((event) => event.sequence > acknowledgedSequence),
      ],
      targetState: after,
      contentVersion: after.definitionVersion,
    });
  } else {
    outbox.put({
      batchId: batchId(),
      gameHash,
      baseStateVersion: existing.stateVersion,
      previousEventId: existing.lastAcknowledgedEventId,
      contentVersion: after.definitionVersion,
      commands: command ? [command] : [],
      events: newEvents.filter(
        (event) => event.sequence > acknowledgedSequence,
      ),
      targetState: after,
      createdAt: Date.now(),
      retryCount: 0,
    } satisfies OutboxRecord);
  }
  await completed(transaction);
}
