import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from '../game-definition';
import { dispatchCommand, reconcileTime, startRun } from '../game-engine';
import type { GameState, Metrics } from '../game-types';
import { recoveryForMetrics, resolveHealthWindow } from './health-resolution';

const HOUR = 3_600_000;

function metrics(values: Partial<Metrics> = {}): Metrics {
  return {
    food: 5,
    health: 5,
    mood: 5,
    rest: 5,
    bond: 5,
    creativity: 5,
    ...values,
  };
}

function run(
  seed = 'health-resolution',
  mode: GameState['mode'] = 'streaming',
) {
  return startRun(
    { mode, now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('periodic Health resolution', () => {
  test('uses the configured recovery buckets', () => {
    expect(recoveryForMetrics(metrics())).toBe(0);
    expect(recoveryForMetrics(metrics({ food: 6, rest: 7, mood: 6 }))).toBe(1);
    expect(recoveryForMetrics(metrics({ food: 10, rest: 10, mood: 10 }))).toBe(
      2,
    );
  });

  test('a missed Food opportunity causes neither Food damage nor starvation damage', () => {
    const missed = resolveHealthWindow({
      health: 8,
      metricsAfterDecay: metrics({ food: 0, health: 8 }),
      recoveryMetrics: metrics({ food: 0, health: 8 }),
      foodDecayHit: false,
    });
    const hit = resolveHealthWindow({
      health: 8,
      metricsAfterDecay: metrics({ food: 0, health: 8 }),
      recoveryMetrics: metrics({ food: 0, health: 8 }),
      foodDecayHit: true,
    });

    expect(missed).toMatchObject({ health: 8, damage: 0, sources: [] });
    expect(hit).toMatchObject({ health: 6, damage: 2 });
    expect(hit.sources).toEqual([
      expect.objectContaining({ id: 'starving', name: 'Starvation' }),
    ]);
  });

  test('healthy needs can offset critical damage before one final Health check', () => {
    const result = resolveHealthWindow({
      health: 8,
      metricsAfterDecay: metrics({ food: 2, rest: 10, mood: 10, health: 8 }),
      recoveryMetrics: metrics({ food: 2, rest: 10, mood: 10, health: 8 }),
      foodDecayHit: true,
    });

    expect(result).toMatchObject({ recovery: 2, damage: 1, health: 9 });
  });

  test('records every contributor to a lethal Health boundary', () => {
    const initial = run('multi-cause');
    const state = {
      ...initial,
      metrics: metrics({ food: 0, rest: 0, mood: 5, health: 3 }),
      history: { ...initial.history, pendingFoodDecayHit: true },
    };
    const result = reconcileTime(
      state,
      2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.death?.causes?.map((cause) => cause.name)).toEqual([
      'Starvation',
      'Sleep deprivation',
    ]);
  });
});

describe('protected activities and Streaming fairness', () => {
  test('pauses the Health clock during care without a catch-up burst', () => {
    const initial = run('protected-health', 'realtime');
    const state: GameState = {
      ...initial,
      metrics: metrics({ food: 0, health: 4, rest: 10 }),
      history: {
        ...initial.history,
        healthRemainderHours: 1,
        pendingFoodDecayHit: true,
      },
      activity: {
        id: 'rest-1',
        type: 'rest',
        startedAt: 0,
        endsAt: 4 * HOUR,
        sourceActionId: 'rest-1',
        payload: { startingCriticalMetrics: 'food' },
      },
    };
    const during = reconcileTime(
      state,
      2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(during.metrics.health).toBe(4);
    expect(during.history.healthRemainderHours).toBe(1);
    expect(during.history.pendingFoodDecayHit).toBe(true);
  });

  test('the first noncritical Advance Time stops when the state becomes critical', () => {
    const initial = run('wait-seed');
    const vulnerable = {
      ...initial,
      metrics: metrics({ food: 3, rest: 3, mood: 3, health: 3 }),
    };
    const result = dispatchCommand(
      vulnerable,
      { type: 'wait', commandId: 'wait-1', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.state.now).toBe(2 * HOUR);
    expect(result.state.death).toBeNull();
    expect(result.state.metrics.health).toBeGreaterThan(0);
  });

  test('critical Advance Time uses only one or two hours', () => {
    const initial = run('critical-wait');
    const critical = { ...initial, metrics: metrics({ food: 2 }) };
    const result = dispatchCommand(
      critical,
      { type: 'wait', commandId: 'critical-wait-1', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.state.now / HOUR).toBeGreaterThanOrEqual(1);
    expect(result.state.now / HOUR).toBeLessThanOrEqual(2);
  });

  test('Hospital protects Health, clears both medical statuses, and restores needs', () => {
    const initial = run('hospital');
    const patient: GameState = {
      ...initial,
      metrics: metrics({ food: 4, health: 2, rest: 4, mood: 4 }),
      statuses: {
        sick: { since: 0, source: 'test' },
        kidney_stone: { since: 0, source: 'test', lastPenaltyAt: 0 },
      },
    };
    const result = dispatchCommand(
      patient,
      { type: 'medical_care', commandId: 'hospital-1', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.now).toBe(12 * HOUR);
    expect(result.balance).toBe(-9_980);
    expect(result.metrics.health).toBe(6);
    expect(result.metrics.food).toBeGreaterThanOrEqual(3);
    expect(result.metrics.rest).toBeGreaterThanOrEqual(3);
    expect(result.metrics.mood).toBe(4);
    expect(result.statuses.sick).toBeUndefined();
    expect(result.statuses.kidney_stone).toBeUndefined();
    expect(result.death).toBeNull();
  });
});
