import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameMode, GameState } from './game-types';
import rules from './data/simulation-rules.json';

const HOUR = 3_600_000;
const AUTO_TYPES = new Set([
  'low_money_stress',
  'food_craving',
  'creative_inspiration',
  'socks',
  'benign_room_event',
  'stream_candidate',
  'item_automatic_hook',
]);

function preparedRun(
  now: number,
  seed: string,
  timezone = 'UTC',
  mode: GameMode = 'streaming',
  rest = 10,
) {
  const initial = startRun(
    { mode, now, seed, timezone },
    BUNDLED_GAME_DEFINITION,
  );
  return {
    ...initial,
    metrics: {
      food: 10,
      health: 10,
      mood: 8,
      rest,
      bond: 8,
      creativity: 8,
    },
    statuses: {},
    history: {
      ...initial.history,
      cravingItemId: 'water',
      eventCooldowns: {
        inspiration: Number.MAX_SAFE_INTEGER,
        socks: Number.MAX_SAFE_INTEGER,
        room: Number.MAX_SAFE_INTEGER,
      },
    },
  } as GameState;
}

function streamAttempt(now: number, seed: string, timezone = 'UTC', rest = 10) {
  const state = preparedRun(now, seed, timezone, 'streaming', rest);
  return dispatchCommand(
    state,
    { type: 'use_item', commandId: 'stream-control', itemId: 'missing', now },
    BUNDLED_GAME_DEFINITION,
  );
}

function hasStream(result: ReturnType<typeof dispatchCommand>) {
  return result.state.events.some((event) => event.type === 'stream_candidate');
}

function streamDuration(result: ReturnType<typeof dispatchCommand>) {
  const candidate = result.state.events.find(
    (event) => event.type === 'stream_candidate',
  );
  const completion = result.state.events.find(
    (event) =>
      event.type === 'activity_completed' &&
      event.at > (candidate?.at ?? Infinity),
  );
  return candidate && completion ? (completion.at - candidate.at) / HOUR : null;
}

function findContrast(first: number, second: number) {
  for (let index = 0; index < 10_000; index += 1) {
    const seed = `daypart-${index}`;
    const a = streamAttempt(first, seed);
    const b = streamAttempt(second, seed);
    if (hasStream(a) !== hasStream(b)) return { seed, a, b };
  }
  throw new Error(`No daypart contrast found for ${first}/${second}.`);
}

describe('stream daypart candidate selection', () => {
  test.each([
    [8 * HOUR + 59 * 60_000, 9 * HOUR, '08:59 to 09:00'],
    [12 * HOUR + 59 * 60_000, 13 * HOUR, '12:59 to 13:00'],
  ])(
    '%s changes the candidate under the same seed and command',
    (first, second) => {
      const contrast = findContrast(first, second);
      expect(hasStream(contrast.a)).not.toBe(hasStream(contrast.b));
    },
  );

  test('19:59 has the boosted candidate behavior and 20:00 returns to normal', () => {
    const contrast = findContrast(19 * HOUR + 59 * 60_000, 20 * HOUR);
    expect(hasStream(contrast.a)).toBe(true);
    expect(hasStream(contrast.b)).toBe(false);
  });
});

