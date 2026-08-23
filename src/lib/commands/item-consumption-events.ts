import type { ItemDefinition } from '../game-definition';
import type { GameEvent, GameState } from '../game-types';
import type { NutritionResolution } from './nutrition-resolution';

export function itemDiscoveryEvents(input: {
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

  if (item.preferences?.includes('liked'))
    add({
      type: 'item_reaction',
      message: `${item.name} was enjoyed.`,
      cause: event.id,
      discovery: 'liked',
      itemName: item.name,
    });
  if (item.preferences?.includes('disliked'))
    add({
      type: 'item_reaction',
      message: `${item.name} was tolerated.`,
      cause: event.id,
      discovery: 'disliked',
      itemName: item.name,
    });
  if (item.preferences?.includes('variable'))
    add({
      type: 'item_discovery',
      message: `The companion discovered something new about ${item.name}.`,
      cause: event.id,
      discovery: 'variable',
      itemName: item.name,
    });
  if (item.preferences?.includes('specific_preparation'))
    add({
      type: 'item_preparation',
      message: nutrition.preparationRejected
        ? `${item.name} was served in an unpreferred preparation.`
        : `${item.name} was served in an acceptable preparation.`,
      cause: event.id,
      discovery: nutrition.preparationRejected
        ? 'unpreferred_preparation'
        : 'acceptable_preparation',
      itemName: item.name,
    });
  if (nutrition.nutritionProfileId)
    add({
      type: 'nutrition_profile_discovered',
      message: `The companion discovered profile ${nutrition.nutritionProfileId} for ${item.name}.`,
      cause: event.id,
      nutritionProfileId: nutrition.nutritionProfileId,
      discovery: 'variable_profile',
    });
  return events;
}
