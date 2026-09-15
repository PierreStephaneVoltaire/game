import { describe, expect, test } from 'vitest';

import { resolveItemConsumption } from './commands/item-consumption';
import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { dispatchCommand, startRun } from './game-engine';
import type { GameState } from './game-types';

const ITEM_ID = 'three_month_old_rotisserie_chicken';

function stocked(health = 20): GameState {
  const initial = startRun(
    { mode: 'streaming', now: 0, seed: 'old-chicken', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
  return {
    ...initial,
    metrics: { ...initial.metrics, food: 1, health, creativity: 2 },
    statuses: {},
    inventory: { [ITEM_ID]: 1 },
  };
}

describe('Forgotten Rotisserie Chicken', () => {
  test('publishes a non-edible cleanup action', () => {
    const item = BUNDLED_GAME_DEFINITION.items.find(({ id }) => id === ITEM_ID);
    expect(item).toMatchObject({
      name: 'Forgotten Rotisserie Chicken',
      category: 'reusable',
      edible: false,
      effects: {},
      itemActions: [
        expect.objectContaining({ kind: 'interaction', consumes: true }),
      ],
      statusHooks: [],
      image: expect.stringMatching(
        new RegExp(`^/items/generated/${ITEM_ID}\\.png\\?v=[a-f0-9]{12}$`),
      ),
    });
  });

  test('throwing it away removes it without feeding or damaging health', () => {
    const result = dispatchCommand(
      stocked(),
      {
        type: 'perform_item_action',
        commandId: 'discard-old-chicken',
        itemId: ITEM_ID,
        action: 'consume',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const event = result.events.find(
      (candidate) => candidate.sourceActionId === 'discard-old-chicken',
    );

    expect(result.metrics).toMatchObject({
      food: 1,
      health: 20,
    });
    expect(result.inventory[ITEM_ID]).toBe(0);
    expect(result.metrics.creativity).toBeGreaterThanOrEqual(2);
    expect(result.metrics.creativity).toBeLessThanOrEqual(3);
    expect(event?.itemNarration).toContain(
      'threw out the forgotten rotisserie chicken',
    );
    expect(result.statuses.sick).toBeUndefined();
  });

  test('automatic stream-snack consumption rejects the cleanup item', () => {
    const state = stocked();
    const result = resolveItemConsumption(
      state,
      {
        type: 'use_item',
        commandId: 'stream:snack:0',
        itemId: ITEM_ID,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
      { automatic: true },
    );
    expect(result.outcome).toMatchObject({
      accepted: false,
      kind: 'unavailable',
    });
    expect(result.state).toBe(state);
  });

  test('lifetime purchase cap remains after the consumed item leaves inventory', () => {
    const state = {
      ...stocked(),
      balance: 100,
      inventory: {},
      shop: {
        ...stocked().shop,
        itemIds: [ITEM_ID],
        stock: { [ITEM_ID]: 1 },
      },
    };
    const purchased = dispatchCommand(
      state,
      {
        type: 'buy_item',
        commandId: 'buy-old-chicken',
        itemId: ITEM_ID,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const consumed = dispatchCommand(
      purchased,
      {
        type: 'perform_item_action',
        commandId: 'discard-bought-chicken',
        itemId: ITEM_ID,
        action: 'consume',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const refreshed = {
      ...consumed,
      shop: { ...consumed.shop, itemIds: [ITEM_ID], stock: { [ITEM_ID]: 1 } },
    };
    const blocked = dispatchCommand(
      refreshed,
      {
        type: 'buy_item',
        commandId: 'buy-second-chicken',
        itemId: ITEM_ID,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(consumed.history.lifetimePurchases[ITEM_ID]).toBe(1);
    expect(blocked.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'unavailable',
    });
  });

  test('cleanup remains harmless at low health', () => {
    const result = dispatchCommand(
      stocked(8),
      {
        type: 'perform_item_action',
        commandId: 'cleanup-low-health',
        itemId: ITEM_ID,
        action: 'consume',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.metrics.health).toBe(8);
    expect(result.ending).toBeNull();
  });
});
