import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { reconcileTime, startRun } from './game-engine';
import type { GameState } from './game-types';

const HOUR = 3_600_000;
const START = Date.UTC(2026, 0, 1, 0);

function prepared(seed: string): GameState {
  const initial = startRun(
    { mode: 'realtime', now: START, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
  return {
    ...initial,
    metrics: {
      food: 10,
      health: 30,
      mood: 10,
      rest: 10,
      bond: 10,
      creativity: 10,
    },
    statuses: {},
  };
}

function reconcileSplit(initial: GameState, hours: number) {
  let state = initial;
  for (let elapsed = 2; elapsed <= hours; elapsed += 2)
    state = reconcileTime(
      state,
      START + elapsed * HOUR,
      BUNDLED_GAME_DEFINITION,
      { preventLethalDecay: true },
    ).state;
  return state;
}

function autonomousOpportunities(state: GameState) {
  return state.events.filter(
    (event) =>
      event.type === 'random_event_opportunity' &&
      event.sourceActionId?.startsWith('autonomous:'),
  );
}

describe('autonomous catch-up chronology', () => {
  test('one-shot and two-hour reconciliation process the same 24-hour boundaries', () => {
    const initial = prepared('autonomous-catch-up-24');
    const oneShot = reconcileTime(
      initial,
      START + 24 * HOUR,
      BUNDLED_GAME_DEFINITION,
      { preventLethalDecay: true },
    ).state;
    const split = reconcileSplit(initial, 24);
    const evidence = (state: GameState) =>
      autonomousOpportunities(state).map((event) => ({
        at: event.at,
        cause: event.cause,
        sourceActionId: event.sourceActionId,
      }));

    expect(evidence(oneShot)).toHaveLength(12);
    expect(evidence(oneShot)).toEqual(evidence(split));
    expect(split).toEqual(oneShot);
  });

  test('a 96-hour catch-up can complete multiple streams identically', () => {
    let selected:
      { initial: GameState; oneShot: GameState; split: GameState } | undefined;
    for (let index = 0; index < 500 && !selected; index += 1) {
      const initial = prepared(`autonomous-catch-up-96-${index}`);
      const oneShot = reconcileTime(
        initial,
        START + 96 * HOUR,
        BUNDLED_GAME_DEFINITION,
        { preventLethalDecay: true },
      ).state;
      const ordinaryStarts = oneShot.events.filter(
        (event) =>
          event.type === 'stream_candidate' &&
          event.ordinaryStream &&
          event.streamActivityStarted,
      );
      if (ordinaryStarts.length < 2) continue;
      selected = { initial, oneShot, split: reconcileSplit(initial, 96) };
    }

    expect(selected).toBeDefined();
    expect(selected!.split).toEqual(selected!.oneShot);
    expect(
      selected!.oneShot.events.filter(
        (event) =>
          event.activityType === 'stream' &&
          (event.type === 'activity_completed' ||
            event.type === 'activity_interrupted'),
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(selected!.oneShot.balance).toBe(selected!.split.balance);
    expect(selected!.oneShot.progression.followers).toBe(
      selected!.split.progression.followers,
    );
  });
});
