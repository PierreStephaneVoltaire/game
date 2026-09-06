import { describe, expect, test } from 'vitest';
import { resolveAudienceGrowth } from './audience-growth-rules';
import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { startRun } from './game-engine';
import { resolveAutomaticEventHook } from './simulation/event-hook-resolution';
import { eventCandidates } from './event-candidate-pool';
import { localDate } from './shop-rules';

const HOUR = 3_600_000;

function run(seed: string) {
  return startRun(
    { mode: 'realtime', now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('authored autonomy and audience soft cap', () => {
  test('Drawing Tablet uses the pre-payout Balance for its shared side-gig cooldown', () => {
    const initial = run('emote-cooldown');
    const item = BUNDLED_GAME_DEFINITION.items.find(
      (candidate) => candidate.id === 'drawing-tablet',
    )!;
    const hook = item.automaticEventHooks!.find(
      (candidate) => candidate.id === 'small-emote-commission',
    )!;
    const solvent = resolveAutomaticEventHook({
      state: initial,
      commandId: 'emote-solvent',
      itemId: item.id,
      hook,
    });
    const inDebt = resolveAutomaticEventHook({
      state: { ...initial, balance: -1 },
      commandId: 'emote-debt',
      itemId: item.id,
      hook,
    });

    expect(solvent.cooldownAt).toBe(36 * HOUR);
    expect(inDebt.balanceDelta).toBeGreaterThan(1);
    expect(inDebt.cooldownAt).toBe(18 * HOUR);
  });

  test('the debt cooldown reopens the shared slot but later debt is not retroactive', () => {
    const initial = run('shared-side-gig');
    const eligible = {
      ...initial,
      now: 18 * HOUR,
      balance: -1,
      inventory: {
        ...initial.inventory,
        'drawing-tablet': 1,
        'merch-sample': 1,
      },
      progression: {
        ...initial.progression,
        followers: 1_000,
        peakFollowers: 1_000,
        careerTier: 'sub_1k' as const,
      },
      history: {
        ...initial.history,
        eventCooldowns: { autonomous_side_gig: 18 * HOUR },
      },
    };
    const causes = eventCandidates(
      eligible,
      BUNDLED_GAME_DEFINITION,
      localDate(eligible.now, eligible.timezone),
      0,
    ).map(({ type, weight }) => ({ type, weight }));
    expect(causes).toEqual(
      expect.arrayContaining([
        {
          type: 'item_hook:drawing-tablet:small-emote-commission',
          weight: 3,
        },
        { type: 'item_hook:merch-sample:merch-sample-sale', weight: 3 },
      ]),
    );

    const retroactive = eventCandidates(
      {
        ...eligible,
        history: {
          ...eligible.history,
          eventCooldowns: { autonomous_side_gig: 36 * HOUR },
        },
      },
      BUNDLED_GAME_DEFINITION,
      localDate(eligible.now, eligible.timezone),
      0,
    );
    expect(
      retroactive.filter(({ type }) => type.startsWith('item_hook:')),
    ).toEqual([]);
  });

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
