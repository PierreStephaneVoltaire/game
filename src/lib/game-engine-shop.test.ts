import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';

describe('shop command seam', () => {
  test('keeps cart state in the engine and checks it out atomically', () => {
    const started = startRun(
      { mode: 'streaming', now: 0, seed: 'cart-seed', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const itemId = started.shop.itemIds[0];
    const inCart = dispatchCommand(
      started,
      {
        type: 'set_cart_quantity',
        commandId: 'cart-1',
        itemId,
        quantity: 1,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    const checkedOut = dispatchCommand(
      inCart.state,
      { type: 'checkout_cart', commandId: 'checkout-1', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(checkedOut.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'cart_checked_out',
    });
    expect(checkedOut.state.shop.cart).toEqual({});
    expect(checkedOut.state.inventory[itemId]).toBe(1);
  });
});
