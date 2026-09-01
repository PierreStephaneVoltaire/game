import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';
import { rotateShop } from './shop-rules';

describe('shop command seam', () => {
  test('includes Water in every seeded daily rotation', () => {
    for (let day = 0; day < 100; day += 1) {
      const state = startRun(
        {
          mode: 'streaming',
          now: day * 24 * 3_600_000,
          seed: `water-${day}`,
          timezone: 'UTC',
        },
        BUNDLED_GAME_DEFINITION,
      );
      expect(state.shop.itemIds).toContain('water');
    }
  });

  test('includes Clippers in every initial rotation', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const state = startRun(
        {
          mode: 'streaming',
          now: Date.UTC(2026, 0, 1, 12),
          seed: `clippers-${seed}`,
          timezone: 'UTC',
        },
        BUNDLED_GAME_DEFINITION,
      );
      expect(state.shop.itemIds).toContain('clippers');
    }
  });

  test('purchases, activates, and consumes an initially offered Clipper', () => {
    const started = startRun(
      {
        mode: 'streaming',
        now: Date.UTC(2026, 0, 1, 12),
        seed: 'clippers-purchase-flow',
        timezone: 'UTC',
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(started.shop.itemIds).toContain('clippers');
    const clippers = BUNDLED_GAME_DEFINITION.items.find(
      ({ id }) => id === 'clippers',
    )!;

    const purchased = dispatchCommand(
      { ...started, balance: clippers.price },
      {
        type: 'buy_item',
        commandId: 'buy-clippers',
        itemId: 'clippers',
        quantity: 1,
        now: started.now,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(purchased.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'item_purchased',
    });
    expect(purchased.state.inventory.clippers).toBe(1);
    expect(purchased.state.balance).toBe(0);

    const activated = dispatchCommand(
      purchased.state,
      {
        type: 'perform_item_action',
        commandId: 'activate-purchased-clippers',
        itemId: 'clippers',
        action: 'activate_clippers',
        now: purchased.state.now,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(activated.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'item_action_performed',
    });
    expect(activated.state.inventory.clippers).toBe(0);
    expect(activated.state.timedEffects.clippers).toMatchObject({ stacks: 1 });
  });

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
    expect(checkedOut.state.inventory[itemId]).toBe(
      (started.inventory[itemId] ?? 0) + 1,
    );
  });

  test('daily rotation cannot add, remove, or replace inventory', () => {
    const started = startRun(
      {
        mode: 'streaming',
        now: 0,
        seed: 'rotation-inventory',
        timezone: 'UTC',
      },
      BUNDLED_GAME_DEFINITION,
    );
    const inventoryBefore = { ...started.inventory };
    const rotated = rotateShop(started, BUNDLED_GAME_DEFINITION, '1970-01-02');
    expect(rotated.itemIds).not.toEqual(started.shop.itemIds);
    expect(started.inventory).toEqual(inventoryBefore);
  });
});
