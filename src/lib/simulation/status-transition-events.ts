import type { GameEvent, GameState } from '../game-types';
import { statusTransitionMessage } from '../event-messages';
import { STATUS_NAMES } from '../status-rules';
import { stateTextContext } from '../seeded-text';

export function appendStatusTransitionEvents(
  state: GameState,
  before: GameState['statuses'],
  sourceActionId: string,
): GameState {
  const changes: GameEvent[] = [];
  for (const status of STATUS_NAMES) {
    const wasActive = Boolean(before[status]);
    const isActive = Boolean(state.statuses[status]);
    if (wasActive === isActive) continue;
    if (
      status === 'in_debt' &&
      state.events.some(
        (event) =>
          event.status === status &&
          event.sourceActionId === sourceActionId &&
          ['debt_status_entered', 'debt_status_recovered'].includes(event.type),
      )
    )
      continue;
    changes.push({
      id: `event-${state.events.length + changes.length + 1}`,
      type: isActive ? 'status_added' : 'status_cleared',
      at: state.now,
      message: statusTransitionMessage(
        status,
        isActive,
        stateTextContext(state, sourceActionId),
      ),
      sourceActionId,
      status,
      cause: isActive ? state.statuses[status]?.source : 'explicit_action',
    });
  }
  return changes.length
    ? { ...state, events: [...state.events, ...changes] }
    : state;
}
