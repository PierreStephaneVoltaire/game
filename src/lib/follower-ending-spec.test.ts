import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { startRun } from './game-engine';
import { settleFollowerChange } from './follower-rules';
import type { GameState } from './game-types';

function run() {
  return startRun(
    { mode: 'streaming', now: 0, seed: 'follower-ending', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('current and peak Subscribers', () => {
  test('a loss changes current Subscribers without revoking peak progression', () => {
    const initial = run();
    const established: GameState = {
      ...initial,
      progression: {
        ...initial.progression,
        followers: 10_000,
        peakFollowers: 10_000,
        careerTier: 'twitch_partner' as const,
        awardedMilestones: [
          'debut',
          'first_model',
          'sub_1k',
          'model_redesign',
          'twitch_partner',
        ],
      },
    };
    const result = settleFollowerChange(established, {
      amount: -500,
      at: 0,
      sourceActionId: 'twitter-cancellation',
      eventType: 'life_event_resolved',
      message: 'A cancellation cost 5% of the audience.',
    }).state;

    expect(result.progression.followers).toBe(9_500);
    expect(result.progression.peakFollowers).toBe(10_000);
    expect(result.progression.careerTier).toBe('twitch_partner');
    expect(result.progression.awardedMilestones).toContain('twitch_partner');
  });

  test('Made It unlocks once at 3M current Subscribers and remains nonterminal', () => {
    const initial = run();
    const near = {
      ...initial,
      progression: {
        ...initial.progression,
        followers: 2_999_900,
        peakFollowers: 2_999_900,
      },
    };
    const unlocked = settleFollowerChange(near, {
      amount: 100,
      at: 123,
      sourceActionId: 'growth-to-made-it',
      eventType: 'natural_audience_growth',
      message: 'Natural audience growth added 100 subscribers.',
    }).state;

    expect(unlocked.ending).toBeNull();
    expect(unlocked.endingUnlocks.made_it).toMatchObject({
      kind: 'made_it',
      at: 123,
      followers: 3_000_000,
      triggerEventId: expect.any(String),
    });
    expect(
      unlocked.events.filter((event) => event.type === 'ending_unlocked'),
    ).toHaveLength(1);

    const recovered = settleFollowerChange(unlocked, {
      amount: -100_000,
      at: 124,
      sourceActionId: 'loss',
      eventType: 'life_event_resolved',
      message: 'Subscribers fell.',
    }).state;
    const repeated = settleFollowerChange(recovered, {
      amount: 100_000,
      at: 125,
      sourceActionId: 'recovery',
      eventType: 'natural_audience_growth',
      message: 'Subscribers recovered.',
    }).state;
    expect(
      repeated.events.filter((event) => event.type === 'ending_unlocked'),
    ).toHaveLength(1);
  });
});
