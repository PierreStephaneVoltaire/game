import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { validateCatalog } from './catalog-validation';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';

describe('startRun', () => {
  test('ships the complete canonical catalogue definition', () => {
    expect(validateCatalog(BUNDLED_GAME_DEFINITION, true)).toEqual([]);
  });

  test('starts the agreed session-only Realtime state', () => {
    const state = startRun(
      {
        mode: 'realtime',
        now: Date.UTC(2026, 7, 21, 14),
        seed: 'realtime-seed',
        timezone: 'America/Toronto',
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(state).toMatchObject({
      mode: 'realtime',
      seed: 'realtime-seed',
      timezone: 'America/Toronto',
      stateVersion: 1,
      metrics: BUNDLED_GAME_DEFINITION.startingMetrics,
      balance: BUNDLED_GAME_DEFINITION.startingCurrency,
      inventory: BUNDLED_GAME_DEFINITION.startingInventory,
      room: {},
      statuses: {},
      activity: null,
      ending: null,
    });
    expect(state.events[0]).toMatchObject({
      type: 'run_started',
      at: Date.UTC(2026, 7, 21, 14),
    });
  });
});

describe('reconcileTime', () => {
  test('applies post-rest awake decay after the activity boundary', () => {
    const started = startRun(
      { mode: 'realtime', now: 0, seed: 'rest-boundary', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const withRest = {
      ...started,
      activity: {
        id: 'activity-1',
        type: 'rest' as const,
        startedAt: 0,
        endsAt: 60 * 60 * 1_000,
        sourceActionId: 'rest-1',
      },
    };

    const afterThreeHours = reconcileTime(
      withRest,
      3 * 60 * 60 * 1_000,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(afterThreeHours.metrics).toMatchObject({ food: 5, rest: 7 });
    expect(afterThreeHours.activity).toBeNull();
  });

  test('derives seeded Food opportunities and awake-Rest decay from timestamps', () => {
    const startedAt = Date.UTC(2026, 7, 21, 14);
    const initial = startRun(
      {
        mode: 'realtime',
        now: startedAt,
        seed: 'decay-example',
        timezone: 'America/Toronto',
      },
      BUNDLED_GAME_DEFINITION,
    );

    const afterThreeHours = reconcileTime(
      initial,
      startedAt + 3 * 60 * 60 * 1_000,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const afterFourHours = reconcileTime(
      afterThreeHours,
      startedAt + 4 * 60 * 60 * 1_000,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(afterThreeHours.metrics).toMatchObject({ food: 6, rest: 6 });
    expect(afterFourHours.metrics).toMatchObject({ food: 6, rest: 5 });
    expect(afterFourHours.statuses.hungry).toBeUndefined();
    expect(afterFourHours.lastResolvedAt).toBe(startedAt + 4 * 60 * 60 * 1_000);
  });

  test('halves Food decay probability while Rest is active', () => {
    const initial = startRun(
      { mode: 'realtime', now: 0, seed: 'rest-half-3', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const awake = reconcileTime(
      initial,
      2 * 60 * 60 * 1_000,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const resting = reconcileTime(
      {
        ...initial,
        activity: {
          id: 'activity-rest',
          type: 'rest',
          startedAt: 0,
          endsAt: 4 * 60 * 60 * 1_000,
          sourceActionId: 'rest',
        },
      },
      2 * 60 * 60 * 1_000,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(awake.metrics.food).toBe(5);
    expect(resting.metrics.food).toBe(6);
  });

  test('applies critical-need Health loss at each two-hour boundary', () => {
    const started = startRun(
      { mode: 'streaming', now: 0, seed: 'critical-cadence', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const criticalFood = {
      ...started,
      metrics: { ...started.metrics, food: 2, rest: 5, mood: 5 },
    };

    const afterFourHours = reconcileTime(
      criticalFood,
      4 * 3_600_000,
      BUNDLED_GAME_DEFINITION,
    ).state;

    // This seed misses both Food decay opportunities at the reduced 65% rate.
    expect(afterFourHours.metrics).toMatchObject({ food: 2, health: 24 });
  });

  test('records the terminal Health-loss event as the causal death chain', () => {
    const started = startRun(
      { mode: 'streaming', now: 0, seed: 'death-chain', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const nearDeath = {
      ...started,
      metrics: { ...started.metrics, health: 1, food: 0, rest: 5, mood: 5 },
      history: { ...started.history, pendingFoodDecayHit: true },
    };

    const result = reconcileTime(
      nearDeath,
      2 * 3_600_000,
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.state.ending?.kind).toBe('death');
    expect(result.state.ending?.causes).toEqual([
      expect.objectContaining({ name: 'Starvation' }),
    ]);
    expect(result.state.events.at(-1)).toMatchObject({ type: 'death' });
    expect(result.state.ending?.eventIds).toContain(
      result.state.events.at(-1)?.id,
    );
  });
});

describe('dispatchCommand', () => {
  test('resolves a Streaming Wait with an independently seeded 1–12 hour duration', () => {
    const started = startRun(
      { mode: 'streaming', now: 0, seed: 'wait-seed', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );

    const result = dispatchCommand(
      started,
      { type: 'wait', commandId: 'wait-1', now: started.now },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'waited',
      message: 'Time advanced 7 hours.',
    });
    expect(result.state.now).toBe(7 * 3_600_000);
  });

  test('uses a starting food item once and replays command ids idempotently', () => {
    const initial = startRun(
      {
        mode: 'streaming',
        now: Date.UTC(2026, 7, 21, 14),
        seed: 'item-seed',
        timezone: 'America/Toronto',
      },
      BUNDLED_GAME_DEFINITION,
    );
    const command = {
      type: 'use_item' as const,
      commandId: 'feed-1',
      itemId: 'uncrustables',
      now: initial.now,
    };
    const first = dispatchCommand(initial, command, BUNDLED_GAME_DEFINITION);
    const replay = dispatchCommand(
      first.state,
      command,
      BUNDLED_GAME_DEFINITION,
    );

    expect(first.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'item_used',
    });
    expect(first.state.inventory.uncrustables).toBe(0);
    expect(replay.outcomes).toEqual(first.outcomes);
    expect(replay.state.stateVersion).toBe(first.state.stateVersion);
  });

  test('consumes food while full, suppresses Food, and seeds sickness risk', () => {
    const started = startRun(
      { mode: 'streaming', now: 0, seed: 'full-1', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const full = {
      ...started,
      metrics: { ...started.metrics, food: 9 },
      statuses: { full: { since: 0, source: 'food' } },
    };

    const result = dispatchCommand(
      full,
      {
        type: 'use_item',
        commandId: 'full-feed',
        itemId: 'uncrustables',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.state.inventory.uncrustables).toBe(0);
    expect(result.state.metrics.food).toBe(9);
    expect(result.state.statuses.sick).toMatchObject({ source: 'feeding' });
    expect(result.state.metrics).toMatchObject({ health: 23, mood: 5 });
  });

  test('uses an owned care consumable through the same item command seam', () => {
    const started = startRun(
      { mode: 'streaming', now: 0, seed: 'care-item', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const withCare = {
      ...started,
      inventory: { ...started.inventory, 'salt-tablet': 1 },
    };

    const result = dispatchCommand(
      withCare,
      {
        type: 'use_item',
        commandId: 'take-care-1',
        itemId: 'salt-tablet',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'item_used',
    });
    expect(result.state.inventory['salt-tablet']).toBe(0);
  });
});
