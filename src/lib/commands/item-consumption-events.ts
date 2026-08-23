import type { ItemActionDefinition, ItemDefinition } from '../game-definition';
import type { GameEvent, GameState } from '../game-types';
import { actionRandom } from '../seeded-rng';
import type { NutritionResolution } from './nutrition-resolution';

export function selectItemNarration(input: {
  state: GameState;
  item: ItemDefinition;
  action: ItemActionDefinition;
  sourceActionId: string;
}): string {
  const { state, item, action, sourceActionId } = input;
  const index = Math.floor(
    actionRandom(
      state.seed,
      state.stateVersion,
      sourceActionId,
      'item_narration',
      `${item.id}:${action.id}`,
    ) * item.narration.length,
  );
  return item.narration[index];
}

export function itemConsumptionEvents(input: {
  state: GameState;
  event: GameEvent;
  item: ItemDefinition;
  nutrition: NutritionResolution;
  sourceActionId: string;
}): GameEvent[] {
  const { state, event, item, nutrition, sourceActionId } = input;
  const events: GameEvent[] = [];
  const add = (candidate: Omit<GameEvent, 'id' | 'at' | 'sourceActionId'>) =>
    events.push({
      ...candidate,
      id: `event-${state.events.length + events.length + 2}`,
      at: state.now,
      sourceActionId,
    });

  if (item.preferences?.includes('specific_preparation'))
    add({
      type: 'item_preparation',
      message: nutrition.preparationRejected
        ? `${item.name} was served in an unpreferred preparation.`
        : `${item.name} was served in an acceptable preparation.`,
      cause: event.id,
      preparation: nutrition.preparationRejected ? 'unpreferred' : 'acceptable',
      itemName: item.name,
    });
  return events;
}
