import { waitForWriteSlot } from './write-spacing';
import { acknowledge, markSent, nextOutbox, noteRetry } from './outbox';
import { committedSave } from './replay';
import { cacheRemoteGame, downloadGame, type RemoteGame } from './remote';
import type { GameState } from '../game-types';
import { withGameLock } from './locks';
import type { EventRecord, OutboxRecord, SyncAcknowledgement } from './types';

type ErrorBody = {
  error?: { code?: string; message?: string; requestId?: string };
};
export type SyncHooks = {
  refreshContent?: () => Promise<void>;
  adoptRemote?: (remote: RemoteGame, pending: OutboxRecord) => Promise<void>;
  confirmed?: (
    pending: OutboxRecord,
    acknowledgement: SyncAcknowledgement,
  ) => void;
  rejected?: (pending: OutboxRecord, detail: Record<string, unknown>) => void;
};
const active = new Map<string, Promise<void>>();
const CONFLICTS = new Set([
  'STALE_STATE',
  'EVENT_CONFLICT',
  'GAME_HASH_CONFLICT',
]);

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

async function send(pending: OutboxRecord): Promise<Response> {
  const ending = pending.targetState.ending;
  const death = ending?.kind === 'death';
  const creating = Boolean(pending.creationBatchId);
  const response = await fetch(
    creating ? '/api/games' : `/api/games/current${death ? '/death' : ''}`,
    {
      method: creating || death ? 'POST' : 'PUT',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'content-type': 'application/json',
        'x-game-key': pending.gameHash,
        'if-match': `"${pending.baseStateVersion}"`,
        'x-content-version': pending.contentVersion,
        'x-request-id': pending.batchId,
      },
      body: JSON.stringify(
        creating
          ? {
              gameHash: pending.gameHash,
              creationBatchId: pending.creationBatchId,
              stateSchemaVersion: 1,
              state: { ...pending.targetState, events: [] },
              events: pending.events.map(wireEvent),
            }
          : {
              batchId: pending.batchId,
              previousEventId: pending.previousEventId,
              targetState: { ...pending.targetState, events: [] },
              events: pending.events.map(wireEvent),
              ...(death ? { causeEventId: ending.eventIds.at(-1) } : {}),
            },
      ),
    },
  );
  if (response.status === 404 && !creating && pending.baseStateVersion === 0)
    return send({ ...pending, creationBatchId: pending.batchId });
  return response;
}

function acknowledgement(
  body: Record<string, unknown>,
  pending: OutboxRecord,
): SyncAcknowledgement | null {
  const sequence = body.committedThroughSequence ?? body.lastEventSequence;
  const eventId = body.committedThroughEventId ?? body.lastEventId ?? null;
  if (
    (body.gameHash !== undefined && body.gameHash !== pending.gameHash) ||
    (body.latestCommittedBatchId !== undefined &&
      body.latestCommittedBatchId !== pending.batchId) ||
    !Number.isSafeInteger(body.stateVersion) ||
    Number(body.stateVersion) < 0 ||
    !Number.isSafeInteger(sequence) ||
    Number(sequence) < 0 ||
    (eventId !== null && typeof eventId !== 'string')
  )
    return null;
  if (
    sequence !==
      (pending.events.at(-1)?.sequence ?? pending.targetState.events.length) ||
    eventId !== (pending.events.at(-1)?.id ?? pending.previousEventId)
  )
    return null;
  return {
    gameHash: pending.gameHash,
    stateVersion: body.stateVersion as number,
    committedThroughSequence: sequence as number,
    committedThroughEventId: eventId,
    latestCommittedBatchId: pending.batchId,
  };
}

function ledgerProblem(pending: OutboxRecord): string | null {
  const ledgerIds = pending.targetState.events.map(({ id }) => id);
  if (new Set(ledgerIds).size !== ledgerIds.length)
    return 'Local event IDs are not unique.';
  const first = pending.events[0]?.sequence ?? 0;
  if (pending.events.some(({ sequence }, index) => sequence !== first + index))
    return 'Local event sequences are not contiguous.';
  return null;
}

function hasNewerProgress(remote: RemoteGame, pending: OutboxRecord) {
  return (
    remote.stateVersion > pending.baseStateVersion ||
    remote.lastEventId !== pending.previousEventId
  );
}

