import type { GameDefinition } from '$lib/game-definition';
import type { GameState } from '$lib/game-types';
import {
  itemActionAvailable,
  type ActionOwnership,
} from '$lib/item-action-prerequisites';

export type InventoryActionChoice = {
  id: string;
  itemId: string;
  actionId?: string;
  slot?: string;
  defaultAction?: 'socialize' | 'play';
  name: string;
  image: string;
  owned: number;
  detail?: string;
};

export function careActionChoices(
  state: GameState,
  definition: GameDefinition,
  ownership: ActionOwnership,
  metric: 'mood' | 'creativity',
): InventoryActionChoice[] {
  return definition.items.flatMap((item) => {
    const owned = state.inventory[item.id] ?? 0;
    if (owned <= 0) return [];
    return (item.itemActions ?? [])
      .filter(
        (action) =>
          action.kind === 'interaction' &&
          Boolean(action.effects?.[metric]) &&
          itemActionAvailable(item.id, action, ownership),
      )
      .map((action) => ({
        id: `${item.id}:${action.id}`,
        itemId: item.id,
        actionId: action.id,
        name: item.name,
        image: item.image,
        owned,
      }));
  });
}

export function roomPlacementChoices(
  state: GameState,
  definition: GameDefinition,
  slot: string,
): InventoryActionChoice[] {
  return definition.items
    .filter(
      (item) => item.roomSlot === slot && (state.inventory[item.id] ?? 0) > 0,
    )
    .map((item) => ({
      id: item.id,
      itemId: item.id,
      slot,
      name: item.name,
      image: item.image,
      owned: state.inventory[item.id] ?? 0,
    }));
}
