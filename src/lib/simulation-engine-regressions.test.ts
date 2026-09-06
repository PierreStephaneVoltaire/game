import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { resolveAttemptEvent } from './event-rules';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';

const HOUR = 3_600_000;
const atStart = () =>
  startRun(
    { mode: 'streaming', now: 0, seed: 'regression-seed', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );

describe('simulation command receipts', () => {
  test('replaying an old command returns the current state, never an old snapshot', () => {
    const initial = atStart();
    const command = {
      type: 'wait' as const,
      commandId: 'wait-once',
      now: initial.now,
    };
    const first = dispatchCommand(initial, command, BUNDLED_GAME_DEFINITION);
    const later = dispatchCommand(
      first.state,
      {
        type: 'wait',
        commandId: 'wait-later',
        now: first.state.now,
      },
      BUNDLED_GAME_DEFINITION,
    );
    const replay = dispatchCommand(
      later.state,
      command,
      BUNDLED_GAME_DEFINITION,
    );

    expect(replay.state).toBe(later.state);
    expect(replay.outcomes).toEqual(first.outcomes);
  });

  test('rejects an optimistic-concurrency command as stale', () => {
    const initial = atStart();
    const result = dispatchCommand(
      initial,
      {
        type: 'use_item',
        itemId: 'uncrustables',
        commandId: 'stale-feed',
        now: 0,
        expectedStateVersion: 99,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'stale',
    });
    expect(result.state.inventory.uncrustables).toBe(1);
  });
});

describe('room and item action commands', () => {
  test('places and unplaces an authored room item without losing ownership', () => {
    const initial = atStart();
    const item = BUNDLED_GAME_DEFINITION.items.find(
      (candidate) => candidate.roomSlot && !candidate.edible,
    );
    expect(item).toBeDefined();
    const owned = {
      ...initial,
      inventory: { ...initial.inventory, [item!.id]: 1 },
    };
    const placed = dispatchCommand(
      owned,
      {
        type: 'place_item',
        itemId: item!.id,
        slot: item!.roomSlot!,
        commandId: 'place-one',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    const removed = dispatchCommand(
      placed.state,
      {
        type: 'unplace_item',
        slot: item!.roomSlot!,
        commandId: 'unplace-one',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(placed.outcomes[0].accepted).toBe(true);
    expect(placed.outcomes[0].message).toBe(
      `Placed ${item!.name} in the room.`,
    );
    expect(removed.outcomes[0].accepted).toBe(true);
    expect(removed.state.inventory[item!.id]).toBe(1);
    expect(removed.state.room[item!.roomSlot!]).toBeUndefined();
  });

  test('performs a declared item action through the public command seam', () => {
    const initial = atStart();
    const item = BUNDLED_GAME_DEFINITION.items.find((candidate) =>
      candidate.itemActions?.some(
        (action) =>
          (typeof action === 'string' ? action : action.id) !== 'consume',
      ),
    );
    expect(item).toBeDefined();
    const owned = {
      ...initial,
      inventory: { ...initial.inventory, [item!.id]: 1 },
    };
    const action = item!.itemActions!.find(
      (value) => (typeof value === 'string' ? value : value.id) !== 'consume',
    );
    const actionId = typeof action === 'string' ? action : action!.id;
    const result = dispatchCommand(
      owned,
      {
        type: 'perform_item_action',
        itemId: item!.id,
        action: actionId,
        commandId: 'item-action-one',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0].accepted).toBe(true);
    expect(
      result.state.events.some((event) => event.type === 'item_used'),
    ).toBe(true);
  });

  test('every actual data-authored Bond gain resets the decay clock', () => {
    const now = 10 * HOUR;
    const initial = {
      ...atStart(),
      now,
      lastResolvedAt: now,
      history: { ...atStart().history, lastBondGainAt: 0 },
    };

    const feedingState = {
      ...initial,
      history: {
        ...initial.history,
        lastBondGainAt: 0,
        cravingItemId: 'uncrustables',
      },
    };
    const feeding = dispatchCommand(
      feedingState,
      {
        type: 'use_item',
        itemId: 'uncrustables',
        commandId: 'bond-craving-feed',
        now,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(feeding.metrics.bond).toBeGreaterThan(feedingState.metrics.bond);
    expect(feeding.history.lastBondGainAt).toBe(now);

    const actionState = {
      ...initial,
      inventory: { ...initial.inventory, 'cat-treats': 1 },
    };
    const action = dispatchCommand(
      actionState,
      {
        type: 'perform_item_action',
        itemId: 'cat-treats',
        action: 'give_cat_treat',
        commandId: 'bond-item-action',
        now,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(action.metrics.bond).toBeGreaterThan(actionState.metrics.bond);
    expect(action.history.lastBondGainAt).toBe(now);

    const placementState = {
      ...initial,
      inventory: { ...initial.inventory, 'automatic-feeder': 1 },
    };
    const placement = dispatchCommand(
      placementState,
      {
        type: 'place_item',
        itemId: 'automatic-feeder',
        slot: 'cat-corner',
        commandId: 'bond-room-placement',
        now,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(placement.metrics.bond).toBeGreaterThan(placementState.metrics.bond);
    expect(placement.history.lastBondGainAt).toBe(now);
  });

  test('an automatic item event that raises Bond resets the decay clock', () => {
    const now = 10 * HOUR;
    const definition = structuredClone(BUNDLED_GAME_DEFINITION);
    const item = definition.items.find((candidate) => candidate.id === 'water');
    expect(item).toBeDefined();
    item!.automaticEventHooks = [
      {
        id: 'bond_event',
        weight: 1_000_000,
        message: 'A shared moment strengthened the bond.',
        eligibility: 'owned',
        effects: { bond: { min: 1, max: 1 } },
      },
    ];

    let resolved;
    for (let index = 0; index < 20 && !resolved; index += 1) {
      const initial = atStart();
      const state = {
        ...initial,
        seed: `bond-event-${index}`,
        now,
        lastResolvedAt: now,
        history: { ...initial.history, lastBondGainAt: 0 },
      };
      const candidate = resolveAttemptEvent(state, 'bond-event', definition);
      if (
        candidate.events.some(
          (event) => event.cause === 'item_hook:water:bond_event',
        )
      )
        resolved = candidate;
    }

    expect(resolved).toBeDefined();
    expect(resolved!.metrics.bond).toBeGreaterThan(atStart().metrics.bond);
    expect(resolved!.history.lastBondGainAt).toBe(now);
  });
});

describe('chronological terminal boundaries', () => {
  test('non-boundary polling preserves seeded state and event history', () => {
    const initial = atStart();
    const oneShot = reconcileTime(initial, 4 * HOUR, BUNDLED_GAME_DEFINITION);
    const polled = reconcileTime(
      reconcileTime(
        reconcileTime(initial, 1 * HOUR, BUNDLED_GAME_DEFINITION).state,
        2 * HOUR,
        BUNDLED_GAME_DEFINITION,
      ).state,
      4 * HOUR,
      BUNDLED_GAME_DEFINITION,
    );
    expect(polled.state.metrics).toEqual(oneShot.state.metrics);
    expect(polled.state.statuses).toEqual(oneShot.state.statuses);
    expect(polled.state.stateVersion).toBe(oneShot.state.stateVersion);
    expect(polled.state.events).toEqual(oneShot.state.events);
  });

  test('stops at the first lethal decay boundary instead of advancing to target time', () => {
    const initial = atStart();
    const nearDeath = {
      ...initial,
      metrics: { ...initial.metrics, health: 1, food: 0, rest: 5, mood: 5 },
      history: { ...initial.history, pendingFoodDecayHit: true },
    };
    const result = reconcileTime(nearDeath, 24 * HOUR, BUNDLED_GAME_DEFINITION);

    expect(result.state.ending?.kind).toBe('death');
    expect(result.state.now).toBe(2 * HOUR);
    expect(result.state.lastResolvedAt).toBe(result.state.now);
  });
});
