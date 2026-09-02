import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameState } from './game-types';
import { eventCandidates } from './event-candidate-pool';

const HOUR = 3_600_000;
const AUTONOMOUS_TYPES = new Set([
  'low_money_stress',
  'food_craving',
  'creative_inspiration',
  'socks',
  'benign_room_event',
  'stream_candidate',
  'item_automatic_hook',
]);

function autoEvents(state: GameState) {
  return state.events.filter((event) => AUTONOMOUS_TYPES.has(event.type));
}

function opportunityEvents(state: GameState) {
  return state.events.filter(
    (event) => event.type === 'random_event_opportunity',
  );
}

function run(mode: 'realtime' | 'streaming', seed: string) {
  const state = startRun(
    { mode, now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
  return {
    ...state,
    metrics: { ...state.metrics, food: 10, health: 10, mood: 5, rest: 7 },
    statuses: { sick: { since: 0, source: 'acceptance' } },
  } as GameState;
}

function findSeed(build: (state: GameState, seed: string) => GameState): {
  state: GameState;
  seed: string;
} {
  for (let index = 0; index < 2_000; index += 1) {
    const seed = `opportunity-${index}`;
    const state = build(run('streaming', seed), seed);
    if (autoEvents(state).length === 1) return { state, seed };
  }
  throw new Error('No deterministic seed produced an autonomous event.');
}

describe('one event opportunity per companion attempt', () => {
  test('accepted instant use, refused Rest, invalid, blocked, and stale attempts each roll once', () => {
    const accepted = findSeed(
      (state, seed) =>
        dispatchCommand(
          state,
          {
            type: 'use_item',
            commandId: `accepted-${seed}`,
            itemId: 'water',
            now: 0,
          },
          BUNDLED_GAME_DEFINITION,
        ).state,
    );
    expect(autoEvents(accepted.state)).toHaveLength(1);
    expect(opportunityEvents(accepted.state)).toHaveLength(1);

    const refused = findSeed(
      (state, seed) =>
        dispatchCommand(
          { ...state, metrics: { ...state.metrics, rest: 10 } },
          { type: 'rest', commandId: `refused-${seed}`, now: 0 },
          BUNDLED_GAME_DEFINITION,
        ).state,
    );
    expect(autoEvents(refused.state)).toHaveLength(1);
    expect(opportunityEvents(refused.state)).toHaveLength(1);

    const invalid = findSeed(
      (state, seed) =>
        dispatchCommand(
          state,
          {
            type: 'use_item',
            commandId: `invalid-${seed}`,
            itemId: 'missing',
            now: 0,
          },
          BUNDLED_GAME_DEFINITION,
        ).state,
    );
    expect(autoEvents(invalid.state)).toHaveLength(1);
    expect(opportunityEvents(invalid.state)).toHaveLength(1);

    const blocked = findSeed(
      (state, seed) =>
        dispatchCommand(
          {
            ...state,
            mode: 'realtime',
            activity: {
              id: 'busy',
              type: 'rest',
              startedAt: 0,
              endsAt: 24 * HOUR,
              sourceActionId: 'busy',
            },
          },
          {
            type: 'use_item',
            commandId: `blocked-${seed}`,
            itemId: 'water',
            now: 0,
          },
          BUNDLED_GAME_DEFINITION,
        ).state,
    );
    expect(autoEvents(blocked.state)).toHaveLength(1);
    expect(opportunityEvents(blocked.state)).toHaveLength(1);

    const stale = findSeed(
      (state, seed) =>
        dispatchCommand(
          state,
          {
            type: 'use_item',
            commandId: `stale-${seed}`,
            itemId: 'water',
            now: 0,
            expectedStateVersion: state.stateVersion + 100,
          },
          BUNDLED_GAME_DEFINITION,
        ).state,
    );
    expect(autoEvents(stale.state)).toHaveLength(1);
    expect(opportunityEvents(stale.state)).toHaveLength(1);
  });

  test('a newly accepted timed attempt defers its one opportunity until completion', () => {
    let selected:
      | { started: ReturnType<typeof dispatchCommand>; completed: GameState }
      | undefined;
    for (let index = 0; index < 2_000 && !selected; index += 1) {
      const seed = `timed-opportunity-${index}`;
      const state = run('realtime', seed);
      const started = dispatchCommand(
        state,
        { type: 'rest', commandId: `timed-${seed}`, now: 0 },
        BUNDLED_GAME_DEFINITION,
      );
      if (!started.state.activity || autoEvents(started.state).length !== 0)
        continue;
      const completed = reconcileTime(
        started.state,
        started.state.activity.endsAt + 1,
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (autoEvents(completed).length === 1) selected = { started, completed };
    }
    expect(selected).toBeDefined();
    expect(autoEvents(selected!.started.state)).toHaveLength(0);
    expect(autoEvents(selected!.completed)).toHaveLength(1);
  });
});

describe('commands without companion attempts', () => {
  test('shop, Wait, and Medical Care do not roll an autonomous opportunity', () => {
    const shop = run('streaming', 'shop-without-opportunity');
    const affordable = shop.shop.itemIds.find(
      (id) =>
        (shop.shop.stock[id] ?? 0) > 0 &&
        (BUNDLED_GAME_DEFINITION.items.find((item) => item.id === id)?.price ??
          Infinity) <= shop.balance,
    )!;
    const bought = dispatchCommand(
      shop,
      {
        type: 'buy_item',
        commandId: 'buy-without-opportunity',
        itemId: affordable,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(autoEvents(bought)).toHaveLength(0);

    const waited = dispatchCommand(
      run('streaming', 'wait-without-opportunity'),
      { type: 'wait', commandId: 'wait-without-opportunity', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(autoEvents(waited)).toHaveLength(0);

    const careState = {
      ...run('streaming', 'medical-without-opportunity'),
      metrics: {
        food: 10,
        health: 10,
        mood: 10,
        rest: 10,
        bond: 10,
        creativity: 10,
      },
      statuses: { kidney_stone: { since: 0, source: 'acceptance' } },
    } as GameState;
    const cared = dispatchCommand(
      careState,
      {
        type: 'medical_care',
        commandId: 'medical-without-opportunity',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(autoEvents(cared)).toHaveLength(1);
  });
});

describe('automatic event candidate availability', () => {
  test('does not create a craving for a sold-out shop item', () => {
    const base = run('streaming', 'sold-out-craving');
    const state: GameState = {
      ...base,
      inventory: {},
      shop: {
        ...base.shop,
        itemIds: ['uncrustables'],
        stock: { uncrustables: 0 },
      },
    };

    expect(
      eventCandidates(state, BUNDLED_GAME_DEFINITION, '1970-01-01', 0).find(
        ({ type }) => type === 'food_craving',
      )?.weight,
    ).toBe(0);
  });

  test('keeps owned-item hooks eligible while that durable is placed', () => {
    const definition = {
      ...BUNDLED_GAME_DEFINITION,
      items: BUNDLED_GAME_DEFINITION.items.map((item) =>
        item.id === 'catnip' ? { ...item, roomSlot: 'shelf' } : item,
      ),
    };
    const base = run('streaming', 'placed-owned-hook');
    const state: GameState = {
      ...base,
      inventory: {},
      room: { shelf: 'catnip' },
    };

    expect(
      eventCandidates(state, definition, '1970-01-01', 0).find(
        ({ type }) => type === 'item_hook:catnip:catnip_event',
      )?.weight,
    ).toBe(7);
  });
});
