import {
  purchaseAllowed,
  purchaseQuantity,
  recordLifetimePurchases,
  shopPurchaseAffordable,
} from '../billing-rules';
import financialRules from '../data/financial-rules.json';
import { finalizeFinancialOperation } from '../financial-rules';
import { LINE_OF_CREDIT_OFFER_ID } from '../game-constants';
import type { GameDefinition } from '../game-definition';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import {
  accepted,
  rejected,
  supportsQuantity,
} from '../simulation/engine-state';

type CartCommand = Extract<
  GameCommand,
  { type: 'set_cart_quantity' | 'checkout_cart' }
>;

export function handleCartCommand(
  state: GameState,
  command: CartCommand,
  definition: GameDefinition,
): { handled: true; state: GameState; outcome: Outcome } {
  return command.type === 'set_cart_quantity'
    ? setCartQuantity(state, command, definition)
    : checkoutCart(state, command, definition);
}

function setCartQuantity(
  state: GameState,
  command: Extract<CartCommand, { type: 'set_cart_quantity' }>,
  definition: GameDefinition,
) {
  if (command.itemId === LINE_OF_CREDIT_OFFER_ID) {
    const maximum = lineOfCreditMaximum(state);
    if (maximum === 0 && command.quantity > 0)
      return result(state, rejected('unavailable', 'That offer is closed.'));
    return updateCart(
      state,
      command.itemId,
      Math.max(0, Math.min(maximum, Math.floor(command.quantity))),
    );
  }
  const item = definition.items.find(({ id }) => id === command.itemId);
  if (!item || !state.shop.itemIds.includes(command.itemId))
    return result(state, rejected('unavailable', 'That item is unavailable.'));
  if (!purchaseAllowed(state, item))
    return result(state, rejected('unavailable', 'That item is unavailable.'));
  if (
    item.consumable === false &&
    !supportsQuantity(item) &&
    command.quantity > 1
  )
    return result(state, rejected('quantity_cap', 'Only one can be added.'));
  return updateCart(
    state,
    item.id,
    purchaseQuantity(state, item, command.quantity),
  );
}

function updateCart(state: GameState, id: string, quantity: number) {
  const cart = { ...state.shop.cart };
  if (quantity > 0) cart[id] = quantity;
  else delete cart[id];
  return result(
    {
      ...state,
      shop: { ...state.shop, cart },
      stateVersion: state.stateVersion + 1,
    },
    accepted('cart_updated', 'Quantity changed.'),
  );
}

