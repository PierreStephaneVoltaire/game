import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameState } from './game-types';

const HOUR = 3_600_000;

function run(now: number, seed: string): GameState {
  return startRun(
    { mode: 'realtime', now, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('career progression through the engine seam', () => {
  test('one completed stream awards every newly crossed milestone in order', () => {
    const startedAt = Date.UTC(2026, 0, 1, 12);
    const initial = run(startedAt, 'all-milestones');
    const streaming: GameState = {
      ...initial,
      metrics: {
        food: 10,
        health: 10,
        mood: 5,
        rest: 10,
        bond: 10,
        creativity: 10,
      },
      statuses: {},
      progression: { ...initial.progression, followers: 3_499 },
      activity: {
        id: 'milestone-stream',
        type: 'stream',
        startedAt,
        endsAt: startedAt + HOUR,
        sourceActionId: 'milestone-stream',
        payload: { hourlyRate: 10, startingCriticalMetrics: '' },
      },
      history: {
        ...initial.history,
        lastBondGainAt: startedAt,
        nextAutonomousAt: startedAt + 2 * HOUR,
      },
    };

    const completed = reconcileTime(
      streaming,
      startedAt + HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(completed.progression.followers).toBeGreaterThanOrEqual(3_501);
    expect(completed.progression.careerTier).toBe('three_d_ready');
    expect(completed.progression.awardedMilestones).toEqual([
      'affiliate',
      'partner',
      'convention_guest',
      'tournament_host',
      'three_d_ready',
    ]);
    expect(completed.progression.unlockedModelTiers).toEqual([1, 2, 3, 4]);
    expect(completed.progression.queuedEventStreams).toEqual([
      expect.objectContaining({
        type: 'tournament',
        durationHours: 8,
        donationMultiplier: 3,
      }),
    ]);
    expect(completed.metrics.mood).toBe(8);
    expect(completed.balance).toBeGreaterThanOrEqual(initial.balance + 500);
    expect(
      completed.events
        .filter((event) => event.type === 'career_milestone')
        .map((event) => event.message),
    ).toEqual([
      'affiliate milestone reached.',
      'partner milestone reached.',
      'convention guest milestone reached.',
      'tournament host milestone reached.',
      'three d ready milestone reached.',
    ]);
  });

  test('a purchased model service starts a nonblocking third-midnight project', () => {
    const startedAt = Date.UTC(2026, 2, 8, 1);
    const initial = startRun(
      {
        mode: 'streaming',
        now: startedAt,
        seed: 'model-project',
        timezone: 'America/Toronto',
      },
      BUNDLED_GAME_DEFINITION,
    );
    const eligible: GameState = {
      ...initial,
      balance: 1_000,
      inventory: { ...initial.inventory, 'new-model-commission': 1 },
      progression: {
        ...initial.progression,
        followers: 600,
        careerTier: 'partner',
        awardedMilestones: ['affiliate', 'partner'],
        unlockedModelTiers: [1],
      },
    };

    const started = dispatchCommand(
      eligible,
      {
        type: 'perform_item_action',
        commandId: 'start-model-one',
        itemId: 'new-model-commission',
        action: 'start_model_commission',
        now: startedAt,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(started.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'model_project_started',
    });
    expect(started.state.activity).toBeNull();
    expect(started.state.inventory['new-model-commission']).toBe(0);
    expect(started.state.projects).toEqual([
      expect.objectContaining({
        type: 'model_commission',
        modelTier: 1,
        startedAt,
        completesAt: Date.UTC(2026, 2, 10, 4),
      }),
    ]);
  });

  test('model completion changes appearance, rewards progress, and queues its debut', () => {
    const completesAt = Date.UTC(2026, 2, 10, 4);
    const initial = run(completesAt - 1, 'model-completion');
    const ready: GameState = {
      ...initial,
      metrics: {
        food: 7,
        health: 10,
        mood: 7,
        rest: 7,
        bond: 7,
        creativity: 7,
      },
      projects: [
        {
          id: 'model-four',
          type: 'model_commission',
          modelTier: 4,
          startedAt: completesAt - 3 * 24 * HOUR,
          completesAt,
          sourceActionId: 'model-four',
        },
      ],
      progression: {
        ...initial.progression,
        followers: 3_500,
        careerTier: 'three_d_ready',
        awardedMilestones: [
          'affiliate',
          'partner',
          'convention_guest',
          'tournament_host',
          'three_d_ready',
        ],
        unlockedModelTiers: [1, 2, 3, 4],
        completedModelTiers: [1, 2, 3],
      },
      history: {
        ...initial.history,
        lastBondGainAt: completesAt - 1,
        lastStatusReconcileAt: completesAt - 1,
        nextAutonomousAt: completesAt + HOUR,
      },
    };

    const completed = reconcileTime(
      ready,
      completesAt,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(completed.projects).toEqual([]);
    expect(completed.metrics).toMatchObject({ mood: 10, creativity: 9 });
    expect(completed.progression).toMatchObject({
      followers: 3_550,
      activeAppearanceId: 'three_d_debut',
      completedModelTiers: [1, 2, 3, 4],
      permanentDonationBonus: true,
      queuedEventStreams: [
        expect.objectContaining({
          type: 'model_debut',
          durationHours: 4,
          modelTier: 4,
        }),
      ],
    });
  });
});
