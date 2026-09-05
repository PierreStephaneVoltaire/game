import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { reconcileTime, startRun } from './game-engine';

const HOUR = 3_600_000;

function run(now = 0) {
  return startRun(
    { mode: 'streaming', now, seed: 'timeline-acceptance', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('status reconciliation reaches a fixed point', () => {
  test('low energy can immediately cause creative block and depressed', () => {
    const initial = run();
    const cascading = {
      ...initial,
      metrics: {
        ...initial.metrics,
        food: 2,
        rest: 3,
        creativity: 3,
        mood: 3,
      },
    };

    const result = reconcileTime(cascading, 1, BUNDLED_GAME_DEFINITION).state;

    expect(result.metrics).toMatchObject({ creativity: 2, mood: 2 });
    expect(result.statuses).toMatchObject({
      low_energy: expect.any(Object),
      creative_block: expect.any(Object),
      depressed: expect.any(Object),
    });
    expect(
      result.events.filter((event) => event.type === 'status_onset'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'low_energy' }),
        expect.objectContaining({ status: 'creative_block' }),
        expect.objectContaining({ status: 'depressed' }),
      ]),
    );
  });

  test('clears inactivity statuses at their exact documented boundaries', () => {
    const initial = run();
    const inactive = {
      ...initial,
      statuses: {
        annoyed: { since: 0, source: 'attempts' },
        overstimulated: { since: 0, source: 'interaction' },
      },
      history: {
        ...initial.history,
        lastCareAttemptAt: 0,
        lastInteractionAt: 0,
      },
    };

    const afterTwo = reconcileTime(
      inactive,
      2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(afterTwo.statuses.overstimulated).toBeUndefined();
    expect(afterTwo.statuses.annoyed).toBeDefined();

    const afterThree = reconcileTime(
      afterTwo,
      3 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(afterThree.statuses.annoyed).toBeUndefined();
  });
});

describe('calendar and terminal timeline boundaries', () => {
  test('rotates and records the shop at every crossed local midnight', () => {
    const startedAt = Date.UTC(2026, 7, 21, 23);
    const initial = run(startedAt);
    const withCart = {
      ...initial,
      metrics: {
        food: 10,
        health: 10,
        mood: 10,
        rest: 10,
        bond: 10,
        creativity: 10,
      },
      activity: {
        id: 'calendar-rest',
        type: 'medical_care' as const,
        startedAt,
        endsAt: Date.UTC(2026, 7, 23, 2),
        sourceActionId: 'calendar-rest',
      },
      shop: {
        ...initial.shop,
        cart: { [initial.shop.itemIds[0]]: 1 },
      },
    };

    const result = reconcileTime(
      withCart,
      Date.UTC(2026, 7, 23, 0),
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.ending).toBeNull();
    expect(result.shop.localDate).toBe('2026-08-23');
    expect(result.shop.cart).toEqual({});
    expect(
      result.events
        .filter((event) => event.type === 'shop_rotated')
        .map((event) => event.at),
    ).toEqual([Date.UTC(2026, 7, 22), Date.UTC(2026, 7, 23)]);
  });

  test('does not invent critical-need loss for a lethal kidney recurrence', () => {
    const initial = run();
    const kidneyStone = {
      ...initial,
      metrics: {
        food: 10,
        health: 1,
        mood: 10,
        rest: 10,
        bond: 10,
        creativity: 10,
      },
      statuses: {
        kidney_stone: {
          since: 0,
          source: 'rolling_nutrition',
          lastPenaltyAt: 0,
        },
      },
      activity: {
        id: 'protected-rest',
        type: 'rest' as const,
        startedAt: 0,
        endsAt: 24 * HOUR,
        sourceActionId: 'protected-rest',
        payload: { startingCriticalMetrics: 'health' },
      },
    };

    const result = reconcileTime(
      kidneyStone,
      12 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.ending?.cause).toBe('Kidney stone complications');
    expect(
      result.events.filter(
        (event) =>
          event.at === result.ending?.at &&
          event.type === 'critical_health_loss',
      ),
    ).toHaveLength(0);
  });

  test('preserves kidney onset and recurrences in the terminal causal chain', () => {
    const initial = run();
    const kidneyStone = {
      ...initial,
      metrics: {
        food: 10,
        health: 1,
        mood: 10,
        rest: 10,
        bond: 10,
        creativity: 10,
      },
      statuses: {
        kidney_stone: {
          since: 0,
          source: 'rolling_nutrition',
          lastPenaltyAt: 0,
          causalEventIds: ['kidney-onset-event'],
        },
      },
      events: [
        ...initial.events,
        {
          id: 'kidney-onset-event',
          type: 'kidney_stone_onset',
          at: 0,
          message: 'Food triggered kidney stone symptoms.',
          metricDeltas: { health: -1 },
        },
      ],
      activity: {
        id: 'protected-rest',
        type: 'rest' as const,
        startedAt: 0,
        endsAt: 24 * HOUR,
        sourceActionId: 'protected-rest',
        payload: { startingCriticalMetrics: 'health' },
      },
    };

    const result = reconcileTime(
      kidneyStone,
      12 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.ending?.eventIds).toEqual([
      'kidney-onset-event',
      expect.stringMatching(/^event-/),
      expect.stringMatching(/^event-/),
    ]);
  });
});
