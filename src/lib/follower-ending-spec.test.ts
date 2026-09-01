import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { GameController } from './game-controller';
import { dispatchCommand, startRun } from './game-engine';
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

  test('Made It ends the run at 3M current Subscribers', async () => {
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

    expect(unlocked.ending).toMatchObject({
      kind: 'made_it',
      at: 123,
      followers: 3_000_000,
      triggerEventId: expect.any(String),
    });
    expect(unlocked.endingUnlocks.made_it).toMatchObject({
      kind: 'made_it',
      at: 123,
      followers: 3_000_000,
      triggerEventId: expect.any(String),
    });
    expect(
      unlocked.events.filter((event) => event.type === 'ending_unlocked'),
    ).toHaveLength(1);

    const rejected = dispatchCommand(
      unlocked,
      { type: 'wait', commandId: 'after-made-it', now: 124 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(rejected.state).toBe(unlocked);
    expect(rejected.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'run_over',
    });

    const controller = new GameController({
      async load() {
        return BUNDLED_GAME_DEFINITION;
      },
    });
    await controller.load({ ...unlocked, ending: null });
    expect(controller.current?.ending).toEqual(unlocked.endingUnlocks.made_it);
  });
});
