import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { startRun } from './game-engine';
import { settleFollowerChange } from './follower-rules';
import { resolveLifeEvent } from './life-event-rules';
import { completeStreamEconomy } from './economy-rules';
import type { GameState } from './game-types';

const HOUR = 3_600_000;

function run(followers = 0): GameState {
  const state = startRun(
    { mode: 'streaming', now: 0, seed: 'ledger', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
  return {
    ...state,
    progression: { ...state.progression, followers, peakFollowers: followers },
  };
}

function expectContiguousLedger(state: GameState) {
  const ids = state.events.map(({ id }) => id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual(ids.map((_, index) => `event-${index + 1}`));
}

function grow(state: GameState, amount: number, at: number) {
  return settleFollowerChange(state, {
    amount,
    at,
    sourceActionId: 'natural_audience_growth',
    eventType: 'natural_audience_growth',
    message: 'Followers grew.',
  }).state;
}

describe('event ledger integrity across Subscriber milestones', () => {
  test('natural growth through the first and later milestones keeps IDs unique and contiguous', () => {
    let state = grow(run(90), 70, HOUR);
    expect(state.progression.awardedMilestones).toContain('first_model');
    state = grow(state, 1, 2 * HOUR);
    state = grow(state, 900, 3 * HOUR);
    expect(state.progression.awardedMilestones).toContain('sub_1k');
    state = grow(state, 1, 4 * HOUR);

    expectContiguousLedger(state);
  });

  test('a life event that crosses several milestones keeps IDs unique and contiguous', () => {
    const state = resolveLifeEvent(
      run(),
      'agency_invitation',
      HOUR,
      'life-event-1',
      BUNDLED_GAME_DEFINITION,
    );
    expect(state.progression.awardedMilestones.length).toBeGreaterThan(1);
    const after = grow(state, 1, 2 * HOUR);

    expectContiguousLedger(after);
  });

  test('stream economy awards keep IDs unique and contiguous once appended', () => {
    const initial = run(140);
    const economy = completeStreamEconomy(
      { ...initial, metrics: { ...initial.metrics, creativity: 10 } },
      'stream-1',
      12,
      12 * HOUR,
      20,
      50,
    );
    const appended = grow(
      { ...economy.state, events: [...initial.events, ...economy.events] },
      1,
      13 * HOUR,
    );

    expectContiguousLedger(appended);
  });
});
