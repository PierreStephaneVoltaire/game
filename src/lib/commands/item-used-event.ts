import type { ItemActionDefinition, ItemDefinition } from '../game-definition';
import type { GameEvent, GameState, Metrics } from '../game-types';
import { healthDamageSource } from '../simulation/health-resolution';
import { selectItemNarration } from './item-consumption-events';

export function createItemUsedEvent(input: {
  state: GameState;
  item: ItemDefinition;
  action: ItemActionDefinition;
  sourceActionId: string;
  itemMetricDeltas: Partial<Metrics>;
  nutritionProfileId?: string;
  automatic: boolean;
}): GameEvent {
  const { state, item, action, sourceActionId, itemMetricDeltas, automatic } =
    input;
  return {
    id: `event-${state.events.length + 1}`,
    type: 'item_used',
    at: state.now,
    message: `${item.name} was used.`,
    sourceActionId,
    metricDeltas: itemMetricDeltas,
    nutritionProfileId: input.nutritionProfileId,
    tags: action.tags,
    cause: action.id,
    itemId: item.id,
    itemUseMode: automatic ? 'automatic_stream_snack' : 'manual',
    itemName: item.name,
    itemNarration: selectItemNarration({
      state,
      item,
      action,
      sourceActionId,
      automatic,
    }),
    actionLabel: action.label,
    healthDamageSources:
      (itemMetricDeltas.health ?? 0) < 0
        ? [
            healthDamageSource(
              'item',
              item.id,
              item.name,
              itemMetricDeltas.health ?? 0,
            ),
          ]
        : undefined,
  };
}
