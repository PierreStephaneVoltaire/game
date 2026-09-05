import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { reconcileTime, startRun } from './game-engine';

const HOUR = 60 * 60 * 1000;

function run() {
  return startRun(
    {
      mode: 'streaming',
      now: Date.UTC(2026, 0, 1, 12),
      seed: 'subscriber-revenue',
      timezone: 'UTC',
    },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('Subscriber Revenue chronology', () => {
  test('applies a newly crossed multiplier after projects and the autonomous draw but before activity completion', () => {
    const started = run();
    const boundary = started.now + 2 * HOUR;
    const initial = {
      ...started,
      progression: { ...started.progression, followers: 29_950 },
      projects: [
        {
          id: 'model-at-revenue-boundary',
          type: 'model_commission' as const,
          startedAt: started.now,
          completesAt: boundary,
          sourceActionId: 'model-project',
          modelTier: 1 as const,
        },
      ],
      activity: {
        id: 'activity-at-revenue-boundary',
        type: 'play' as const,
        startedAt: started.now,
        endsAt: boundary,
        sourceActionId: 'play-at-boundary',
      },
    };

    const result = reconcileTime(
      initial,
      boundary,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const relevantTypes = result.events
      .filter((event) => event.at === boundary)
      .map((event) => event.type);
    const milestone = result.events.find(
      (event) => event.type === 'career_milestone' && event.cause === 'sub_30k',
    );

    expect(milestone).toEqual(
      expect.objectContaining({ revenueMultiplier: 1.5 }),
    );
    expect(relevantTypes.indexOf('project_completed')).toBeLessThan(
      relevantTypes.indexOf('random_event_opportunity'),
    );
    expect(relevantTypes.indexOf('random_event_opportunity')).toBeLessThan(
      relevantTypes.indexOf('subscriber_revenue'),
    );
    expect(relevantTypes.indexOf('subscriber_revenue')).toBeLessThan(
      relevantTypes.indexOf('activity_completed'),
    );
    expect(
      result.events.find((event) => event.type === 'subscriber_revenue'),
    ).toEqual(
      expect.objectContaining({
        amount: 3,
        revenueMultiplier: 1.5,
        legacyRevenueAmount: 2,
        subscriberRevenueFloor: 3,
      }),
    );
  });

  test('catches up every two-hour payment independently of autonomous scheduling', () => {
    const started = run();
    const initial = {
      ...started,
      progression: { ...started.progression, followers: 1_000_000 },
      history: {
        ...started.history,
        nextAutonomousAt: started.now + 100 * HOUR,
      },
      activity: {
        id: 'long-hospital-stay',
        type: 'medical_care' as const,
        startedAt: started.now,
        endsAt: started.now + 30 * HOUR,
        sourceActionId: 'hospital',
      },
    };

    const result = reconcileTime(
      initial,
      initial.now + 24 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const payments = result.events.filter(
      (event) => event.type === 'subscriber_revenue',
    );

    expect(payments).toHaveLength(12);
    expect(payments.reduce((sum, event) => sum + (event.amount ?? 0), 0)).toBe(
      120,
    );
  });

  test('uses the pre-completion multiplier when a stream crosses a milestone at the same boundary', () => {
    const started = run();
    const boundary = started.now + 2 * HOUR;
    const initial = {
      ...started,
      progression: { ...started.progression, followers: 29_999 },
      history: {
        ...started.history,
        nextAutonomousAt: started.now + 100 * HOUR,
      },
      activity: {
        id: 'stream-at-revenue-boundary',
        type: 'stream' as const,
        startedAt: started.now,
        endsAt: boundary,
        sourceActionId: 'stream-at-boundary',
        payload: { hourlyRate: 5, donationMultiplier: 1 },
      },
    };

    const result = reconcileTime(
      initial,
      boundary,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const revenueIndex = result.events.findIndex(
      (event) => event.type === 'subscriber_revenue',
    );
    const milestoneIndex = result.events.findIndex(
      (event) => event.type === 'career_milestone' && event.cause === 'sub_30k',
    );

    expect(result.events[revenueIndex]).toEqual(
      expect.objectContaining({
        amount: 2,
        revenueMultiplier: 1,
        legacyRevenueAmount: 1,
        subscriberRevenueFloor: 2,
      }),
    );
    expect(revenueIndex).toBeLessThan(milestoneIndex);
    expect(result.events[milestoneIndex]).toEqual(
      expect.objectContaining({ revenueMultiplier: 1.5 }),
    );
  });
});
