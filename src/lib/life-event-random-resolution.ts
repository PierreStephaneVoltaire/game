import type { GameDefinition, ItemDefinition } from './game-definition';
import type { GameState } from './game-types';
import type { LifeEventDefinition } from './life-event-types';
import { actionRandom } from './seeded-rng';
import { CAREER_TIERS } from './progression-types';
import { purchaseAllowed } from './billing-rules';

export function resolveLifeEventCashRange(
  state: GameState,
  definition: LifeEventDefinition,
  sourceActionId: string,
): number | undefined {
  const range = definition.cashRange;
  if (!range) return undefined;
  const width = range.maximum - range.minimum + 1;
  return (
    range.minimum +
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        sourceActionId,
        `life_event:${definition.id}`,
        'cash_amount',
      ) * width,
    )
  );
}

export function eligiblePersonalPurchaseItems(
  state: GameState,
  definition: GameDefinition,
): ItemDefinition[] {
  const careerIndex = CAREER_TIERS.indexOf(state.progression.careerTier);
  return definition.items.filter((item) => {
    const required = item.progression?.requiredCareerTier;
    const unlocked = !required || CAREER_TIERS.indexOf(required) <= careerIndex;
    const owned =
      (state.inventory[item.id] ?? 0) +
      Object.values(state.room).filter((id) => id === item.id).length;
    return (
      unlocked &&
      item.price <= state.balance &&
      !(item.consumable === false && !item.supportsQuantity && owned > 0) &&
      owned < (item.maximumOwned ?? Infinity) &&
      (state.history.lifetimePurchases[item.id] ?? 0) <
        (item.maximumLifetimePurchases ?? Infinity) &&
      purchaseAllowed(state, item)
    );
  });
}

export function selectPersonalPurchase(
  state: GameState,
  definition: GameDefinition,
  sourceActionId: string,
): ItemDefinition | undefined {
  const eligible = eligiblePersonalPurchaseItems(state, definition);
  if (!eligible.length) return undefined;
  return eligible[
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        sourceActionId,
        'life_event:personal_purchase',
        'catalogue_item',
      ) * eligible.length,
    )
  ];
}

export function eligibleEquipmentExpenseItems(
  definition: LifeEventDefinition,
  gameDefinition: GameDefinition,
): ItemDefinition[] {
  if (definition.behavior?.type !== 'catalogue_item_expense') return [];
  const eligibleIds = new Set(definition.behavior.eligibleItemIds);
  return gameDefinition.items.filter((item) => eligibleIds.has(item.id));
}

export function selectEquipmentExpenseItem(
  state: GameState,
  definition: LifeEventDefinition,
  gameDefinition: GameDefinition,
  sourceActionId: string,
): ItemDefinition | undefined {
  const eligible = eligibleEquipmentExpenseItems(definition, gameDefinition);
  if (!eligible.length) return undefined;
  return eligible[
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        sourceActionId,
        `life_event:${definition.id}`,
        'equipment_item',
      ) * eligible.length,
    )
  ];
}
