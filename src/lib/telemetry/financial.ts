import type { GameState } from '../game-types';
import type { ItemDefinition } from '../game-definition';
import { trace } from './collector';

export function tracePurchases(
  state: GameState,
  lines: Array<{ item: ItemDefinition; quantity: number }>,
  total: number,
  sourceActionId: string,
): void {
  trace('purchase', 'catalogue.price', {
    sourceActionId,
    lines: lines.map(({ item, quantity }) => ({
      itemId: item.id,
      quantity,
      unitPrice: item.price,
      spending: item.price * quantity,
    })),
    total,
    paymentSource: state.balance < 0 ? 'negative_cash_credit' : 'cash',
    cashBefore: state.balance,
  });
}
