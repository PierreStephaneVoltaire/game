import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';
import type { GameState } from './game-types';

function debtRun(): GameState {
  const initial = startRun(
    { mode: 'streaming', now: 0, seed: 'debt-shopping', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
  const food = BUNDLED_GAME_DEFINITION.items.find(
    (item) => item.id === 'water',
  )!;
  const medicine = BUNDLED_GAME_DEFINITION.items.find(
    (item) => item.id === 'painkillers',
  )!;
  const care = BUNDLED_GAME_DEFINITION.items.find(
    (item) => item.category === 'care',
  )!;
  return {
    ...initial,
    balance: -1,
    metrics: { ...initial.metrics, mood: 6 },
    shop: {
      ...initial.shop,
      itemIds: [food.id, medicine.id, care.id],
      stock: { [food.id]: 3, [medicine.id]: 2, [care.id]: 1 },
    },
  };
}

describe('medical-debt shopping through the engine seam', () => {
  test('tagged essentials bypass affordability with one Mood cost per command', () => {
    const initial = debtRun();
    const food = BUNDLED_GAME_DEFINITION.items.find(
      (item) => item.id === 'water',
    )!;
    const medicine = BUNDLED_GAME_DEFINITION.items.find(
      (item) => item.id === 'painkillers',
    )!;

    const foodPurchase = dispatchCommand(
      initial,
      {
        type: 'buy_item',
        commandId: 'debt-food',
        itemId: food.id,
        quantity: 2,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(foodPurchase.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'item_purchased',
    });
    expect(foodPurchase.state.balance).toBe(-1 - food.price * 2);
    expect(foodPurchase.state.metrics.mood).toBe(5);

    const cartPurchase = dispatchCommand(
      {
        ...initial,
        shop: {
          ...initial.shop,
          cart: { [food.id]: 1, [medicine.id]: 1 },
        },
      },
      { type: 'checkout_cart', commandId: 'debt-cart', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(cartPurchase.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'cart_checked_out',
    });
    expect(cartPurchase.state.balance).toBe(-1 - food.price - medicine.price);
    expect(cartPurchase.state.metrics.mood).toBe(5);
  });

  test('every ordinary category remains available on credit', () => {
    const initial = debtRun();
    for (const category of ['care', 'reusable', 'upgrade', 'decoration']) {
      const blocked = BUNDLED_GAME_DEFINITION.items.find(
        (item) => item.category === category,
      )!;
      const stocked: GameState = {
        ...initial,
        shop: {
          ...initial.shop,
          itemIds: [blocked.id],
          stock: { [blocked.id]: 1 },
        },
      };
      const result = dispatchCommand(
        stocked,
        {
          type: 'buy_item',
          commandId: `debt-${category}`,
          itemId: blocked.id,
          now: 0,
        },
        BUNDLED_GAME_DEFINITION,
      );
      expect(result.outcomes[0], category).toMatchObject({
        accepted: true,
        kind: 'item_purchased',
      });
      expect(result.state.balance, category).toBe(
        initial.balance - blocked.price,
      );
      expect(result.state.metrics.mood, category).toBe(
        initial.metrics.mood - 1,
      );
      expect(result.state.inventory[blocked.id] ?? 0, category).toBe(1);
    }
  });
});
