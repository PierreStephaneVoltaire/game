import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { startRun } from './game-engine';
import { resolveLifeEvent } from './life-event-rules';

function run() {
  return startRun(
    { mode: 'streaming', now: 0, seed: 'life-events', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('authored life events', () => {
  test('replays an expense deterministically with signed ledger effects', () => {
    const initial = run();
    const first = resolveLifeEvent(initial, 'tax_bill', 0, 'tax-attempt');
    const replay = resolveLifeEvent(initial, 'tax_bill', 0, 'tax-attempt');
    const event = first.events.find(
      (candidate) => candidate.lifeEventId === 'tax_bill',
    );

    expect(first).toEqual(replay);
    expect(event?.cashDelta).toBeLessThan(0);
    expect(event?.financialEffect?.cashDelta).toBe(event?.cashDelta);
    expect(first.inventory).toEqual(initial.inventory);
    expect(first.shop).toEqual(initial.shop);
    expect(first.activity).toEqual(initial.activity);
  });

  test('applies personal-purchase cash and Mood effects atomically', () => {
    const initial = { ...run(), metrics: { ...run().metrics, mood: 5 } };
    const resolved = resolveLifeEvent(
      initial,
      'personal_purchase',
      0,
      'purchase-attempt',
    );
    const event = resolved.events.find(
      (candidate) => candidate.lifeEventId === 'personal_purchase',
    );

    expect(event?.cashDelta).toBeLessThan(-10);
    expect(event?.cashDelta).toBeGreaterThan(-300);
    expect(event?.metricDeltas?.mood).toBeGreaterThan(0);
    expect(resolved.balance).toBe(initial.balance + event!.cashDelta!);
  });

  test('subscriber loss preserves peak audience and milestone rewards', () => {
    const initial = run();
    const established = {
      ...initial,
      progression: {
        ...initial.progression,
        followers: 10_000,
        peakFollowers: 10_000,
      },
    };
    const resolved = resolveLifeEvent(
      established,
      'twitter_cancellation',
      0,
      'twitter-attempt',
    );

    expect(resolved.progression.followers).toBeLessThan(10_000);
    expect(resolved.progression.peakFollowers).toBe(10_000);
  });

  test('agency adds Subscribers and starts a temporary natural-growth boost', () => {
    const initial = run();
    const eligible = {
      ...initial,
      progression: {
        ...initial.progression,
        followers: 100_000,
        peakFollowers: 100_000,
      },
    };
    const resolved = resolveLifeEvent(
      eligible,
      'agency_invitation',
      0,
      'agency-attempt',
    );

    expect(resolved.progression.followers).toBe(200_000);
    expect(resolved.progression.discoveryBoosts).toContainEqual(
      expect.objectContaining({
        eventId: 'agency_invitation',
        multiplier: 1.5,
        expiresAt: 168 * 60 * 60 * 1000,
      }),
    );
    expect(resolved.ending).toBeNull();
  });
});
