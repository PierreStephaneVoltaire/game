import type { GameDefinition } from '../game-definition';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import {
  accepted,
  rejected,
  supportsQuantity,
} from '../simulation/engine-state';
import {
  debtPurchaseAllowed,
  progressionPurchaseAllowed,
  purchaseQuantity,
} from '../billing-rules';
import { reconcileMetricSource } from '../status-rules/metric-source-reconciliation';

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
    return setCartQuantity(state, command, definition);
  if (command.type === 'checkout_cart')
    return checkoutCart(state, command, definition);
  return buyItem(state, command, definition);
}

function setCartQuantity(
  state: GameState,
  command: Extract<ShopCommand, { type: 'set_cart_quantity' }>,
  definition: GameDefinition,
): ShopCommandResult {
  const item = definition.items.find(
    (candidate) => candidate.id === command.itemId,
  );
  if (!item || !state.shop.itemIds.includes(command.itemId))
    return result(
      state,
      rejected('unavailable', 'That item is not in today’s shop.'),
    );
  if (!progressionPurchaseAllowed(state, item))
    return result(
      state,
      rejected('unavailable', 'That progression purchase is not available.'),
    );
  if (
    item.consumable === false &&
    !supportsQuantity(item) &&
    command.quantity > 1
  )
    return result(
      state,
      rejected('quantity_cap', 'That durable item can only be purchased once.'),
    );
  const quantity = purchaseQuantity(state, item, command.quantity);
  const cart = { ...state.shop.cart };
  if (quantity) cart[item.id] = quantity;
  else delete cart[item.id];
  return result(
    {
      ...state,
      shop: { ...state.shop, cart },
      stateVersion: state.stateVersion + 1,
    },
    accepted('cart_updated', 'Cart updated.'),
  );
}

function checkoutCart(
  state: GameState,
  command: Extract<ShopCommand, { type: 'checkout_cart' }>,
  definition: GameDefinition,
): ShopCommandResult {
  const lines = Object.entries(state.shop.cart)
    .map(([itemId, quantity]) => ({
      item: definition.items.find((candidate) => candidate.id === itemId),
      quantity,
    }))
    .filter(
      (
        line,
      ): line is {
        item: GameDefinition['items'][number];
        quantity: number;
      } => Boolean(line.item && line.quantity > 0),
    );
  const total = lines.reduce(
    (sum, line) => sum + line.item.price * line.quantity,
    0,
  );
  if (!lines.length)
    return result(state, rejected('empty_cart', 'Your cart is empty.'));
  if (lines.some((line) => !progressionPurchaseAllowed(state, line.item)))
    return result(
      state,
      rejected('unavailable', 'A progression purchase is no longer available.'),
    );
  if (state.balance < 0)
    if (lines.some((line) => !debtPurchaseAllowed(line.item)))
      return result(
        state,
        rejected(
          'debt',
          'A negative cash balance permits essential purchases only.',
        ),
      );
  if (
    lines.some(
      (line) =>
        line.item.consumable === false &&
        !supportsQuantity(line.item) &&
        ((state.inventory[line.item.id] ?? 0) > 0 ||
          Object.values(state.room).includes(line.item.id)),
    )
  )
    return result(
      state,
      rejected('duplicate', 'You already own that durable item.'),
    );
  if (
    lines.some(
      (line) =>
        purchaseQuantity(state, line.item, line.quantity) !== line.quantity,
    )
  )
    return result(
      state,
      rejected(
        'quantity_cap',
        'One or more cart quantities exceed an ownership cap.',
      ),
    );
  if (
    lines.some((line) => (state.shop.stock[line.item.id] ?? 0) < line.quantity)
  )
    return result(
      state,
      rejected('unavailable', 'One or more cart items are out of stock.'),
    );
  if (state.balance >= 0 && state.balance < total)
    return result(state, rejected('insufficient_funds', 'Not enough money.'));

  const stock = { ...state.shop.stock };
  const inventory = { ...state.inventory };
  for (const line of lines) {
    stock[line.item.id] -= line.quantity;
    inventory[line.item.id] = (inventory[line.item.id] ?? 0) + line.quantity;
  }
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'cart_checked_out',
    at: state.now,
    message: `Checked out ${lines.length} item${lines.length === 1 ? '' : 's'}.`,
    sourceActionId: command.commandId,
    purchases: lines.map((line) => ({
      itemId: line.item.id,
      itemName: line.item.name,
      quantity: line.quantity,
    })),
    metricDeltas: state.balance < 0 ? { mood: -1 } : undefined,
  };
  const next: GameState = {
    ...state,
    balance: state.balance - total,
    metrics:
      state.balance < 0
        ? { ...state.metrics, mood: Math.max(0, state.metrics.mood - 1) }
        : state.metrics,
    inventory,
    shop: { ...state.shop, stock, cart: {} },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return result(
    reconcileMetricSource(state, next, command.commandId),
    accepted('cart_checked_out', event.message, [event.id]),
  );
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
  if (!progressionPurchaseAllowed(state, item))
    return result(
      state,
      rejected('unavailable', 'That progression purchase is not available.'),
    );
  if (state.balance < 0)
    if (!debtPurchaseAllowed(item))
      return result(
        state,
        rejected(
          'debt',
          'A negative cash balance permits essential purchases only.',
        ),
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
  if (state.balance >= 0 && state.balance < item.price * quantity)
    return result(state, rejected('insufficient_funds', 'Not enough money.'));

  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'item_purchased',
    at: state.now,
    message: `Bought ${quantity} ${item.name}.`,
    sourceActionId: command.commandId,
    purchases: [{ itemId: item.id, itemName: item.name, quantity }],
    metricDeltas: state.balance < 0 ? { mood: -1 } : undefined,
  };
  const next: GameState = {
    ...state,
    balance: state.balance - item.price * quantity,
    metrics:
      state.balance < 0
        ? { ...state.metrics, mood: Math.max(0, state.metrics.mood - 1) }
        : state.metrics,
    inventory: {
      ...state.inventory,
      [item.id]: (state.inventory[item.id] ?? 0) + quantity,
    },
    shop: {
      ...state.shop,
      stock: { ...state.shop.stock, [item.id]: available - quantity },
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return result(
    reconcileMetricSource(state, next, command.commandId),
    accepted('item_purchased', event.message, [event.id]),
  );
}

function result(state: GameState, outcome: Outcome): ShopCommandResult {
  return { handled: true, state, outcome };
}
