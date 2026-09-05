import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import rules from './data/simulation-rules.json';
import { completeStreamEconomy, streamRateFor } from './economy-rules';
import { hospitalCost, purchaseQuantity } from './billing-rules';
import { projectCompletionAtLocalMidnight } from './project-economy-rules';
import { startRun } from './game-engine';
import type { GameState } from './game-types';

const HOUR = 3_600_000;

function state(): GameState {
  return startRun(
    { mode: 'realtime', now: 0, seed: 'economy-test', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('economy and progression rules', () => {
  test.each([
    [0, [6, 12]],
    [999, [6, 12]],
    [1_000, [9, 16]],
    [9_999, [9, 16]],
    [10_000, [12, 20]],
  ])(
    'uses the authored stream-rate band at %i peak Subscribers',
    (peak, band) => {
      const initial = state();
      expect(
        streamRateFor({
          ...initial,
          progression: {
            ...initial.progression,
            followers: peak,
            peakFollowers: peak,
          },
        }),
      ).toEqual(band);
    },
  );

  test('loads the reduced authored donation tiers', () => {
    expect(rules.stream.donations.tiers).toEqual([
      { id: 'kind_supporter', weight: 58, minimum: 10, maximum: 40 },
      { id: 'raid_windfall', weight: 30, minimum: 60, maximum: 200 },
      { id: 'whale', weight: 10, minimum: 400, maximum: 1000 },
      {
        id: 'legendary_whale',
        weight: 2,
        minimum: 2000,
        maximum: 5000,
        requiredCreativity: 10,
      },
    ]);
  });

  test('purchase quantity respects stock and authored ownership cap', () => {
    const item = { ...BUNDLED_GAME_DEFINITION.items[0], maximumOwned: 2 };
    const current = {
      ...state(),
      inventory: { [item.id]: 1 },
      shop: { ...state().shop, stock: { [item.id]: 5 } },
    };
    expect(purchaseQuantity(current, item, 9)).toBe(1);
  });

  test('insurance metadata selects the authored hospital bill', () => {
    const insured = BUNDLED_GAME_DEFINITION.items.find(
      (item) => item.id === 'water',
    )!;
    const definition = {
      ...BUNDLED_GAME_DEFINITION,
      items: [
        { ...insured, id: 'insurance-card', tags: ['care', 'insurance'] },
      ],
    };
    const current = { ...state(), inventory: { 'insurance-card': 1 } };
    expect(hospitalCost(current, definition)).toBe(500);
  });

  test('ordinary stream completion is deterministic without direct followers', () => {
    const initial = {
      ...state(),
      metrics: { ...state().metrics, creativity: 8 },
    };
    const first = completeStreamEconomy(initial, 'stream', 4, 4 * HOUR, 10);
    const second = completeStreamEconomy(initial, 'stream', 4, 4 * HOUR, 10);
    expect(first.state).toEqual(second.state);
    expect(first.state.progression.followers).toBe(
      initial.progression.followers,
    );
    expect(
      first.events.some((event) => event.type === 'followers_gained'),
    ).toBe(false);
  });

  test('prime hours do not add direct completion followers', () => {
    const started = Date.UTC(2026, 0, 1, 12);
    const initial = startRun(
      { mode: 'realtime', now: started, seed: 'prime', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const current = {
      ...initial,
      metrics: { ...initial.metrics, creativity: 10 },
    };
    const result = completeStreamEconomy(
      current,
      'prime-stream',
      4,
      started + 4 * HOUR,
      10,
    );
    expect(
      result.state.progression.followers - current.progression.followers,
    ).toBe(0);
  });

  test('donations roll independently for each whole stream hour', () => {
    const initial = {
      ...state(),
      metrics: { ...state().metrics, creativity: 10 },
    };
    let found: ReturnType<typeof completeStreamEconomy> | undefined;
    for (let index = 0; index < 10_000 && !found; index += 1) {
      const result = completeStreamEconomy(
        { ...initial, seed: `donation-${index}` },
        `donation-${index}`,
        6,
        6 * HOUR,
        10,
        3,
      );
      if (
        result.events.filter((event) => event.type === 'donation_received')
          .length >= 2
      )
        found = result;
    }
    expect(found).toBeDefined();
  });

  test('project completion uses the third local midnight, including DST boundaries', () => {
    const started = Date.UTC(2026, 2, 8, 1);
    const completion = projectCompletionAtLocalMidnight(
      started,
      'America/Toronto',
    );
    const expected = Date.UTC(2026, 2, 10, 4);
    expect(completion).toBe(expected);
  });
});
