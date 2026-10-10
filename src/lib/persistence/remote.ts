import type { GameEvent, GameState } from '../game-types';
import { completed, openVirtualPetDb, read } from './indexed-db';
import type { EventRecord, GameRecord, OutboxRecord } from './types';

export type RemoteGame = {
  gameHash: string;
  stateVersion: number;
  lastEventSequence: number;
  lastEventId: string | null;
  creationBatchId?: string | null;
  latestCommittedBatchId?: string | null;
  state: GameState;
};

type WireEvent = {
  sequence: number;
  eventId: string;
  eventType: GameEvent['type'];
  eventAt: string;
  payload: Omit<GameEvent, 'id' | 'type' | 'at'>;
};

export class SavedGameUnavailableError extends Error {}

async function requestSavedGame(
  url: string,
  headers: HeadersInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(30_000),
      headers,
    });
  } catch {
    throw new SavedGameUnavailableError(
      'The saved game connection is unavailable.',
    );
  }
  if (response.status >= 500)
    throw new SavedGameUnavailableError(
      'The saved game service is unavailable.',
    );
  return response;
}

export async function downloadGame(
  gameHash: string,
): Promise<RemoteGame | null> {
  const headers = { 'x-game-key': gameHash };
  const response = await requestSavedGame('/api/games/current', headers);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not download the saved game.');
  const remote = (await response.json()) as RemoteGame;
  if (
    remote.gameHash !== gameHash ||
    remote.state.seed !== gameHash ||
    !Number.isSafeInteger(remote.stateVersion) ||
    !Number.isSafeInteger(remote.lastEventSequence)
  )
    throw new Error('Invalid saved game.');
  const events: GameEvent[] = [];
  let continuation: string | null = null;
  const cursors = new Set<string>();
  do {
    const page = await requestSavedGame('/api/games/current/events?limit=100', {
      ...headers,
      ...(continuation ? { 'x-continuation-token': continuation } : {}),
    });
    if (!page.ok) throw new Error('Could not download game history.');
    const body = (await page.json()) as {
      items: WireEvent[];
      continuationToken: string | null;
    };
    for (const event of body.items) {
      if (event.sequence > remote.lastEventSequence) break;
      if (event.sequence !== events.length + 1)
        throw new Error('Incomplete saved history.');
      events.push({
        ...event.payload,
        id: event.eventId,
        type: event.eventType,
        at: Date.parse(event.eventAt),
      });
    }
    continuation = body.continuationToken;
    if (continuation && cursors.has(continuation))
      throw new Error('Repeated history cursor.');
    if (continuation) cursors.add(continuation);
  } while (continuation && events.length < remote.lastEventSequence);
  if (
    events.length !== remote.lastEventSequence ||
    (events.at(-1)?.id ?? null) !== remote.lastEventId
  )
    throw new Error('Incomplete saved history.');
  if (!remote.state.events.length) remote.state = { ...remote.state, events };
  if (remote.state.events.length !== events.length)
    throw new Error('Saved snapshot and history disagree.');
  if (events.some((event, index) => remote.state.events[index].id !== event.id))
    throw new Error('Saved snapshot and history disagree.');
  return remote;
}

export async function cacheRemoteGame(
  remote: RemoteGame,
  discardPending = false,
): Promise<OutboxRecord[]> {
  const db = await openVirtualPetDb();
  if (!db) return [];
  const transaction = db.transaction(
    ['games', 'gameEvents', 'outbox'],
    'readwrite',
  );
  const outbox = transaction.objectStore('outbox');
  const pending = (await read(
    outbox.index('gameHash').getAll(IDBKeyRange.only(remote.gameHash)),
  )) as OutboxRecord[];
  if (pending.length && !discardPending) {
    await completed(transaction);
    db.close();
    throw new Error(
      'Unsent gameplay must be reconciled before replacing its cache.',
    );
  }
  const games = transaction.objectStore('games');
  const existing = (await read(games.get(remote.gameHash))) as
    GameRecord | undefined;
  games.put({
    gameHash: remote.gameHash,
    state: remote.state,
    stateVersion: remote.stateVersion,
    creationBatchId: remote.creationBatchId,
    latestCommittedBatchId: remote.latestCommittedBatchId,
    lastAcknowledgedSequence: remote.lastEventSequence,
    lastAcknowledgedEventId: remote.lastEventId,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  } satisfies GameRecord);
  for (const batch of pending) outbox.delete(batch.batchId);
  const events = transaction.objectStore('gameEvents');
  events.delete(
    IDBKeyRange.bound(
      [remote.gameHash, 0],
      [remote.gameHash, Number.MAX_SAFE_INTEGER],
    ),
  );
  remote.state.events.forEach((event, index) =>
    events.put({
      ...event,
      gameHash: remote.gameHash,
      sequence: index + 1,
    } satisfies EventRecord),
  );
  await completed(transaction);
  db.close();
  return pending;
}
