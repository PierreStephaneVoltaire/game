import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { HOUR_MS, MINUTE_MS } from './game-constants';
import {
  LIFE_EVENT_INTERVAL_MS,
  nextLifeEventBoundary,
  processLifeEventBoundary,
  rollLifeEventIds,
} from './life-event-scheduler';
import { resolveLifeEvent } from './life-event-rules';
import { resolveAudienceGrowth } from './audience-growth-rules';
import { reconcileTime, startRun } from './game-engine';

function run(mode: 'realtime' | 'streaming' = 'realtime', now = 0) {
  return startRun(
    { mode, now, seed: 'life-event-scheduler', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('run-anchored life-event scheduler', () => {
  test('anchors each boundary to the run start and catches the exact boundary', () => {
    const started = run('realtime', 1234);
    expect(LIFE_EVENT_INTERVAL_MS).toBe(30 * MINUTE_MS);
    expect(nextLifeEventBoundary(started)).toBe(1234 + LIFE_EVENT_INTERVAL_MS);

    const result = reconcileTime(
      started,
      1234 + LIFE_EVENT_INTERVAL_MS,
      BUNDLED_GAME_DEFINITION,
    );
    expect(result.state.history.lifeEventScheduler.boundariesProcessed).toBe(1);
    expect(result.state.lastResolvedAt).toBe(1234 + LIFE_EVENT_INTERVAL_MS);
  });

  test('resolves same-boundary successes in table order and is idempotent', () => {
    const started = run();
    const at = LIFE_EVENT_INTERVAL_MS;
    const first = processLifeEventBoundary(started, at, [
      'twitter_cancellation',
      'algorithm_boost',
      'rain',
    ]);
    const lifeEvents = first.state.events.filter(
      (event) => event.type === 'life_event_resolved',
    );
    expect(lifeEvents.map((event) => event.lifeEventId)).toEqual([
      'rain',
      'algorithm_boost',
      'twitter_cancellation',
    ]);
    expect(first.state.history.lifeEventScheduler).toMatchObject({
      boundariesProcessed: 1,
      successfulRolls: {
        rain: 1,
        algorithm_boost: 1,
        twitter_cancellation: 1,
      },
      multiSuccessBoundaries: 1,
    });
    expect(processLifeEventBoundary(first.state, at)).toEqual({
      state: first.state,
      eventIds: [],
    });
  });

  test('does not resolve after a terminal event or process later successes', () => {
    const insolvent = {
      ...run(),
      balance: -20_000,
    };
    const result = processLifeEventBoundary(insolvent, LIFE_EVENT_INTERVAL_MS, [
      'gpu_failure',
      'tax_bill',
    ]);
    expect(result.state.ending?.kind).toBe('financial_ruin');
    expect(
      result.state.events.filter(
        (event) => event.lifeEventId === 'gpu_failure',
      ),
    ).toHaveLength(0);
  });

  test('suppresses repeat Agency rolls using persistent membership', () => {
    const joined = resolveLifeEvent(
      run(),
      'agency_invitation',
      0,
      'agency-first',
    );
    const result = processLifeEventBoundary(joined, LIFE_EVENT_INTERVAL_MS, [
      'agency_invitation',
    ]);
    expect(result.state.progression.agencyJoinedAt).toBe(0);
    expect(
      result.state.history.lifeEventScheduler.suppressedAgencyInvitations,
    ).toBe(1);
    expect(
      result.state.events.filter(
        (event) => event.lifeEventId === 'agency_invitation',
      ),
    ).toHaveLength(1);
  });

  test('refreshes Algorithm and multiplies simultaneous discovery boosts', () => {
    const first = resolveLifeEvent(
      run(),
      'algorithm_boost',
      0,
      'algorithm-first',
    );
    const refreshed = resolveLifeEvent(
      first,
      'algorithm_boost',
      6 * HOUR_MS,
      'algorithm-refresh',
    );
    expect(refreshed.progression.discoveryBoosts).toHaveLength(1);
    expect(refreshed.progression.discoveryBoosts[0]).toMatchObject({
      eventId: 'algorithm_boost',
      multiplier: 1.5,
      startedAt: 6 * HOUR_MS,
      expiresAt: 30 * HOUR_MS,
    });

    const withAgency = resolveLifeEvent(
      refreshed,
      'agency_invitation',
      6 * HOUR_MS,
      'agency-at-refresh',
    );
    const growth = resolveAudienceGrowth(withAgency, 8 * HOUR_MS);
    const event = growth.state.events.find(
      (candidate) => candidate.type === 'natural_audience_growth',
    );
    expect(event?.followerDelta).toBe(675);
  });

  test('expires each boost once at its exact deadline', () => {
    const boosted = resolveLifeEvent(run(), 'algorithm_boost', 0, 'algorithm');
    const atExpiry = resolveAudienceGrowth(boosted, 24 * HOUR_MS);
    expect(atExpiry.state.progression.discoveryBoosts).toEqual([]);
    expect(
      atExpiry.state.events.filter(
        (event) => event.type === 'life_event_effect_expired',
      ),
    ).toHaveLength(1);
    const replay = resolveAudienceGrowth(atExpiry.state, 24 * HOUR_MS);
    expect(
      replay.state.events.filter(
        (event) => event.type === 'life_event_effect_expired',
      ),
    ).toHaveLength(1);
  });

  test('uses the same seeded roll sequence for both modes', () => {
    const realtime = run('realtime');
    const streaming = run('streaming');
    let left = realtime;
    let right = streaming;
    const leftRolls: string[][] = [];
    const rightRolls: string[][] = [];
    for (let index = 0; index < 32; index += 1) {
      const at = nextLifeEventBoundary(left);
      leftRolls.push(rollLifeEventIds(left, at));
      rightRolls.push(rollLifeEventIds(right, at));
      left = processLifeEventBoundary(left, at).state;
      right = processLifeEventBoundary(right, at).state;
    }
    expect(rightRolls).toEqual(leftRolls);
  });

  test('tracks every boundary in a complete 60-day scheduler run', () => {
    let state = run();
    for (let index = 0; index < 60 * 24 * 2; index += 1) {
      const boundary = nextLifeEventBoundary(state);
      state = processLifeEventBoundary(state, boundary).state;
    }
    expect(state.history.lifeEventScheduler.boundariesProcessed).toBe(2_880);
  });
});
