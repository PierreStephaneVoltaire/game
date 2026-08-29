import { purchaseAllowed, purchaseQuantity } from '$lib/billing-rules';
import type { GameDefinition, ItemDefinition } from '$lib/game-definition';
import type { GameState } from '$lib/game-types';
import {
  actionOwnership,
  itemActionAvailable,
  type ActionOwnership,
} from '$lib/item-action-prerequisites';

export type ItemActionViewModel = {
  id: string;
  label: string;
  available: boolean;
};

export type ItemViewModel = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  price: number;
  image: string;
  description: string;
  edible: boolean;
  itemActions: ItemActionViewModel[];
  roomSlot: string | null;
  owned: number;
  stock: number;
  inCart: number;
  qualitativeHint: string;
  placedSlot: string | null;
  supportsQuantity: boolean;
  maximumCartQuantity: number;
  purchaseAllowed: boolean;
  purchaseBlockReason: string | null;
  resultingBalance: number;
};

export function createActionOwnership(
  state: GameState,
  definition: GameDefinition,
): ActionOwnership {
  return actionOwnership(state.inventory, state.room, definition.items);
}

function purchasePresentation(
  state: GameState,
  item: ItemDefinition,
  owned: number,
  placed: boolean,
) {
  const lifetimeBlocked =
    item.maximumLifetimePurchases !== undefined &&
    (state.history.lifetimePurchases[item.id] ?? 0) >=
      item.maximumLifetimePurchases;
  const progressionBlocked = !lifetimeBlocked && !purchaseAllowed(state, item);
  const ownershipBlocked =
    item.consumable === false &&
    !item.supportsQuantity &&
    owned + (placed ? 1 : 0) > 0;
  const availableQuantity = purchaseQuantity(
    state,
    item,
    Number.MAX_SAFE_INTEGER,
  );
  return {
    maximumCartQuantity:
      item.consumable === false && !item.supportsQuantity
        ? Math.min(1, availableQuantity)
        : availableQuantity,
    purchaseAllowed: !progressionBlocked && !ownershipBlocked,
    purchaseBlockReason: lifetimeBlocked
      ? 'Lifetime purchase limit reached.'
      : progressionBlocked
        ? 'No unlocked model commission is currently available.'
        : ownershipBlocked
          ? 'Already owned.'
          : null,
  };
}

export function itemFor(
  state: GameState,
  definition: GameDefinition,
  id: string | undefined,
  ownership: ActionOwnership,
): ItemViewModel | null {
  if (!id) return null;
  const item = definition.items.find((candidate) => candidate.id === id);
  if (!item) return null;
  const owned = state.inventory[id] ?? 0;
  const placedSlot =
    Object.entries(state.room).find(([, placedId]) => placedId === id)?.[0] ??
    null;
  const itemActions = (item.itemActions ?? []).map((action) => ({
    id: action.id,
    label: action.label,
    available: itemActionAvailable(item.id, action, ownership),
  }));
  const presentationOwned = owned + (placedSlot ? 1 : 0);
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    tags: item.tags,
    price: item.price,
    image: item.image,
    description: item.description,
    edible: item.edible,
    itemActions,
    roomSlot: item.roomSlot ?? null,
    owned: presentationOwned,
    stock: state.shop.stock[id] ?? 0,
    inCart: state.shop.cart[id] ?? 0,
    qualitativeHint: item.qualitativeNutritionHint,
    placedSlot,
    supportsQuantity: Boolean(item.supportsQuantity),
    resultingBalance: state.balance - item.price,
    ...purchasePresentation(state, item, owned, Boolean(placedSlot)),
  };
}