function metricDifferences(local: GameState, remote: GameState) {
  const differences: Record<string, number> = {};
  for (const metric of Object.keys(local.metrics) as Array<
    keyof GameState['metrics']
  >) {
    const delta = remote.metrics[metric] - local.metrics[metric];
    if (delta) differences[metric] = delta;
  }
  if (remote.balance !== local.balance)
    differences.balance = remote.balance - local.balance;
  return differences;
}

function notify(task: () => void): void {
  try {
    task();
  } catch {
    console.warn('Gameplay save diagnostic failed.');
  }
}

function rejectionDetail(sent: OutboxRecord) {
  return {
    batchId: sent.batchId,
    baseStateVersion: sent.baseStateVersion,
    localStateVersion: sent.targetState.stateVersion,
    previousEventId: sent.previousEventId,
    firstSequence: sent.events[0]?.sequence,
    throughSequence: sent.events.at(-1)?.sequence,
  };
}

async function flush(gameHash: string, hooks: SyncHooks): Promise<void> {
  try {
    await hooks.refreshContent?.();
  } catch {
    console.warn(
      'Content refresh failed; saving with the recorded definitions.',
    );
  }
  while (true) {
    const pending = await nextOutbox(gameHash);
    if (!pending) return;
    await waitForWriteSlot(gameHash);
    const sent = await markSent(pending);
    if (!sent) continue;
    const problem = ledgerProblem(sent);
    if (problem) {
      notify(() =>
        hooks.rejected?.(sent, {
          ...rejectionDetail(sent),
          reason: problem,
          code: 'LOCAL_LEDGER_INVALID',
        }),
      );
      await noteRetry(sent.batchId);
      return;
    }
    try {
      const response = await send(sent);
      if (response.ok) {
        const committed = acknowledgement(await response.json(), sent);
        if (!committed) throw new Error('Invalid save acknowledgement.');
        await acknowledge(sent, committed);
        notify(() => hooks.confirmed?.(sent, committed));
        continue;
      }
      const body: ErrorBody = await response.json().catch(() => ({}));
      const code = body.error?.code ?? `HTTP_${response.status}`;
      const detail = {
        ...rejectionDetail(sent),
        reason: body.error?.message ?? code,
        code,
        status: response.status,
        requestId: response.headers.get('x-request-id') ?? sent.batchId,
      };
      notify(() => hooks.rejected?.(sent, detail));
      if (CONFLICTS.has(code)) {
        const remote = await downloadGame(gameHash);
        if (!remote) throw new Error('Conflicting saved game is unavailable.');
        const committed = committedSave(sent, remote);
        if (committed) {
          await acknowledge(sent, committed);
          notify(() => hooks.confirmed?.(sent, committed));
          continue;
        }
        if (!hasNewerProgress(remote, sent)) {
          notify(() =>
            hooks.rejected?.(sent, {
              ...detail,
              resolution: 'local_progress_retained',
              remoteStateVersion: remote.stateVersion,
              remoteLastEventId: remote.lastEventId,
              remoteLastEventSequence: remote.lastEventSequence,
            }),
          );
          await noteRetry(sent.batchId);
          return;
        }
        notify(() =>
          console.warn(
            `[gameplay] save replaced by newer server progress (batch ${sent.batchId}, version ${sent.baseStateVersion} → ${remote.stateVersion})`,
            {
              batchId: sent.batchId,
              code,
              localStateVersion: sent.targetState.stateVersion,
              remoteStateVersion: remote.stateVersion,
              previousEventId: sent.previousEventId,
              remoteLastEventId: remote.lastEventId,
              metricDifferences: metricDifferences(
                sent.targetState,
                remote.state,
              ),
            },
          ),
        );
        if (hooks.adoptRemote) await hooks.adoptRemote(remote, sent);
        else
          await withGameLock(gameHash, 'transition', () =>
            cacheRemoteGame(remote, true),
          );
        return;
      }
      await noteRetry(sent.batchId);
      return;
    } catch {
      await noteRetry(sent.batchId);
      return;
    }
  }
}

export function flushGame(
  gameHash: string,
  hooks: SyncHooks = {},
): Promise<void> {
  const existing = active.get(gameHash);
  if (existing) return existing;
  const running = withGameLock(gameHash, 'sync', () =>
    flush(gameHash, hooks),
  ).finally(() => active.delete(gameHash));
  active.set(gameHash, running);
  return running;
}
