import { activateClippers } from '../audience-growth-rules';
import type { ItemActionDefinition, ItemDefinition } from '../game-definition';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import { accepted, recordAttempt } from '../simulation/engine-state';
import { selectItemNarration } from './item-consumption-events';

export function performClipperAction(
  state: GameState,
  command: Extract<GameCommand, { type: 'perform_item_action' }>,
  item: ItemDefinition,
  action: ItemActionDefinition,
): { state: GameState; outcome: Outcome } {
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'item_used',
    at: state.now,
    message: `${action.label} performed.`,
    sourceActionId: command.commandId,
    cause: action.id,
    itemName: item.name,
    itemNarration: selectItemNarration({
      state,
      item,
      action,
      sourceActionId: command.commandId,
    }),
    actionLabel: action.label,
  };
  const activated = activateClippers({
    ...state,
    inventory: {
      ...state.inventory,
      [item.id]: Math.max(
        0,
        (state.inventory[item.id] ?? 0) - (action.consumes === true ? 1 : 0),
      ),
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  });
  const outcome = accepted('item_action_performed', event.message, [
    event.id,
    ...activated.eventIds,
  ]);
  return {
    state: recordAttempt(
      activated.state,
      outcome,
      state,
      command.commandId,
      command.type,
    ),
    outcome,
  };
}
