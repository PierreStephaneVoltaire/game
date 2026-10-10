import type { GameCommand, GameState } from '../game-types';
import type { GameIntent } from './game-view-model';

export function intentToCommand(
  intent: GameIntent,
  state: GameState,
  commandId: string,
): GameCommand {
  const base = {
    commandId,
    now: state.now,
    expectedStateVersion: state.stateVersion,
  } as const;
  if (intent.type === 'use_item')
    return { ...base, type: 'use_item', itemId: intent.itemId };
  if (intent.type === 'feed_items')
    return { ...base, type: 'feed_items', items: intent.items };
  if (intent.type === 'item_action')
    return {
      ...base,
      type: 'perform_item_action',
      itemId: intent.itemId,
      action: intent.action,
    };
  if (intent.type === 'unplace_item')
    return { ...base, type: 'unplace_item', slot: intent.slot };
  if (intent.type === 'place_item')
    return {
      ...base,
      type: 'place_item',
      itemId: intent.itemId,
      slot: intent.slot,
    };
  if (intent.type === 'set_cart_quantity')
    return {
      ...base,
      type: 'set_cart_quantity',
      itemId: intent.itemId,
      quantity: intent.quantity,
    };
  if (intent.type === 'checkout_cart')
    return { ...base, type: 'checkout_cart' };
  if (intent.type === 'pay_medical_debt')
    return { ...base, type: 'pay_medical_debt' };
  return { ...base, ...intent };
}
