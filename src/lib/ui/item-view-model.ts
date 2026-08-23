import {
  debtPurchaseAllowed,
  progressionPurchaseAllowed,
  purchaseQuantity,
} from '$lib/billing-rules';
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
  const debtBlocked = state.balance < 0 && !debtPurchaseAllowed(item);
  const progressionBlocked = !progressionPurchaseAllowed(state, item);
  const insufficientFunds = state.balance >= 0 && state.balance < item.price;
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
    purchaseAllowed:
      !debtBlocked &&
      !progressionBlocked &&
      !insufficientFunds &&
      !ownershipBlocked,
    purchaseBlockReason: debtBlocked
      ? 'Only food and medicine can be purchased while in debt.'
      : progressionBlocked
        ? 'No unlocked model commission is currently available.'
        : insufficientFunds
          ? 'Not enough money.'
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
    ...purchasePresentation(state, item, owned, Boolean(placedSlot)),
  };
}
