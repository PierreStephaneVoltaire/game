import type { GameState } from '../game-types';
import { stateChanges } from '../telemetry/state-changes';
import type { OutboxRecord, SyncAcknowledgement } from './types';
import type { RemoteGame } from './remote';

export function committedSave(
  pending: OutboxRecord,
  remote: RemoteGame,
): SyncAcknowledgement | null {
  const sameState = (left: GameState, right: GameState) =>
    stateChanges(
      JSON.parse(JSON.stringify(left)),
      JSON.parse(JSON.stringify(right)),
    ).length === 0;
  if (
    remote.latestCommittedBatchId !== pending.batchId &&
    !sameState(remote.state, pending.targetState)
  )
    return null;
  if (
    remote.lastEventSequence !==
      (pending.events.at(-1)?.sequence ?? remote.lastEventSequence) ||
    remote.lastEventId !==
      (pending.events.at(-1)?.id ?? pending.previousEventId)
  )
    return null;
  return {
    gameHash: pending.gameHash,
    stateVersion: remote.stateVersion,
    committedThroughSequence: remote.lastEventSequence,
    committedThroughEventId: remote.lastEventId,
    latestCommittedBatchId: remote.latestCommittedBatchId,
  };
}
