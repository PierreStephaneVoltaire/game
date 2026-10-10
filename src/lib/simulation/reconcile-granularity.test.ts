import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from '../test-game-definition';
import { reconcileTime, startRun } from '../game-engine';
import type { GameState } from '../game-types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const START = Date.UTC(2026, 0, 2, 10);

function realtimeRun(seed: string): GameState {
  return startRun(
    { mode: 'realtime', now: START, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

function reconcileIn(state: GameState, steps: number[]): GameState {
  let next = state;
  for (const at of steps)
    next = reconcileTime(next, at, BUNDLED_GAME_DEFINITION, {
      preventLethalDecay: true,
    }).state;
  return next;
}

function ledger(state: GameState) {
  return state.events.map(({ type, at, metricDeltas }) => ({
    type,
    at,
    metricDeltas,
  }));
}

describe('reconciliation granularity', () => {
  test.each(['granularity-a', 'granularity-b', 'granularity-c'])(
    'minute, irregular, and bulk reconciliation agree for %s',
    (seed) => {
      const initial = realtimeRun(seed);
      const end = START + 6 * HOUR;
      const bulk = reconcileIn(initial, [end]);
      const minutes = reconcileIn(
        initial,
        Array.from(
          { length: 6 * 60 },
          (_, index) => START + (index + 1) * MINUTE,
        ),
      );
      const irregular = reconcileIn(initial, [
        START + 7 * MINUTE,
        START + 61 * MINUTE,
        START + 119 * MINUTE,
        START + 2 * HOUR,
        START + 2 * HOUR + 1,
        START + 4 * HOUR + 59 * MINUTE,
        end,
      ]);

      expect(ledger(minutes)).toEqual(ledger(bulk));
      expect(ledger(irregular)).toEqual(ledger(bulk));
      expect(minutes.metrics).toEqual(bulk.metrics);
      expect(irregular.metrics).toEqual(bulk.metrics);
    },
  );

  test('saves with fractional-hour remainders resolve like their millisecond equivalent', () => {
    const initial = realtimeRun('legacy-remainders');
    const { decayRemainderMs, healthRemainderMs, ...legacyHistory } =
      initial.history;
    void decayRemainderMs;
    void healthRemainderMs;
    const legacy: GameState = {
      ...initial,
      history: {
        ...legacyHistory,
        decayRemainderHours: 1.5,
        healthRemainderHours: 0.25,
      },
    };
    const current: GameState = {
      ...initial,
      history: {
        ...initial.history,
        decayRemainderMs: 1.5 * HOUR,
        healthRemainderMs: 0.25 * HOUR,
      },
    };
    const end = START + 5 * HOUR;
    const fromLegacy = reconcileIn(legacy, [end]);
    const fromCurrent = reconcileIn(current, [end]);

    expect(ledger(fromLegacy)).toEqual(ledger(fromCurrent));
    expect(fromLegacy.metrics).toEqual(fromCurrent.metrics);
    expect(fromLegacy.history.decayRemainderMs).toBe(
      fromCurrent.history.decayRemainderMs,
    );
  });
});
