import { describe, expect, test } from 'vitest';

import { resolveNutritionConsumption } from './commands/nutrition-resolution';
import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { reconcileTime, startRun } from './game-engine';
import type { ConsumptionRecord, GameState } from './game-types';

const HOUR = 3_600_000;
const feed = (index: number, salt = 0, water = 0): ConsumptionRecord => ({
  at: index,
  itemId: `feed-${index}`,
  salt,
  water,
  protein: 0,
  sugar: 0,
  sugarTagged: false,
});

describe('Kidney Stone feed window', () => {
  test('appends the current feed, evicts the oldest, and evaluates only ten', () => {
    const initial = startRun(
      { mode: 'realtime', now: 100, seed: 'window', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const state = {
      ...initial,
      history: {
        ...initial.history,
        kidneyStoneFeeds: [
          feed(0, 8, 0),
          ...Array.from({ length: 9 }, (_, index) => feed(index + 1)),
        ],
      },
    };
    const water = BUNDLED_GAME_DEFINITION.items.find(
      (item) => item.id === 'water',
    )!;
    const result = resolveNutritionConsumption(
      state,
      { type: 'use_item', commandId: 'hydrate', itemId: 'water', now: 100 },
      water,
      water.itemActions?.[0],
    );

    expect(result.kidneyStoneFeeds).toHaveLength(10);
    expect(result.kidneyStoneFeeds.some((record) => record.at === 0)).toBe(
      false,
    );
    expect(result.kidneyStone).toBe(false);
  });

  test('does not add non-food Medicine actions to the feed window', () => {
    const initial = startRun(
      { mode: 'realtime', now: 100, seed: 'medicine', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const painkillers = BUNDLED_GAME_DEFINITION.items.find(
      (item) => item.id === 'painkillers',
    )!;
    const result = resolveNutritionConsumption(
      initial,
      {
        type: 'use_item',
        commandId: 'medicine',
        itemId: painkillers.id,
        now: 100,
      },
      painkillers,
      painkillers.itemActions?.[0],
    );
    expect(result.kidneyStoneFeeds).toEqual([]);
  });

  test('a failed 72-hour passage roll schedules another 72-hour check', () => {
    const checkAt = 72 * HOUR;
    let failed: GameState | undefined;
    for (let index = 0; index < 100 && !failed; index += 1) {
      const initial = startRun(
        {
          mode: 'realtime',
          now: checkAt - 1,
          seed: `stone-natural-fail-${index}`,
          timezone: 'UTC',
        },
        BUNDLED_GAME_DEFINITION,
      );
      const candidate = reconcileTime(
        {
          ...initial,
          metrics: { ...initial.metrics, health: 10, rest: 10 },
          statuses: {
            kidney_stone: {
              since: 0,
              source: 'rolling_nutrition',
              lastPenaltyAt: 60 * HOUR,
              naturalPassAt: checkAt,
            },
          },
        },
        checkAt,
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (candidate.statuses.kidney_stone) failed = candidate;
    }

    expect(failed).toBeDefined();
    expect(failed!.statuses.kidney_stone?.naturalPassAt).toBe(144 * HOUR);
  });
});
