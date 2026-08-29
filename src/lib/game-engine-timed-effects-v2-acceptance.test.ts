import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameState } from './game-types';

const HOUR = 3_600_000;

function run(seed: string): GameState {
  return startRun(
    { mode: 'realtime', now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('natural status resolution through the engine seam', () => {
  test('a kidney stone passes before recurrence at the same timestamp', () => {
    const passAt = 72 * HOUR;
    let passed: GameState | undefined;
    for (let index = 0; index < 100 && !passed; index += 1) {
      const initial = startRun(
        {
          mode: 'realtime',
          now: passAt - 1,
          seed: `stone-natural-pass-${index}`,
          timezone: 'UTC',
        },
        BUNDLED_GAME_DEFINITION,
      );
      const candidate = reconcileTime(
        {
          ...initial,
          metrics: { ...initial.metrics, health: 8, mood: 5, rest: 8 },
          statuses: {
            kidney_stone: {
              since: 0,
              source: 'rolling_nutrition',
              lastPenaltyAt: 60 * HOUR,
              naturalPassAt: passAt,
            },
          },
        },
        passAt,
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (!candidate.statuses.kidney_stone) passed = candidate;
    }

    expect(passed).toBeDefined();
    expect(passed!.statuses.kidney_stone).toBeUndefined();
    expect(passed!.metrics).toMatchObject({ health: 8, mood: 6, rest: 8 });
    expect(
      passed!.events.filter(
        (event) => event.type === 'kidney_stone_recurrence',
      ),
    ).toHaveLength(0);
    expect(passed!.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'status_cleared',
          status: 'kidney_stone',
          at: passAt,
          metricDeltas: { mood: 1 },
        }),
      ]),
    );
  });

  test('Sick clears naturally after 48 hours without a metric bonus', () => {
    const passAt = 48 * HOUR;
    const initial = startRun(
      {
        mode: 'realtime',
        now: passAt - 1,
        seed: 'sick-natural-pass',
        timezone: 'UTC',
      },
      BUNDLED_GAME_DEFINITION,
    );
    const metrics = {
      ...initial.metrics,
      food: 5,
      health: 8,
      mood: 5,
      rest: 8,
    };
    const passed = reconcileTime(
      {
        ...initial,
        metrics,
        statuses: {
          sick: {
            since: 0,
            source: 'feeding',
            naturalPassAt: passAt,
          },
        },
      },
      passAt,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(passed.statuses.sick).toBeUndefined();
    expect(passed.metrics).toEqual(metrics);
    expect(passed.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'status_cleared',
          status: 'sick',
          metricDeltas: {},
        }),
      ]),
    );
  });
});

describe('scheduled item effects through commands', () => {
  test('Painkillers grant one 12-hour relief window only during Kidney Stone', () => {
    const initial = run('pain-relief');
    const active: GameState = {
      ...initial,
      metrics: { ...initial.metrics, food: 8, health: 8, mood: 8, rest: 8 },
      statuses: {
        kidney_stone: {
          since: 0,
          source: 'rolling_nutrition',
          lastPenaltyAt: 0,
          naturalPassAt: 72 * HOUR,
        },
      },
      inventory: { ...initial.inventory, painkillers: 2 },
    };
    const treated = dispatchCommand(
      active,
      {
        type: 'perform_item_action',
        commandId: 'pain-relief-first',
        itemId: 'painkillers',
        action: 'take_painkillers',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(treated.outcomes[0].accepted).toBe(true);
    expect(treated.state.inventory.painkillers).toBe(1);
    expect(treated.state.timedEffects.painReliefUntil).toBe(12 * HOUR);
    expect(treated.state.statuses.kidney_stone).toBeDefined();

    const reused = dispatchCommand(
      treated.state,
      {
        type: 'perform_item_action',
        commandId: 'pain-relief-reuse',
        itemId: 'painkillers',
        action: 'take_painkillers',
        now: treated.state.now,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(reused.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'unavailable',
    });
    expect(reused.state.inventory.painkillers).toBe(1);
    expect(reused.state.history.careAttemptStreak).toBe(
      treated.state.history.careAttemptStreak,
    );
  });

  test('caffeine creates one pending Rest deferral that does not stack', () => {
    const initial = run('caffeine-single-pending');
    const stocked: GameState = {
      ...initial,
      statuses: { dizzy_spell: { since: 0, source: 'fixture' } },
      inventory: {
        ...initial.inventory,
        'limited-edition-dr-pepper': 1,
        'dr-pepper': 1,
      },
    };
    const first = dispatchCommand(
      stocked,
      {
        type: 'use_item',
        commandId: 'caffeine-first',
        itemId: 'limited-edition-dr-pepper',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(first.timedEffects.deferredRestLossAt).toBe(4 * HOUR);

    const second = dispatchCommand(
      first,
      {
        type: 'use_item',
        commandId: 'caffeine-second',
        itemId: 'dr-pepper',
        now: first.now,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(second.timedEffects.deferredRestLossAt).toBe(4 * HOUR);
  });

  test('Hyperfocus pins Creativity, rejects reuse, and applies its expiry cost', () => {
    const initial = run('hyperfocus-window');
    const stocked: GameState = {
      ...initial,
      metrics: { ...initial.metrics, rest: 10, creativity: 4 },
      statuses: { dizzy_spell: { since: 0, source: 'fixture' } },
      inventory: { ...initial.inventory, 'limited-edition-dr-pepper': 2 },
    };
    const focused = dispatchCommand(
      stocked,
      {
        type: 'use_item',
        commandId: 'hyperfocus-first',
        itemId: 'limited-edition-dr-pepper',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(focused.state.metrics.creativity).toBe(10);
    expect(focused.state.timedEffects.hyperfocusUntil).toBe(6 * HOUR);

    const reused = dispatchCommand(
      focused.state,
      {
        type: 'use_item',
        commandId: 'hyperfocus-reuse',
        itemId: 'limited-edition-dr-pepper',
        now: focused.state.now,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(reused.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'unavailable',
    });
    expect(reused.state.inventory['limited-edition-dr-pepper']).toBe(1);
    expect(reused.state.history.careAttemptStreak).toBe(
      focused.state.history.careAttemptStreak,
    );

    const beforeExpiry: GameState = {
      ...focused.state,
      now: 6 * HOUR - 1,
      lastResolvedAt: 6 * HOUR - 1,
      metrics: { ...focused.state.metrics, rest: 10, creativity: 10 },
      history: {
        ...focused.state.history,
        lastStatusReconcileAt: 6 * HOUR - 1,
        nextAutonomousAt: 7 * HOUR,
      },
    };
    const expired = reconcileTime(
      beforeExpiry,
      6 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(expired.timedEffects.hyperfocusUntil).toBeNull();
    expect(expired.metrics).toMatchObject({ creativity: 8, rest: 8 });
  });
});
