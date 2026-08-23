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
  const roomOwned = Object.values(state.room).filter(
    (id) => id === item.id,
  ).length;
  return Math.max(
    0,
    Math.min(stock, maximum - owned - roomOwned, Math.floor(requested)),
  );
}

/** Categories that remain purchasable after the balance was already negative. */
export function debtPurchaseAllowed(item: ItemDefinition): boolean {
  return item.category === 'food' || item.category === 'medicine';
}

/** Dynamic service eligibility that must hold when an item is purchased. */
export function progressionPurchaseAllowed(
  state: GameState,
  item: ItemDefinition,
): boolean {
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
