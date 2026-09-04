import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameMode, GameState, StatusName } from './game-types';

const HOUR = 3_600_000;

function run(mode: GameMode = 'streaming', seed = 'status-acceptance') {
  return startRun(
    { mode, now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

function timeline(
  state: GameState,
  metrics: Partial<GameState['metrics']>,
  statuses: GameState['statuses'] = {},
) {
  return reconcileTime(
    { ...state, metrics: { ...state.metrics, ...metrics }, statuses },
    1,
    BUNDLED_GAME_DEFINITION,
  ).state;
}

const lowStatuses: Array<{
  status: StatusName;
  metrics: Partial<GameState['metrics']>;
  clear: Partial<GameState['metrics']>;
}> = [
  { status: 'starving', metrics: { food: 2 }, clear: { food: 5 } },
  { status: 'hungry', metrics: { food: 3 }, clear: { food: 5 } },
  { status: 'sleep_deprived', metrics: { rest: 2 }, clear: { rest: 5 } },
  { status: 'depressed', metrics: { mood: 2 }, clear: { mood: 5 } },
  { status: 'lonely', metrics: { bond: 2 }, clear: { bond: 5 } },
  {
    status: 'creative_block',
    metrics: { creativity: 2 },
    clear: { creativity: 5 },
  },
  {
    status: 'low_energy',
    metrics: { food: 2, rest: 3 },
    clear: { food: 4, rest: 4 },
  },
  { status: 'full', metrics: { food: 9 }, clear: { food: 7 } },
];

describe('canonical status public seam', () => {
  test.each(lowStatuses)(
    '$status has its exact onset and clearance boundary',
    ({ status, metrics, clear }) => {
      const started = timeline(run(), metrics);
      expect(started.statuses[status]).toBeDefined();

      const active = timeline(run(), clear, {
        [status]: { since: 0, source: 'acceptance' },
      });
      expect(active.statuses[status]).toBeUndefined();
    },
  );

  test('Lonely and Creative Block recur only while their source is at most 2', () => {
    for (const status of ['lonely', 'creative_block'] as const) {
      const metric = status === 'lonely' ? 'bond' : 'creativity';
      const low = {
        ...run(),
        metrics: {
          ...run().metrics,
          food: 10,
          rest: 10,
          mood: 10,
          [metric]: 2,
        },
        statuses: { [status]: { since: 0, source: 'acceptance' } },
        history: { ...run().history, nextAutonomousAt: 13 * HOUR },
      } as GameState;
      const lowResult = reconcileTime(
        low,
        12 * HOUR,
        BUNDLED_GAME_DEFINITION,
      ).state;
      const recurrences = lowResult.events.filter(
        (event) => event.type === 'status_recurrence',
      );
      expect(recurrences).toHaveLength(1);
      expect(recurrences[0].metricDeltas?.mood).toBe(-1);

      const aboveThreshold = {
        ...low,
        metrics: { ...low.metrics, [metric]: 3 },
      };
      const aboveResult = reconcileTime(
        aboveThreshold,
        12 * HOUR,
        BUNDLED_GAME_DEFINITION,
      ).state;
      expect(aboveResult.statuses[status]).toBeDefined();
      expect(
        aboveResult.events.filter(
          (event) => event.type === 'status_recurrence',
        ),
      ).toHaveLength(0);
    }
  });
});

describe('context status behavior through commands', () => {
  test('feeding while Full consumes food, suppresses Food, and can cause Sick', () => {
    const initial = run('streaming', 'status-2');
    const state = {
      ...initial,
      metrics: { ...initial.metrics, food: 9 },
      statuses: { full: { since: 0, source: 'food' } },
    };
    const result = dispatchCommand(
      state,
      {
        type: 'use_item',
        commandId: 'full-feed',
        itemId: 'uncrustables',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.inventory.uncrustables).toBe(0);
    expect(result.metrics.food).toBe(9);
    expect(result.statuses.sick).toBeDefined();
    expect(result.metrics).toMatchObject({ health: 23, mood: 5 });
  });

  test('a Mood-raising Play at Mood 9 can add Overstimulated', () => {
    const initial = run('streaming', 'overstimulated-0');
    const state = {
      ...initial,
      metrics: { ...initial.metrics, food: 10, rest: 10, mood: 9 },
    };
    const result = dispatchCommand(
      state,
      { type: 'play', commandId: 'overstimulated-0', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(result.statuses.overstimulated).toBeDefined();
  });

  test('completed Rest clears Sick and Overstimulated when their authored conditions hold', () => {
    const initial = run('streaming', 'context-clear');
    const result = dispatchCommand(
      {
        ...initial,
        metrics: { ...initial.metrics, food: 5, health: 5, mood: 5, rest: 7 },
        statuses: {
          sick: { since: 0, source: 'acceptance' },
          overstimulated: { since: 0, source: 'acceptance' },
        },
      },
      { type: 'rest', commandId: 'context-clear', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(result.statuses.sick).toBeUndefined();
    expect(result.statuses.overstimulated).toBeUndefined();
  });

  test('invalid attempts do not count toward Annoyance', () => {
    const state = {
      ...run(),
      history: {
        ...run().history,
        annoyanceThreshold: 2,
        careAttemptStreak: 1,
      },
      statuses: { sick: { since: 0, source: 'acceptance' } },
    };
    const attempted = dispatchCommand(
      state,
      {
        type: 'use_item',
        commandId: 'invalid-annoyance',
        itemId: 'missing',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(attempted.statuses.annoyed).toBeUndefined();
    expect(attempted.history.careAttemptStreak).toBe(1);
  });

  test('three sugar servings schedule Sugar Crash, and Rest clears it', () => {
    const initial = run();
    const state = {
      ...initial,
      history: {
        ...initial.history,
        consumptions: [
          {
            at: -HOUR,
            itemId: 'cake',
            salt: 0,
            water: 0,
            protein: 0,
            sugar: 3,
            sugarTagged: true,
          },
          {
            at: -2 * HOUR,
            itemId: 'cake',
            salt: 0,
            water: 0,
            protein: 0,
            sugar: 3,
            sugarTagged: true,
          },
        ],
      },
      inventory: { ...initial.inventory, cake: 1 },
    };
    const fed = dispatchCommand(
      state,
      { type: 'use_item', commandId: 'sugar-feed', itemId: 'cake', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const crashed = reconcileTime(
      fed,
      2 * HOUR + 1,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(crashed.statuses.sugar_crash).toBeDefined();

    const rested = dispatchCommand(
      crashed,
      { type: 'rest', commandId: 'sugar-rest', now: crashed.now },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(rested.statuses.sugar_crash).toBeUndefined();
  });

  test('salt and water history can cause Kidney Stone', () => {
    const initial = run('streaming', 'kidney-0');
    const state = {
      ...initial,
      history: {
        ...initial.history,
        kidneyStoneFeeds: [
          {
            at: -HOUR,
            itemId: 'cake',
            salt: 8,
            water: 2,
            protein: 0,
            sugar: 0,
            sugarTagged: false,
          },
        ],
      },
      inventory: { ...initial.inventory, cake: 1 },
    };
    let result: GameState | undefined;
    for (let index = 0; index < 500 && !result; index += 1) {
      const candidate = dispatchCommand(
        { ...state, seed: `kidney-${index}` },
        {
          type: 'use_item',
          commandId: 'kidney-feed',
          itemId: 'cake',
          now: 0,
        },
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (candidate.statuses.kidney_stone) result = candidate;
    }
    expect(result).toBeDefined();
    expect(result!.statuses.kidney_stone).toBeDefined();
    expect(result!.metrics).toMatchObject({ health: 23, rest: 5, mood: 5 });
  });
});