function checkoutCart(
  state: GameState,
  command: Extract<CartCommand, { type: 'checkout_cart' }>,
  definition: GameDefinition,
) {
  const locQuantity = state.shop.cart[LINE_OF_CREDIT_OFFER_ID] ?? 0;
  const lines = Object.entries(state.shop.cart)
    .filter(([itemId]) => itemId !== LINE_OF_CREDIT_OFFER_ID)
    .map(([itemId, quantity]) => ({
      item: definition.items.find(({ id }) => id === itemId),
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
  if (!lines.length && locQuantity === 0)
    return result(state, rejected('empty_cart', 'Your cart is empty.'));
  const invalid = validateCatalogueLines(state, lines);
  if (invalid) return result(state, invalid);
  if (locQuantity > lineOfCreditMaximum(state))
    return result(
      state,
      rejected('unavailable', 'The cart is no longer available.'),
    );

  const terms = financialRules.lineOfCredit;
  const opening =
    state.lineOfCredit.status === 'available' && locQuantity === 1;
  const repayment = state.lineOfCredit.status === 'open' ? locQuantity : 0;
  const repaymentCost = repayment * terms.repaymentUnitPrice;
  if (repayment > 0 && repaymentCost > state.balance)
    return result(
      state,
      rejected('insufficient_funds', 'Balance is too low for that payment.'),
    );

  const itemTotal = lines.reduce(
    (sum, line) => sum + line.item.price * line.quantity,
    0,
  );
  const locCost = opening ? terms.applicationPrice : repaymentCost;
  if (!shopPurchaseAffordable(state.balance, itemTotal + locCost))
    return result(
      state,
      rejected('insufficient_funds', 'Balance is too low for that payment.'),
    );
  const inventory = { ...state.inventory };
  const stock = { ...state.shop.stock };
  for (const line of lines) {
    inventory[line.item.id] = (inventory[line.item.id] ?? 0) + line.quantity;
    stock[line.item.id] -= line.quantity;
  }

  const checkoutEvent: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'cart_checked_out',
    at: state.now,
    message: 'Purchase complete.',
    sourceActionId: command.commandId,
    purchaseActor: 'player',
    purchases: lines.length
      ? lines.map((line) => ({
          itemId: line.item.id,
          itemName: line.item.name,
          quantity: line.quantity,
        }))
      : undefined,
  };
  const events = [checkoutEvent];
  if (opening)
    events.push({
      id: `event-${state.events.length + 2}`,
      type: 'line_of_credit_opened',
      at: state.now,
      message: `The Line of Credit opened and added $${terms.cashAdvance.toLocaleString('en-US')} to Balance.`,
      sourceActionId: command.commandId,
      amount: terms.cashAdvance - terms.applicationPrice,
    });
  if (repayment)
    events.push({
      id: `event-${state.events.length + 2}`,
      type: 'line_of_credit_repaid',
      at: state.now,
      message: `Paid $${repaymentCost.toLocaleString('en-US')} toward the Line of Credit.`,
      sourceActionId: command.commandId,
      amount: -repaymentCost,
    });

  const remainingUnits =
    state.lineOfCredit.status === 'open'
      ? state.lineOfCredit.remainingUnits - repayment
      : 0;
  const mutated: GameState = {
    ...state,
    balance:
      state.balance - itemTotal - locCost + (opening ? terms.cashAdvance : 0),
    inventory,
    lineOfCredit: opening
      ? {
          status: 'open',
          openedAt: state.now,
          remainingUnits: terms.repaymentUnitCount,
          remainingClosureCost: terms.totalClosureCost,
        }
      : state.lineOfCredit.status === 'open' && repayment > 0
        ? remainingUnits === 0
          ? {
              status: 'closed',
              openedAt: state.lineOfCredit.openedAt,
              closedAt: state.now,
            }
          : {
              ...state.lineOfCredit,
              remainingUnits,
              remainingClosureCost: remainingUnits * terms.repaymentUnitPrice,
            }
        : state.lineOfCredit,
    shop: { ...state.shop, stock, cart: {} },
    history: recordLifetimePurchases(
      state,
      lines.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
    ),
    events: [...state.events, ...events],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  const next = finalizeFinancialOperation({
    before: state,
    state: mutated,
    triggerEventId: checkoutEvent.id,
    kind: opening
      ? 'loc_origination'
      : repayment
        ? 'loc_repayment'
        : 'shop_purchase',
    purchaseCategory:
      new Set(lines.map(({ item }) => item.category)).size === 1
        ? lines[0]?.item.category
        : lines.length
          ? 'mixed'
          : undefined,
  });
  return result(
    next,
    accepted(
      'cart_checked_out',
      checkoutEvent.message,
      events.map(({ id }) => id),
    ),
  );
}

function validateCatalogueLines(
  state: GameState,
  lines: Array<{
    item: GameDefinition['items'][number];
    quantity: number;
  }>,
): Outcome | null {
  if (lines.some(({ item }) => !purchaseAllowed(state, item)))
    return rejected('unavailable', 'An item is no longer available.');
  if (
    lines.some(
      ({ item }) =>
        item.consumable === false &&
        !supportsQuantity(item) &&
        ((state.inventory[item.id] ?? 0) > 0 ||
          Object.values(state.room).includes(item.id)),
    )
  )
    return rejected('duplicate', 'An item in the cart is already owned.');
  if (
    lines.some(
      ({ item, quantity }) =>
        purchaseQuantity(state, item, quantity) !== quantity ||
        (state.shop.stock[item.id] ?? 0) < quantity,
    )
  )
    return rejected('quantity_cap', 'A cart quantity is no longer available.');
  return null;
}

function lineOfCreditMaximum(state: GameState): number {
  return state.lineOfCredit.status === 'available'
    ? 1
    : state.lineOfCredit.status === 'open'
      ? state.lineOfCredit.remainingUnits
      : 0;
}

function result(state: GameState, outcome: Outcome) {
  return { handled: true as const, state, outcome };
}
