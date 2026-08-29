import type { GameEvent, GameState, QueuedEventStream } from './game-types';

export function queueEventStream(
  state: GameState,
  stream: Omit<QueuedEventStream, 'id' | 'queuedAt'>,
  sourceActionId: string,
): GameState {
  const queued: QueuedEventStream = {
    ...stream,
    id: `queued-stream-${state.actionOrdinal + state.progression.queuedEventStreams.length + 1}`,
    queuedAt: state.now,
  };
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'event_stream_queued',
    at: state.now,
    message: `${stream.type === 'tournament' ? 'Tournament' : 'Model debut'} stream queued.`,
    sourceActionId,
  };
  return {
    ...state,
    progression: {
      ...state.progression,
      queuedEventStreams: [...state.progression.queuedEventStreams, queued],
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
}
