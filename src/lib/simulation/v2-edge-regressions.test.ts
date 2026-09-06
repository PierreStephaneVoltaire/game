import { describe, expect, test } from 'vitest';

import { purchaseAllowed } from '../billing-rules';
import { BUNDLED_GAME_DEFINITION } from '../test-game-definition';
import { dispatchCommand, reconcileTime, startRun } from '../game-engine';
import type { GameState } from '../game-types';
import { completeStreamEconomy } from '../economy-rules';
import { resolveAttemptEvent } from '../event-rules';
import { HOUR_MS } from '../game-constants';
import { resolveDecay } from './decay-resolution';
import { refusalProbability } from '../activity-rules';

function run(now = 0, seed = 'v2-edge'): GameState {
  return startRun(
    { mode: 'realtime', now, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('V2 edge regressions', () => {
  test('Socialize and Play pause Health while Commission Work does not', () => {
    for (const type of ['socialize', 'play'] as const) {
      const state = run(0, `protected-${type}`);
      const result = resolveDecay(
        {
          ...state,
          activity: {
            id: type,
            type,
            startedAt: 0,
            endsAt: 4 * HOUR_MS,
            sourceActionId: type,
          },
          history: { ...state.history, healthRemainderHours: 1 },
        },
        2 * HOUR_MS,
      );
      expect(result.healthIntervals).toBe(0);
      expect(result.resolvedHealthRemainderHours).toBe(1);
    }
    const state = run(0, 'unprotected-commission');
    const result = resolveDecay(
      {
        ...state,
        activity: {
          id: 'commission',
          type: 'commission_work',
          startedAt: 0,
          endsAt: 6 * HOUR_MS,
          sourceActionId: 'commission',
        },
        history: { ...state.history, healthRemainderHours: 1 },
      },
      2 * HOUR_MS,
    );
    expect(result.healthIntervals).toBe(1);
  });

  test('consecutive Socialize and Play do not escalate refusal chance', () => {
    const state = run();
    for (const type of ['socialize', 'play'] as const)
      expect(
        refusalProbability({
          ...state,
          history: {
            ...state.history,
            repeatAction: type,
            repeatCount: 20,
          },
        }),
      ).toBe(refusalProbability(state));
  });

  test('Hyperfocus suppresses Creativity penalties from status cascades', () => {
    const state = run(0, 'hyperfocus-status-pin');
    const result = resolveDecay(
      {
        ...state,
        metrics: { ...state.metrics, food: 1, rest: 4, creativity: 10 },
        activity: {
          id: 'protected-rest',
          type: 'rest',
          startedAt: 0,
          endsAt: 4 * HOUR_MS,
          sourceActionId: 'protected-rest',
        },
        timedEffects: {
          ...state.timedEffects,
          hyperfocusUntil: 6 * HOUR_MS,
        },
      },
      2 * HOUR_MS,
    );
    expect(result.statusReconciliation.statuses.low_energy).toBeDefined();
    expect(result.statusReconciliation.metrics.creativity).toBe(10);
    expect(
      result.statusReconciliation.onsetEffects.find(
        (effect) => effect.status === 'low_energy',
      )?.metricDeltas.creativity,
    ).toBeUndefined();
  });

  test('Kidney Stone recurrence immediately normalizes metric statuses', () => {
    const recurrenceAt = 12 * HOUR_MS;
    const state = run(recurrenceAt - 1, 'stone-status-cascade');
    const resolved = reconcileTime(
      {
        ...state,
        metrics: { ...state.metrics, food: 8, health: 8, mood: 8, rest: 3 },
        statuses: {
          kidney_stone: {
            since: 0,
            source: 'rolling_nutrition',
            lastPenaltyAt: 0,
            naturalPassAt: 72 * HOUR_MS,
          },
        },
        history: { ...state.history, nextAutonomousAt: recurrenceAt + HOUR_MS },
      },
      recurrenceAt,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(resolved.metrics.rest).toBe(2);
    expect(resolved.statuses.sleep_deprived).toBeDefined();
  });

  test('fractional streams roll donations at each completed whole-hour boundary', () => {
    const startedAt = Date.UTC(2026, 5, 29, 20, 30);
    const state = run(startedAt, 'fractional-donations');
    const result = completeStreamEconomy(
      { ...state, metrics: { ...state.metrics, creativity: 10 } },
      'fractional-donations',
      2.5,
      startedAt + 2.5 * HOUR_MS,
      10,
      100,
    );
    expect(
      result.events
        .filter((event) => event.type === 'donation_received')
        .map((event) => event.at),
    ).toEqual([startedAt + HOUR_MS, startedAt + 2 * HOUR_MS]);
  });

  test('a special-date hour keeps its multiplier when it ends at midnight', () => {
    const specialEnd = Date.UTC(2026, 5, 30);
    const ordinaryEnd = Date.UTC(2026, 5, 29);
    let matched = false;
    for (let index = 0; index < 1_000 && !matched; index += 1) {
      const seed = `midnight-special-${index}`;
      const special = completeStreamEconomy(
        {
          ...run(specialEnd - HOUR_MS, seed),
          metrics: { ...run().metrics, creativity: 10 },
        },
        'midnight-special',
        1,
        specialEnd,
        10,
        3,
      );
      const ordinary = completeStreamEconomy(
        {
          ...run(ordinaryEnd - HOUR_MS, seed),
          metrics: { ...run().metrics, creativity: 10 },
        },
        'midnight-special',
        1,
        ordinaryEnd,
        10,
        3,
      );
      matched =
        special.events.some((event) => event.type === 'donation_received') &&
        !ordinary.events.some((event) => event.type === 'donation_received');
    }
    expect(matched).toBe(true);
  });

  test('model services are unavailable while no unlocked unfinished tier is free', () => {
    const item = BUNDLED_GAME_DEFINITION.items.find(
      (candidate) => candidate.id === 'new-model-commission',
    )!;
    const state = run();
    const eligible = {
      ...state,
      progression: { ...state.progression, unlockedModelTiers: [1 as const] },
    };
    expect(purchaseAllowed(eligible, item)).toBe(true);
    expect(
      purchaseAllowed(
        {
          ...eligible,
          projects: [
            {
              id: 'model-one',
              type: 'model_commission',
              modelTier: 1,
              startedAt: 0,
              completesAt: 1,
              sourceActionId: 'model-one',
            },
          ],
        },
        item,
      ),
    ).toBe(false);
    expect(
      purchaseAllowed(
        {
          ...eligible,
          progression: { ...eligible.progression, completedModelTiers: [1] },
        },
        item,
      ),
    ).toBe(false);
  });

  test('only completed Commission Work consumes the local-date limit', () => {
    const now = Date.UTC(2026, 0, 1, 12);
    const state = run(now, 'commission-date-limit');
    const eligible: GameState = {
      ...state,
      inventory: { ...state.inventory, 'rigging-tablet': 1 },
      metrics: { ...state.metrics, creativity: 6 },
    };
    const started = dispatchCommand(
      eligible,
      {
        type: 'perform_item_action',
        commandId: 'commission-start',
        itemId: 'rigging-tablet',
        action: 'commission_work',
        now,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(started.history.lastCommissionWorkDate).toBeNull();
    expect(started.inventory['rigging-tablet']).toBe(0);
    const interrupted = reconcileTime(
      {
        ...started,
        metrics: { ...started.metrics, food: 1 },
      },
      now + HOUR_MS,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(interrupted.activity).toBeNull();
    expect(interrupted.history.lastCommissionWorkDate).toBeNull();
  });

  test('an eligible queued event stream is forced at its next opportunity', () => {
    const now = Date.UTC(2026, 0, 1, 14);
    for (const seed of ['queued-one', 'queued-two', 'queued-three']) {
      const state = run(now, seed);
      const resolved = resolveAttemptEvent(
        {
          ...state,
          progression: {
            ...state.progression,
            queuedEventStreams: [
              {
                id: 'queued',
                type: 'model_debut',
                queuedAt: now - HOUR_MS,
                durationHours: 4,
                donationMultiplier: 1,
                modelTier: 1,
              },
            ],
          },
        },
        `opportunity-${seed}`,
        BUNDLED_GAME_DEFINITION,
      );
      expect(resolved.activity?.type).toBe('stream');
      expect(resolved.progression.queuedEventStreams).toEqual([]);
    }
  });
});
