import type { GameState } from '../game-types';

export function inventoryAfterConsumedUnit(
  inventory: GameState['inventory'],
  itemId: string,
): GameState['inventory'] {
  return {
    ...inventory,
    [itemId]: Math.max(0, (inventory[itemId] ?? 0) - 1),
  };
}
