import { describe, expect, test } from 'vitest';

import {
  activateClippers,
  recordStreamEnd,
  registerStreamStart,
  resolveAudienceGrowth,
} from './audience-growth-rules';
import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function run() {
  return startRun(
    { mode: 'realtime', now: 0, seed: 'audience', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('audience growth module', () => {
  test('adds tier baseline plus seven-day stream contributions every two hours', () => {
    const initial = run();
    const streamed = registerStreamStart(
      { ...initial, metrics: { ...initial.metrics, creativity: 5 } },
      'stream-1',
    );

    const first = resolveAudienceGrowth(streamed, 2 * HOUR).state;
    expect(first.progression.followers - initial.progression.followers).toBe(2);
    expect(first.progression.activeAudienceBoosts[0]).toMatchObject({
      streamId: 'stream-1',
      careerTier: 'debut',
      creativity: 5,
      expiresAt: 7 * DAY,
    });

    const expired = resolveAudienceGrowth(
      { ...first, now: 7 * DAY },
      7 * DAY,
    ).state;
    expect(expired.progression.activeAudienceBoosts).toEqual([]);
    expect(expired.progression.followers - first.progression.followers).toBe(1);
  });

  test('tracks starts, completion outcomes, and exact elapsed milliseconds', () => {
    const started = registerStreamStart(run(), 'stream-1');
    const completed = recordStreamEnd(started, 90 * 60_000, false);
    const interrupted = recordStreamEnd(completed, 15 * 60_000, true);

    expect(interrupted.progression.streamStats).toEqual({
      started: 1,
      completed: 1,
      interrupted: 1,
      elapsedMs: 105 * 60_000,
    });
  });

  test('Clippers pay immediately, stack on renewal, keep their tick, and expire together', () => {
    const first = activateClippers(run()).state;
    expect(first.progression.followers).toBe(150);
    expect(first.timedEffects.clippers).toMatchObject({
      stacks: 1,
      nextClipAt: DAY,
      expiresAt: 3 * DAY,
    });

    const renewed = activateClippers({ ...first, now: 12 * HOUR }).state;
    expect(renewed.progression.followers).toBe(150);
    expect(renewed.timedEffects.clippers).toMatchObject({
      stacks: 2,
      nextClipAt: DAY,
      expiresAt: 3 * DAY + 12 * HOUR,
    });

    const daily = resolveAudienceGrowth(renewed, DAY).state;
    expect(
      daily.events.findLast((event) => event.type === 'clipper_audience_growth')
        ?.followerDelta,
    ).toBe(200);

    const expired = resolveAudienceGrowth(
      { ...daily, now: 3 * DAY + 12 * HOUR },
      3 * DAY + 12 * HOUR,
    ).state;
    expect(expired.timedEffects.clippers).toBeNull();
  });

  test('the catalogue action consumes a Clipper and activates its career effect', () => {
    const initial = run();
    const result = dispatchCommand(
      { ...initial, inventory: { ...initial.inventory, clippers: 1 } },
      {
        type: 'perform_item_action',
        commandId: 'activate-clippers',
        itemId: 'clippers',
        action: 'activate_clippers',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'item_action_performed',
    });
    expect(result.state.inventory.clippers).toBe(0);
    expect(result.state.timedEffects.clippers?.stacks).toBe(1);
    expect(result.state.progression.followers).toBe(150);
  });
});
