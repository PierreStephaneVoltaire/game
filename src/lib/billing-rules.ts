import type { GameDefinition, ItemDefinition } from './game-definition';
import type { GameState } from './game-types';
import rules from './data/simulation-rules.json';

export function hospitalInsuranceItemId(
  state: GameState,
  definition: GameDefinition,
): string | undefined {
  return definition.items.find(
    (item) =>
      (state.inventory[item.id] ?? 0) > 0 && item.tags.includes('insurance'),
  )?.id;
}

export function hasHospitalInsurance(
  state: GameState,
  definition: GameDefinition,
): boolean {
  return hospitalInsuranceItemId(state, definition) !== undefined;
}

export function hospitalCost(
  state: GameState,
  definition: GameDefinition,
): number {
  return hasHospitalInsurance(state, definition)
    ? rules.medicalCare.insuredCost
    : rules.medicalCare.cost;
}

export function purchaseQuantity(
  state: GameState,
  item: ItemDefinition,
  requested: number,
): number {
  const stock = state.shop.stock[item.id] ?? 0;
  const owned = state.inventory[item.id] ?? 0;
  const maximum = item.maximumOwned ?? Infinity;
  const lifetimeRemaining =
    (item.maximumLifetimePurchases ?? Infinity) -
    (state.history.lifetimePurchases[item.id] ?? 0);
  const roomOwned = Object.values(state.room).filter(
    (id) => id === item.id,
  ).length;
  return Math.max(
    0,
    Math.min(
      stock,
      maximum - owned - roomOwned,
      lifetimeRemaining,
      Math.floor(requested),
    ),
  );
}

/** Dynamic eligibility that must hold when an item is shown or purchased. */
export function purchaseAllowed(
  state: GameState,
  item: ItemDefinition,
): boolean {
  if (
    (state.history.lifetimePurchases[item.id] ?? 0) >=
    (item.maximumLifetimePurchases ?? Infinity)
  )
    return false;
  const modelService = item.itemActions?.some(
    (action) => action.service?.type === 'model_commission',
  );
  if (!modelService) return true;
  const unfinished = state.progression.unlockedModelTiers.some(
    (tier) => !state.progression.completedModelTiers.includes(tier),
  );
  return (
    unfinished &&
    !state.projects.some((project) => project.type === 'model_commission') &&
    (state.inventory[item.id] ?? 0) === 0
  );
}

export function recordLifetimePurchases(
  state: GameState,
  purchases: Array<{ itemId: string; quantity: number }>,
): GameState['history'] {
  const lifetimePurchases = { ...state.history.lifetimePurchases };
  for (const purchase of purchases)
    lifetimePurchases[purchase.itemId] =
      (lifetimePurchases[purchase.itemId] ?? 0) + purchase.quantity;
  return { ...state.history, lifetimePurchases };
}
