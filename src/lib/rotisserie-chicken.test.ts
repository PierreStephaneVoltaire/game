import { describe, expect, test } from 'vitest';

import { resolveItemConsumption } from './commands/item-consumption';
import { BUNDLED_GAME_DEFINITION } from './game-definition';
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

describe('Three-Month-Old Rotisserie Chicken', () => {
  test('publishes its exact data-authored one-use effects', () => {
    const item = BUNDLED_GAME_DEFINITION.items.find(({ id }) => id === ITEM_ID);
    expect(item).toMatchObject({
      name: 'Three-Month-Old Rotisserie Chicken',
      category: 'food',
      preferences: ['variable'],
      effects: {
        food: { min: 5, max: 5 },
        health: { min: -8, max: -8 },
        creativity: { min: 2, max: 2 },
      },
      statusHooks: [],
      image: expect.stringMatching(
        new RegExp(`^/items/generated/${ITEM_ID}\\.png\\?v=[a-f0-9]{12}$`),
      ),
    });
  });

  test('manual consumption applies the atomic effect once and consumes it', () => {
    const result = dispatchCommand(
      stocked(),
      {
        type: 'use_item',
        commandId: 'eat-old-chicken',
        itemId: ITEM_ID,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const event = result.events.find(
      (candidate) => candidate.sourceActionId === 'eat-old-chicken',
    );

    expect(result.metrics).toMatchObject({
      food: 6,
      health: 12,
      creativity: 4,
    });
    expect(result.inventory[ITEM_ID]).toBe(0);
    expect(event?.metricDeltas).toMatchObject({
      food: 5,
      health: -8,
      creativity: 2,
    });
    expect(event).toMatchObject({
      itemId: ITEM_ID,
      itemUseMode: 'manual',
    });
    expect(event?.itemNarration).toContain(
      'three-month-old rotisserie chicken',
    );
    expect(result.statuses.sick).toBeUndefined();
  });

  test('automatic stream-snack use keeps the complete effect and authored line', () => {
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
    ).state;
    const event = result.events.find(
      (candidate) => candidate.sourceActionId === 'stream:snack:0',
    );

    expect(result.metrics).toMatchObject({
      food: 6,
      health: 12,
      creativity: 4,
    });
    expect(result.inventory[ITEM_ID]).toBe(0);
    expect(event).toMatchObject({
      itemId: ITEM_ID,
      itemUseMode: 'automatic_stream_snack',
    });
    expect(event?.itemNarration).toContain('during the stream');
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
        type: 'use_item',
        commandId: 'eat-bought-chicken',
        itemId: ITEM_ID,
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

  test('a lethal bite attributes death to the item', () => {
    const result = dispatchCommand(
      stocked(8),
      {
        type: 'use_item',
        commandId: 'fatal-old-chicken',
        itemId: ITEM_ID,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.ending).toMatchObject({
      kind: 'death',
      causes: [expect.objectContaining({ kind: 'item', id: ITEM_ID })],
    });
  });
});
