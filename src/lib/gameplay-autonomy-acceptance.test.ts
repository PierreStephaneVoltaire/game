import { describe, expect, test } from 'vitest';
import { resolveAudienceGrowth } from './audience-growth-rules';
import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { startRun } from './game-engine';
import { resolveAutomaticEventHook } from './simulation/event-hook-resolution';

const HOUR = 3_600_000;

function run(seed: string) {
  return startRun(
    { mode: 'realtime', now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('authored autonomy and audience soft cap', () => {
  test('Can Opener outcomes are seeded and explicitly attribute injuries', () => {
    const initial = run('can-opener');
    const item = BUNDLED_GAME_DEFINITION.items.find(
      (candidate) => candidate.id === 'can-opener',
    )!;
    const hook = item.automaticEventHooks![0];
    const seen = new Map<
      string,
      ReturnType<typeof resolveAutomaticEventHook>
    >();
    for (let index = 0; index < 2_000 && seen.size < 3; index += 1) {
      const resolution = resolveAutomaticEventHook({
        state: { ...initial, seed: `can-opener-${index}` },
        commandId: 'can-opener-event',
        itemId: item.id,
        hook,
      });
      seen.set(resolution.selectedOutcomeId ?? '', resolution);
    }
    expect([...seen.keys()].sort()).toEqual([
      'minor-cut',
      'normal',
      'serious-cut',
    ]);
    expect(seen.get('minor-cut')?.healthDamageSources?.[0].id).toBe(
      'can_opener_minor_cut',
    );
    expect(seen.get('serious-cut')?.metricDeltas.health).toBe(-2);
  });

  test('the fifth and later audience boosts receive quarter value in stable order', () => {
    const initial = run('audience-cap');
    const boosts = Array.from({ length: 6 }, (_, index) => ({
      streamId: `stream-${index + 1}`,
      startedAt: index < 2 ? 0 : index * HOUR,
      expiresAt: 7 * 24 * HOUR,
      careerTier: 'debut' as const,
      creativity: 0,
    }));
    boosts[0].streamId = 'stream-b';
    boosts[1].streamId = 'stream-a';
    const result = resolveAudienceGrowth(
      {
        ...initial,
        progression: { ...initial.progression, activeAudienceBoosts: boosts },
      },
      2 * HOUR,
    ).state;
    const event = result.events.findLast(
      (candidate) => candidate.type === 'natural_audience_growth',
    );
    expect(event?.followerDelta).toBe(6);
    expect(event?.fullValueAudienceBoostIds).toEqual([
      'stream-a',
      'stream-b',
      'stream-3',
      'stream-4',
    ]);
    expect(event?.discountedAudienceBoostIds).toEqual(['stream-5', 'stream-6']);
  });
});
