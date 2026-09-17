import { GameController } from '../game-controller';
import {
  InMemoryGameDefinitionRepository,
  type GameDefinitionRepository,
} from '../game-definition';
import type { GameState } from '../game-types';
import type { GameplayCapture } from '../telemetry/capture';
import { nextOutbox, replacePending } from './outbox';
import type { EventRecord } from './types';

type RemoteGame = {
  stateVersion: number;
  lastEventSequence: number;
  lastEventId: string | null;
  state: GameState;
};

export async function replayPending(
  gameHash: string,
  definitions: GameDefinitionRepository,
  onApplied: (controller: GameController) => void,
  originalCapture?: GameplayCapture,
): Promise<GameplayCapture | undefined> {
  const pending = await nextOutbox(gameHash);
  if (!pending) return;
  const definition = await definitions.load();
  const controller = new GameController(
    new InMemoryGameDefinitionRepository(definition),
    originalCapture?.fork(),
  );
  originalCapture?.marker(
    'save_conflict',
    { saveBatchId: pending.batchId },
    pending.targetState,
  );
  const response = await fetch('/api/games/current', {
    credentials: 'same-origin',
    headers: {
      'x-content-version': definition.version,
      'x-game-key': gameHash,
    },
  });
  let baseStateVersion: number;
  let baseEventSequence: number;
  let previousEventId: string | null;
  let state: GameState;
  let committedEventCount: number;
  if (response.status === 404 && pending.baseStateVersion === 0) {
    state = await controller.start({
      mode: pending.targetState.mode,
      now: pending.targetState.history.runStartedAt,
      seed: gameHash,
      timezone: pending.targetState.timezone,
    });
    baseStateVersion = 0;
    baseEventSequence = 0;
    previousEventId = null;
    committedEventCount = 0;
  } else {
    if (!response.ok) throw new Error('Could not load the canonical game.');
    const remote = (await response.json()) as RemoteGame;
    state = await controller.load({
      ...remote.state,
      definitionVersion: definition.version,
    });
    baseStateVersion = remote.stateVersion;
    baseEventSequence = remote.lastEventSequence;
    previousEventId = remote.lastEventId;
    committedEventCount = state.events.length;
  }
  for (const command of pending.commands) {
    controller.capture?.marker(
      'command_replay',
      {
        saveBatchId: pending.batchId,
        command,
        originalStreamId: originalCapture?.streamId ?? null,
      },
      state,
    );
    state = (
      await controller.dispatch({
        ...command,
        expectedStateVersion: state.stateVersion,
      })
    ).state;
  }
  if (
    state.mode === 'realtime' &&
    pending.targetState.now > state.now &&
    !state.ending
  )
    state = (await controller.reconcile(pending.targetState.now)).state;
  const events: EventRecord[] = state.events
    .slice(committedEventCount)
    .map((event, index) => ({
      ...event,
      gameHash,
      sequence: baseEventSequence + index + 1,
    }));
  if (
    !(await replacePending(
      pending,
      state,
      events,
      baseStateVersion,
      baseEventSequence,
      previousEventId,
      definition.version,
    ))
  ) {
    controller.capture?.record(
      'replay_superseded',
      { saveBatchId: pending.batchId },
      state,
    );
    return replayPending(gameHash, definitions, onApplied, originalCapture);
  }
  controller.capture?.marker(
    'replay_applied',
    {
      saveBatchId: pending.batchId,
      originalStreamId: originalCapture?.streamId ?? null,
    },
    state,
  );
  onApplied(controller);
  return controller.capture;
}
