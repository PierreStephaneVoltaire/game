import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';

const HOUR = 60 * 60 * 1000;

function run(now = Date.UTC(2026, 0, 1, 12)) {
  return startRun(
    { mode: 'streaming', now, seed: 'subscriber-revenue', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('Subscriber Revenue', () => {
  test('credits the base payment at the first run-anchored two-hour boundary', () => {
    const initial = run();

    const result = reconcileTime(
      initial,
      initial.now + 2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.balance).toBe(initial.balance + 2);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'subscriber_revenue',
        at: initial.now + 2 * HOUR,
        amount: 2,
        revenueMultiplier: 1,
        legacyRevenueAmount: 1,
        subscriberRevenueFloor: 2,
      }),
    );
  });

  test.each([
    [29_999, 1, 2],
    [30_000, 1.5, 3],
    [50_000, 2, 3],
    [100_000, 3, 3],
    [200_000, 4, 4],
    [250_000, 5, 5],
    [500_000, 7, 7],
    [1_000_000, 10, 10],
  ])(
    'uses the highest unlocked multiplier at %i followers',
    (followers, revenueMultiplier, amount) => {
      const started = run();
      const initial = {
        ...started,
        progression: { ...started.progression, followers },
      };

      const result = reconcileTime(
        initial,
        initial.now + 2 * HOUR,
        BUNDLED_GAME_DEFINITION,
      ).state;
      const event = result.events.find(
        (candidate) => candidate.type === 'subscriber_revenue',
      );

      expect(event).toEqual(
        expect.objectContaining({ revenueMultiplier, amount }),
      );
    },
  );

  test('credits income while Hospital care is active without creating cash debt', () => {
    const started = startRun(
      {
        mode: 'realtime',
        now: Date.UTC(2026, 0, 1, 12),
        seed: 'subscriber-revenue-hospital',
        timezone: 'UTC',
      },
      BUNDLED_GAME_DEFINITION,
    );
    const sick = {
      ...started,
      statuses: { sick: { since: started.now, source: 'test' } },
      history: {
        ...started.history,
        nextAutonomousAt: started.now + 100 * HOUR,
      },
    };
    const hospitalized = dispatchCommand(
      sick,
      {
        type: 'medical_care',
        commandId: 'hospital',
        now: sick.now,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;

    const result = reconcileTime(
      hospitalized,
      hospitalized.now + 2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(hospitalized.balance).toBe(BUNDLED_GAME_DEFINITION.startingCurrency);
    expect(result.balance).toBe(hospitalized.balance + 2);
    expect(result.activity?.type).toBe('medical_care');
    expect(result.statuses.sick).toBeDefined();
  });

  test('does not pay after lethal decay at a shared boundary', () => {
    const started = run();
    const dying = {
      ...started,
      metrics: {
        ...started.metrics,
        health: 1,
        food: 0,
        mood: 0,
        rest: 0,
      },
      history: {
        ...started.history,
        nextAutonomousAt: started.now + 100 * HOUR,
      },
    };

    const result = reconcileTime(
      dying,
      dying.now + 2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.ending?.at).toBe(dying.now + 2 * HOUR);
    expect(
      result.events.some((event) => event.type === 'subscriber_revenue'),
    ).toBe(false);
  });

  test('pays only on run-anchored boundaries and is idempotent', () => {
    const started = run(Date.UTC(2026, 0, 1, 12, 37));
    const initial = {
      ...started,
      history: {
        ...started.history,
        nextAutonomousAt: started.now + 100 * HOUR,
      },
    };
    const beforeBoundary = reconcileTime(
      initial,
      initial.now + HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const onBoundary = reconcileTime(
      beforeBoundary,
      initial.now + 2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const afterBoundary = reconcileTime(
      onBoundary,
      initial.now + 3 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const replay = reconcileTime(
      afterBoundary,
      afterBoundary.now,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(
      beforeBoundary.events.filter(
        (event) => event.type === 'subscriber_revenue',
      ),
    ).toHaveLength(0);
    expect(
      afterBoundary.events.filter(
        (event) => event.type === 'subscriber_revenue',
      ),
    ).toHaveLength(1);
    expect(replay).toEqual(afterBoundary);
  });

  test('produces equivalent payments for split and one-shot reconciliation', () => {
    const started = run();
    const initial = {
      ...started,
      progression: { ...started.progression, followers: 250_000 },
      history: {
        ...started.history,
        nextAutonomousAt: started.now + 100 * HOUR,
      },
    };
    const oneShot = reconcileTime(
      initial,
      initial.now + 8 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    let split = initial;
    for (const hours of [2, 4, 6, 8])
      split = reconcileTime(
        split,
        initial.now + hours * HOUR,
        BUNDLED_GAME_DEFINITION,
      ).state;
    const payments = (state: typeof oneShot) =>
      state.events
        .filter((event) => event.type === 'subscriber_revenue')
        .map((event) => ({ at: event.at, amount: event.amount }));

    expect(payments(oneShot)).toEqual([
      { at: initial.now + 2 * HOUR, amount: 5 },
      { at: initial.now + 4 * HOUR, amount: 5 },
      { at: initial.now + 6 * HOUR, amount: 5 },
      { at: initial.now + 8 * HOUR, amount: 5 },
    ]);
    expect(payments(split)).toEqual(payments(oneShot));
    expect(split.balance).toBe(oneShot.balance);
  });
});
