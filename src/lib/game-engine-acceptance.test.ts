import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameMode, GameState } from './game-types';

const HOUR = 3_600_000;

function run(mode: GameMode = 'streaming', seed = 'acceptance-seed') {
  return startRun(
    { mode, now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

function comparableTimeline(state: GameState) {
  return {
    now: state.now,
    lastResolvedAt: state.lastResolvedAt,
    metrics: state.metrics,
    statuses: state.statuses,
    balance: state.balance,
    inventory: state.inventory,
    shop: state.shop,
    activity: state.activity,
    history: state.history,
    endingRisks: state.endingRisks,
    ending: state.ending,
    events: state.events.slice(1),
  };
}

describe('clock-mode public seam', () => {
  test('Realtime reconciliation and Streaming elapsed time resolve equivalently', () => {
    const realtime = reconcileTime(
      run('realtime', 'equivalent-time'),
      6 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const streaming = reconcileTime(
      run('streaming', 'equivalent-time'),
      6 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(comparableTimeline(realtime)).toEqual(comparableTimeline(streaming));
  });

  test('a timed attempt and its autonomous event resolve identically in both modes', () => {
    const command = {
      type: 'socialize' as const,
      commandId: 'equivalent-socialize',
      now: 0,
    };
    const streaming = dispatchCommand(
      run('streaming', 'equivalent-socialize'),
      command,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const realtimeStarted = dispatchCommand(
      run('realtime', 'equivalent-socialize'),
      command,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const realtime = reconcileTime(
      realtimeStarted,
      streaming.now,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(comparableTimeline(realtime)).toEqual(comparableTimeline(streaming));
  });

  test('reconciling the same target twice is idempotent', () => {
    const first = reconcileTime(
      run(),
      3.5 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const second = reconcileTime(
      first,
      3.5 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(second).toBe(first);
  });
});

describe('daily shop and economy public seam', () => {
  test('starts with the exact rotation mix, stock limits, and both guarantees', () => {
    const state = run();
    const items = state.shop.itemIds.map((id) =>
      BUNDLED_GAME_DEFINITION.items.find((item) => item.id === id),
    );

    expect(items).not.toContain(undefined);
    expect(items).toHaveLength(24);
    expect(items.filter((item) => item?.category === 'food')).toHaveLength(12);
    expect(
      items.filter(
        (item) => item?.category === 'medicine' || item?.category === 'care',
      ),
    ).toHaveLength(2);
    expect(items.filter((item) => item?.category === 'reusable')).toHaveLength(
      4,
    );
    expect(items.filter((item) => item?.category === 'upgrade')).toHaveLength(
      3,
    );
    expect(
      items.filter((item) => item?.category === 'decoration'),
    ).toHaveLength(3);
    expect(
      items.some((item) => item?.edible && item.price <= state.balance),
    ).toBe(true);
    expect(
      items.some(
        (item) =>
          item?.edible &&
          (item.tags.includes('hydrating') ||
            (item.properties?.water ?? 0) >= 2),
      ),
    ).toBe(true);
    expect(
      Object.values(state.shop.stock).every(
        (stock) => stock >= 1 && stock <= 5,
      ),
    ).toBe(true);
  });

  test('blocks duplicate durable ownership', () => {
    const initial = run();
    const durable = initial.shop.itemIds
      .map((id) => BUNDLED_GAME_DEFINITION.items.find((item) => item.id === id))
      .find((item) => item?.consumable === false && !item.supportsQuantity);
    expect(durable).toBeDefined();
    const owned = {
      ...initial,
      balance: 1_000,
      inventory: { ...initial.inventory, [durable!.id]: 1 },
    };
    const duplicate = dispatchCommand(
      owned,
      {
        type: 'buy_item',
        commandId: 'duplicate-durable',
        itemId: durable!.id,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(duplicate.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'duplicate',
    });
  });
});

describe('Medical Care and terminal state', () => {
  test('creates medical debt, completes immediately in Streaming mode, and clears kidney stone', () => {
    const initial = run();
    const kidneyStone = {
      ...initial,
      metrics: {
        food: 10,
        health: 10,
        mood: 10,
        rest: 10,
        bond: 10,
        creativity: 10,
      },
      statuses: {
        kidney_stone: { since: 0, source: 'rolling_nutrition' },
      },
    };
    const result = dispatchCommand(
      kidneyStone,
      { type: 'medical_care', commandId: 'medical', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0]).toMatchObject({ accepted: true });
    expect(result.state.balance).toBeGreaterThanOrEqual(20);
    expect(result.state.medicalDebt).toEqual([
      expect.objectContaining({
        originalPrincipal: 10_000,
        remainingPrincipal: 10_000,
      }),
    ]);
    expect(result.state.now).toBe(12 * HOUR);
    expect(result.state.activity).toBeNull();
    expect(result.state.statuses.kidney_stone).toBeUndefined();
  });

  test('keeps Realtime Medical Care active and rejects all post-ending mutation', () => {
    const initial = run('realtime');
    const care = dispatchCommand(
      {
        ...initial,
        statuses: {
          kidney_stone: { since: 0, source: 'rolling_nutrition' },
        },
      },
      { type: 'medical_care', commandId: 'medical-realtime', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(care.state.activity?.type).toBe('medical_care');

    const ended = {
      ...initial,
      ending: {
        kind: 'death' as const,
        at: 0,
        cause: 'Cause',
        eventIds: [],
      },
    };
    const rejected = dispatchCommand(
      ended,
      { type: 'wait', commandId: 'after-death', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(rejected.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'run_over',
    });
    expect(rejected.state).toBe(ended);
  });
});
