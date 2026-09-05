import { describe, expect, test } from 'vitest';
import rules from '../data/simulation-rules.json';
import { alignGameStatuses } from '../status-rules';
import { resolveNutritionStatuses } from '../status-rules/context-statuses';
import { recoveryForMetrics } from './health-resolution';
import type { Metrics } from '../game-types';
import { BUNDLED_GAME_DEFINITION } from '../test-game-definition';
import { dispatchCommand, reconcileTime, startRun } from '../game-engine';
import { HOUR_MS } from '../game-constants';
import { resolveDecay } from './decay-resolution';

const metrics = (overrides: Partial<Metrics> = {}): Metrics => ({
  food: 5,
  health: 8,
  mood: 5,
  rest: 5,
  bond: 5,
  creativity: 5,
  ...overrides,
});

describe('chronology and status contracts', () => {
  test('repeats Lonely penalties every twelve game-hours while the status holds', () => {
    const started = startRun(
      { mode: 'realtime', now: 0, seed: 'lonely-cadence', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const lonely = {
      ...started,
      metrics: { ...started.metrics, food: 10, health: 20, bond: 2, mood: 10 },
      statuses: { lonely: { since: 0, source: 'bond' } },
      history: {
        ...started.history,
        nextAutonomousAt: 25 * HOUR_MS,
      },
      activity: {
        id: 'rest-for-cadence',
        type: 'rest' as const,
        startedAt: 0,
        endsAt: 48 * HOUR_MS,
        sourceActionId: 'cadence-rest',
      },
    };

    const result = reconcileTime(
      lonely,
      24 * HOUR_MS,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.metrics.mood).toBe(8);
    expect(
      result.events.filter((event) => event.type === 'status_recurrence'),
    ).toHaveLength(2);
  });

  test('metric statuses use hysteresis rather than flickering at the boundary', () => {
    const starving = alignGameStatuses(metrics({ food: 2 }), {}, 0);
    expect(starving.starving).toBeDefined();
    expect(
      alignGameStatuses(metrics({ food: 4 }), starving, 1).hungry,
    ).toBeDefined();
    expect(
      alignGameStatuses(metrics({ food: 5 }), starving, 2).starving,
    ).toBeUndefined();
  });

  test('a kidney stone receives a seeded natural passing deadline', () => {
    const result = resolveNutritionStatuses({
      metrics: metrics(),
      statuses: {},
      now: 0,
      wasSick: false,
      wasFull: false,
      fullFeedRoll: 1,
      priorSalt: rules.kidneyStone.saltThreshold,
      priorWater: rules.kidneyStone.waterThreshold,
      kidneyStoneRoll: 0,
    });
    expect(result.kidneyStone).toBe(true);
    expect(result.statuses.kidney_stone?.naturalPassAt).toBe(
      rules.kidneyStone.naturalPassHours * 60 * 60 * 1000,
    );
  });

  test('Dizzy waits 24 hours and rolls only at an unprotected Health check', () => {
    const initial = startRun(
      { mode: 'realtime', now: 0, seed: 'dizzy-exempt', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const exempt = reconcileTime(
      initial,
      2 * HOUR_MS,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(exempt.statuses.dizzy_spell).toBeUndefined();

    const atOneDay = (seed: string) => {
      const state = startRun(
        { mode: 'realtime', now: 0, seed, timezone: 'UTC' },
        BUNDLED_GAME_DEFINITION,
      );
      return {
        ...state,
        now: 24 * HOUR_MS,
        lastResolvedAt: 24 * HOUR_MS,
        metrics: metrics({ food: 10, health: 8, mood: 10, rest: 10 }),
        history: {
          ...state.history,
          lastStatusReconcileAt: 24 * HOUR_MS,
          lastBondGainAt: 24 * HOUR_MS,
          nextAutonomousAt: 28 * HOUR_MS,
        },
      };
    };
    const protectedState = atOneDay('dizzy-protected');
    const protectedResult = reconcileTime(
      {
        ...protectedState,
        activity: {
          id: 'protected-rest',
          type: 'rest',
          startedAt: 24 * HOUR_MS,
          endsAt: 28 * HOUR_MS,
          sourceActionId: 'protected-rest',
        },
      },
      26 * HOUR_MS,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(protectedResult.statuses.dizzy_spell).toBeUndefined();

    let onset: ReturnType<typeof reconcileTime>['state'] | undefined;
    for (let index = 0; index < 500 && !onset; index += 1) {
      const result = reconcileTime(
        atOneDay(`dizzy-health-${index}`),
        26 * HOUR_MS,
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (result.statuses.dizzy_spell) onset = result;
    }
    expect(onset?.statuses.dizzy_spell).toBeDefined();
    expect(onset?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'status_onset',
          status: 'dizzy_spell',
          at: 26 * HOUR_MS,
          metricDeltas: { rest: -1, mood: -1 },
        }),
      ]),
    );
  });

  test('a managed salt-and-water consumption clears Dizzy', () => {
    const now = 25 * HOUR_MS;
    const initial = startRun(
      { mode: 'realtime', now, seed: 'dizzy-clear', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const result = dispatchCommand(
      {
        ...initial,
        statuses: {
          dizzy_spell: { since: now - HOUR_MS, source: 'health_check' },
        },
        inventory: { ...initial.inventory, 'electrolyte-sachet': 1 },
        history: {
          ...initial.history,
          runStartedAt: 0,
          consumptions: [
            {
              at: now - HOUR_MS,
              itemId: 'salt-tablet',
              salt: 3,
              water: 2,
              protein: 0,
              sugar: 0,
              sugarTagged: false,
            },
          ],
        },
      },
      {
        type: 'perform_item_action',
        commandId: 'dizzy-managed-band',
        itemId: 'electrolyte-sachet',
        action: 'take_electrolyte',
        now,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(result.statuses.dizzy_spell).toBeUndefined();
  });

  test('recovery remains bucketed and capped at two Health', () => {
    expect(recoveryForMetrics(metrics())).toBe(0);
    expect(recoveryForMetrics(metrics({ food: 10, rest: 10, mood: 10 }))).toBe(
      2,
    );
  });

  test('a deferred Rest loss lands before the ordinary loss at its deadline', () => {
    const state = startRun(
      { mode: 'realtime', now: 0, seed: 'caffeine-order', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const result = resolveDecay(
      {
        ...state,
        timedEffects: {
          ...state.timedEffects,
          deferredRestLossAt: 4 * HOUR_MS,
        },
      },
      4 * HOUR_MS,
    );
    expect(result.metrics.rest).toBe(state.metrics.rest - 2);
    expect(result.timedEffects.deferredRestLossAt).toBeNull();
  });

  test('a deferred Rest loss lands during an active Rest activity', () => {
    const state = startRun(
      { mode: 'realtime', now: 0, seed: 'caffeine-activity', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const result = resolveDecay(
      {
        ...state,
        activity: {
          id: 'resting',
          type: 'rest',
          startedAt: 0,
          endsAt: 8 * HOUR_MS,
          sourceActionId: 'resting',
        },
        timedEffects: {
          ...state.timedEffects,
          deferredRestLossAt: 2 * HOUR_MS,
        },
      },
      2 * HOUR_MS,
    );
    expect(result.metrics.rest).toBe(state.metrics.rest - 1);
    expect(result.timedEffects.deferredRestLossAt).toBeNull();
  });
});