describe('stream duration and local-midnight rules', () => {
  test('base durations cover 1 through 12 hours at Rest 10', () => {
    const seen = new Set<number>();
    for (let index = 0; index < 10_000 && seen.size < 12; index += 1) {
      const result = streamAttempt(0, `duration-${index}`);
      const duration = streamDuration(result);
      if (duration !== null) seen.add(duration);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
  });

  test('effective duration subtracts missing Rest', () => {
    let seed: string | undefined;
    let base: ReturnType<typeof dispatchCommand> | undefined;
    for (let index = 0; index < 10_000 && !seed; index += 1) {
      const candidate = streamAttempt(0, `subtraction-${index}`, 'UTC', 10);
      if (streamDuration(candidate) === 6) {
        seed = `subtraction-${index}`;
        base = candidate;
      }
    }
    expect(base).toBeDefined();
    expect(streamDuration(streamAttempt(0, seed!, 'UTC', 7))).toBe(3);
  });

  test('a too-tired candidate records refusal instead of starting activity', () => {
    let result: ReturnType<typeof dispatchCommand> | undefined;
    for (let index = 0; index < 10_000 && !result; index += 1) {
      const candidate = streamAttempt(0, `tired-${index}`, 'UTC', 0);
      if (
        candidate.state.events.some(
          (event) =>
            event.type === 'stream_candidate' &&
            event.message.includes('too tired'),
        )
      )
        result = candidate;
    }
    expect(result).toBeDefined();
    expect(result!.state.activity).toBeNull();
  });

  test.each([
    ['UTC', Date.UTC(2026, 7, 22, 23), Date.UTC(2026, 7, 23, 0)],
    ['America/Toronto', Date.UTC(2026, 2, 9, 3), Date.UTC(2026, 2, 9, 4)],
    ['America/Toronto', Date.UTC(2026, 10, 2, 4), Date.UTC(2026, 10, 2, 5)],
  ])('caps a stream at local midnight across %s', (timezone, now, midnight) => {
    let result: ReturnType<typeof dispatchCommand> | undefined;
    for (let index = 0; index < 10_000 && !result; index += 1) {
      const candidate = streamAttempt(now, `midnight-${index}`, timezone);
      if (hasStream(candidate)) result = candidate;
    }
    const completion = result!.state.events.find(
      (event) => event.type === 'activity_completed' && event.at > now,
    );
    expect(completion?.at).toBe(midnight);
  });
});

describe('automatic stream snacks and income', () => {
  test('successful floor requests consume owned ordinary food without another opportunity', () => {
    const initial = preparedRun(0, 'snack-normal', 'UTC', 'realtime');
    const state = {
      ...initial,
      metrics: { ...initial.metrics, food: 2 },
      inventory: { cake: 2 },
      activity: {
        id: 'stream-1',
        type: 'stream' as const,
        startedAt: 0,
        endsAt: 10 * HOUR,
        sourceActionId: 'stream-source',
      },
    };
    const result = reconcileTime(
      state,
      6 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const snacks = result.events.filter(
      (event) =>
        event.type === 'item_used' &&
        event.sourceActionId?.startsWith('stream-source:snack:'),
    );
    expect(snacks).toHaveLength(1);
    expect(result.inventory.cake).toBe(1);
    expect(result.metrics.food).toBe(2);
    expect(result.activity).toBeNull();
    expect(result.events.some((event) => AUTO_TYPES.has(event.type))).toBe(
      false,
    );
  });

  test('no eligible owned food leaves the stream floor intact', () => {
    const initial = preparedRun(0, 'snack-empty', 'UTC', 'realtime');
    const result = reconcileTime(
      {
        ...initial,
        metrics: { ...initial.metrics, food: 2 },
        inventory: { water: 1 },
        activity: {
          id: 'stream-2',
          type: 'stream' as const,
          startedAt: 0,
          endsAt: 10 * HOUR,
          sourceActionId: 'stream-empty',
        },
      },
      2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(result.metrics.food).toBe(2);
    expect(result.events.some((event) => event.type === 'item_used')).toBe(
      false,
    );
  });

  test('stream rate, completion, and income are deterministic through the public seam', () => {
    const first = streamAttempt(0, 'income-replay');
    const second = streamAttempt(0, 'income-replay');
    expect(second.state).toEqual(first.state);
    expect(first.state.activity).toBeNull();
    expect(first.state.balance).toBeGreaterThan(
      BUNDLED_GAME_DEFINITION.startingCurrency,
    );
    const completion = first.state.events.find(
      (event) => event.type === 'activity_completed',
    )!;
    const duration = (completion.at - 0) / HOUR;
    const income =
      first.state.balance - BUNDLED_GAME_DEFINITION.startingCurrency;
    expect(
      Array.from(
        { length: rules.stream.income.rateSlots },
        (_, index) => index + rules.stream.income.minimumRate,
      ).some(
        (hourlyRate) =>
          Math.round(hourlyRate * duration * (0.5 + 8 / 10)) === income,
      ),
    ).toBe(true);
  });

  test('completion income repays medical debt using the authored formula', () => {
    const initial = preparedRun(0, 'income-debt', 'UTC', 'realtime');
    const state = {
      ...initial,
      balance: -1_000,
      activity: {
        id: 'stream-debt',
        type: 'stream' as const,
        startedAt: 0,
        endsAt: 2 * HOUR,
        sourceActionId: 'stream-debt',
        payload: { hourlyRate: 10 },
      },
    };
    const result = reconcileTime(
      state,
      2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const streamIncome = Math.round(
      10 *
        2 *
        (rules.stream.income.baseMultiplier +
          initial.metrics.creativity / rules.stream.income.creativityDivisor),
    );
    const subscriberRevenue =
      rules.progression.subscriberRevenue.minimumAmountBands[0].amount;
    expect(result.balance).toBe(-1_000 + streamIncome + subscriberRevenue);
    expect(result.activity).toBeNull();
  });
});
