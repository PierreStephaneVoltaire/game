import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameState } from './game-types';
import rules from './data/simulation-rules.json';

const HOUR = 3_600_000;

function run(now: number, seed: string): GameState {
  return startRun(
    { mode: 'realtime', now, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('career progression through the engine seam', () => {
  test('uses the authored career ladder and exact follower thresholds', () => {
    expect(
      rules.progression.milestones.map(({ id, followers }) => [id, followers]),
    ).toEqual([
      ['debut', 100],
      ['first_model', 150],
      ['sub_1k', 1_000],
      ['model_redesign', 5_000],
      ['twitch_partner', 10_000],
      ['sub_30k', 30_000],
      ['tournament_appearance', 40_000],
      ['sub_50k', 50_000],
      ['convention_guest', 75_000],
      ['sub_100k', 100_000],
      ['three_d_ready', 150_000],
      ['sub_200k', 200_000],
      ['sub_250k', 250_000],
      ['sub_500k', 500_000],
      ['sub_1m', 1_000_000],
    ]);
    expect(run(0, 'career-start').progression).toMatchObject({
      followers: 100,
      careerTier: 'debut',
      awardedMilestones: ['debut'],
    });
  });

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
      progression: { ...initial.progression, followers: 999_999 },
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

    expect(completed.progression.followers).toBeGreaterThanOrEqual(1_000_001);
    expect(completed.progression.careerTier).toBe('sub_1m');
    expect(completed.progression.awardedMilestones).toEqual([
      'debut',
      'first_model',
      'sub_1k',
      'model_redesign',
      'twitch_partner',
      'sub_30k',
      'tournament_appearance',
      'sub_50k',
      'convention_guest',
      'sub_100k',
      'three_d_ready',
      'sub_200k',
      'sub_250k',
      'sub_500k',
      'sub_1m',
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
      'first model milestone reached.',
      'sub 1k milestone reached.',
      'model redesign milestone reached.',
      'twitch partner milestone reached.',
      'sub 30k milestone reached.',
      'tournament appearance milestone reached.',
      'sub 50k milestone reached.',
      'convention guest milestone reached.',
      'sub 100k milestone reached.',
      'three d ready milestone reached.',
      'sub 200k milestone reached.',
      'sub 250k milestone reached.',
      'sub 500k milestone reached.',
      'sub 1m milestone reached.',
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
        followers: 150,
        careerTier: 'first_model',
        awardedMilestones: ['debut', 'first_model'],
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
        followers: 150_000,
        careerTier: 'three_d_ready',
        awardedMilestones: [
          'debut',
          'first_model',
          'sub_1k',
          'model_redesign',
          'twitch_partner',
          'sub_30k',
          'tournament_appearance',
          'sub_50k',
          'convention_guest',
          'sub_100k',
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
      followers: 150_050,
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
