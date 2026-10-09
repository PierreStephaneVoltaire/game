import { acknowledge, markSent, nextOutbox, noteRetry } from './outbox';
import type { EventRecord, OutboxRecord, SyncAcknowledgement } from './types';

type ErrorBody = { error?: { code?: string; latestVersion?: string } };
type WriteResponse = Partial<SyncAcknowledgement> & {
  lastEventSequence?: number;
  lastEventId?: string | null;
};

export type SyncHooks = {
  refreshContent?: (latestVersion?: string) => Promise<void>;
  replayConflict?: (gameHash: string) => Promise<void>;
  confirmed?: (
    pending: OutboxRecord,
    acknowledgement: SyncAcknowledgement,
  ) => void;
};

const active = new Set<string>();
const REPLAYABLE_CONFLICTS = new Set(['STALE_STATE', 'EVENT_CONFLICT']);

function wireEvent(event: EventRecord) {
  const { gameHash: _gameHash, sequence, id, type, at, ...payload } = event;
  void _gameHash;
  return {
    sequence,
    eventId: id,
    eventType: type,
    eventAt: new Date(at).toISOString(),
    payload,
  };
}

function writeBody(pending: OutboxRecord) {
  return {
    batchId: pending.batchId,
    previousEventId: pending.previousEventId,
    targetState: pending.targetState,
    events: pending.events.map(wireEvent),
  };
}

async function error(response: Response): Promise<ErrorBody> {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    return {};
  }
}

async function currentContent(pending: OutboxRecord): Promise<string | null> {
  const response = await fetch('/api/content/manifest', {
    headers: { 'if-none-match': `"${pending.contentVersion}"` },
    credentials: 'same-origin',
  });
  if (response.status === 304) return pending.contentVersion;
  if (!response.ok) return pending.contentVersion;
  return ((await response.json()) as { version?: string }).version ?? null;
}

async function create(pending: OutboxRecord): Promise<Response> {
  return fetch('/api/games', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-content-version': pending.contentVersion,
    },
    body: JSON.stringify({
      gameHash: pending.gameHash,
      stateSchemaVersion: 1,
      state: pending.targetState,
      events: pending.events.map(wireEvent),
    }),
  });
}

async function send(pending: OutboxRecord): Promise<Response> {
  const ending = pending.targetState.ending;
  const death = ending?.kind === 'death';
  const endingEventIds = ending?.kind === 'death' ? ending.eventIds : [];
  const response = await fetch(`/api/games/current${death ? '/death' : ''}`, {
    method: death ? 'POST' : 'PUT',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-game-key': pending.gameHash,
      'if-match': `"${pending.baseStateVersion}"`,
      'x-content-version': pending.contentVersion,
    },
    body: JSON.stringify({
      ...writeBody(pending),
      ...(death ? { causeEventId: endingEventIds.at(-1) } : {}),
    }),
  });
  return response.status === 404 && pending.baseStateVersion === 0
    ? create(pending)
    : response;
}

function acknowledgement(
  body: WriteResponse,
  pending: OutboxRecord,
): SyncAcknowledgement | null {
  if (typeof body.stateVersion !== 'number') return null;
  if (typeof body.committedThroughSequence === 'number')
    return body as SyncAcknowledgement;
  if (typeof body.lastEventSequence !== 'number') return null;
  return {
    gameHash: pending.gameHash,
    stateVersion: body.stateVersion,
    committedThroughSequence: body.lastEventSequence,
    committedThroughEventId: body.lastEventId ?? null,
  };
}

export async function flushGame(
  gameHash: string,
  hooks: SyncHooks = {},
): Promise<void> {
  if (active.has(gameHash)) return;
  active.add(gameHash);
  let replayed = false;
  try {
    while (true) {
      const pending = await nextOutbox(gameHash);
      if (!pending) return;
      try {
        const version = await currentContent(pending);
        if (version !== pending.contentVersion) {
          if (replayed || !hooks.refreshContent || !hooks.replayConflict)
            return;
          replayed = true;
          await hooks.refreshContent(version ?? undefined);
          await hooks.replayConflict(gameHash);
          continue;
        }
        const sent = await markSent(pending);
        if (!sent) continue;
        const response = await send(sent);
        if (response.ok) {
          const committed = acknowledgement(
            (await response.json()) as WriteResponse,
            sent,
          );
          if (committed) {
            await acknowledge(sent, committed);
            try {
              hooks.confirmed?.(sent, committed);
            } catch {
              console.warn('Gameplay save confirmation trace failed.');
            }
          } else await noteRetry(pending.batchId);
          if (!committed) return;
          continue;
        }
        if (response.status === 429) return;
        const body = await error(response);
        const code = body.error?.code ?? '';
        if (code === 'CONTENT_VERSION_OUTDATED' && !replayed) {
          if (!hooks.refreshContent || !hooks.replayConflict) return;
          replayed = true;
          await hooks.refreshContent(body.error?.latestVersion);
          await hooks.replayConflict(gameHash);
          continue;
        }
        if (REPLAYABLE_CONFLICTS.has(code) && !replayed) {
          if (!hooks.replayConflict) return;
          replayed = true;
          await hooks.replayConflict(gameHash);
          continue;
        }
        await noteRetry(pending.batchId);
        return;
      } catch {
        await noteRetry(pending.batchId);
        return;
      }
    }
  } finally {
    active.delete(gameHash);
  }
}
