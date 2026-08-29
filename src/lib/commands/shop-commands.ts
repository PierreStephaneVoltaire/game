import type { GameDefinition } from '../game-definition';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import {
  accepted,
  rejected,
  supportsQuantity,
} from '../simulation/engine-state';
import {
  purchaseAllowed,
  purchaseQuantity,
  recordLifetimePurchases,
} from '../billing-rules';
import { reconcileMetricSource } from '../status-rules/metric-source-reconciliation';
import { finalizeFinancialOperation } from '../financial-rules';
import { handleCartCommand } from './shop-cart-commands';

export type ShopCommandResult = {
  handled: boolean;
  state: GameState;
  outcome: Outcome;
};

type ShopCommand = Extract<
  GameCommand,
  { type: 'set_cart_quantity' | 'checkout_cart' | 'buy_item' }
>;

export function handleShopCommand(
  state: GameState,
  command: ShopCommand,
  definition: GameDefinition,
): ShopCommandResult {
  if (command.type === 'set_cart_quantity')
    return handleCartCommand(state, command, definition);
  if (command.type === 'checkout_cart')
    return handleCartCommand(state, command, definition);
  return buyItem(state, command, definition);
}

function buyItem(
  state: GameState,
  command: Extract<ShopCommand, { type: 'buy_item' }>,
  definition: GameDefinition,
): ShopCommandResult {
  const item = definition.items.find(
    (candidate) => candidate.id === command.itemId,
  );
  const requestedQuantity = Math.max(1, Math.floor(command.quantity ?? 1));
  const available = state.shop.stock[command.itemId] ?? 0;
  if (
    !item ||
    !state.shop.itemIds.includes(command.itemId) ||
    available < requestedQuantity
  )
    return result(state, rejected('unavailable', 'That item is out of stock.'));
  if (!purchaseAllowed(state, item))
    return result(
      state,
      rejected('unavailable', 'That progression purchase is not available.'),
    );
  if (
    item.consumable === false &&
    !supportsQuantity(item) &&
    requestedQuantity > 1
  )
    return result(
      state,
      rejected('quantity_cap', 'That durable item can only be purchased once.'),
    );
  if (
    item.consumable === false &&
    !supportsQuantity(item) &&
    ((state.inventory[item.id] ?? 0) > 0 ||
      Object.values(state.room).includes(item.id))
  )
    return result(
      state,
      rejected('duplicate', 'You already own that durable item.'),
    );
  const quantity = purchaseQuantity(state, item, requestedQuantity);
  if (quantity < requestedQuantity)
    return result(
      state,
      rejected('quantity_cap', 'That quantity exceeds the item ownership cap.'),
    );
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'item_purchased',
    at: state.now,
    message: `Bought ${quantity} ${item.name}.`,
    sourceActionId: command.commandId,
    purchases: [{ itemId: item.id, itemName: item.name, quantity }],
    purchaseActor: 'player',
  };
  const next: GameState = {
    ...state,
    balance: state.balance - item.price * quantity,
    inventory: {
      ...state.inventory,
      [item.id]: (state.inventory[item.id] ?? 0) + quantity,
    },
    shop: {
      ...state.shop,
      stock: { ...state.shop.stock, [item.id]: available - quantity },
    },
    history: recordLifetimePurchases(state, [{ itemId: item.id, quantity }]),
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  const reconciled = reconcileMetricSource(state, next, command.commandId);
  return result(
    finalizeFinancialOperation({
      before: state,
      state: reconciled,
      triggerEventId: event.id,
      kind: 'shop_purchase',
      purchaseCategory: item.category,
    }),
    accepted('item_purchased', event.message, [event.id]),
  );
}

function result(state: GameState, outcome: Outcome): ShopCommandResult {
  return { handled: true, state, outcome };
}
