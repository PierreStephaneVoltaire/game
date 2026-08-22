import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';
import type { GameState } from './game-types';

function run(seed: string): GameState {
  const state = startRun(
    { mode: 'streaming', now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
  return {
    ...state,
    metrics: { ...state.metrics, food: 10, health: 10, mood: 5, rest: 7 },
    statuses: {},
  };
}

describe('item and history fidelity', () => {
  test('Health zero is terminal even before time advances', () => {
    const initial = run('zero-health');
    const result = dispatchCommand(
      { ...initial, metrics: { ...initial.metrics, health: 0 } },
      { type: 'use_item', commandId: 'after-zero', itemId: 'water', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0]).toMatchObject({ accepted: false, kind: 'dead' });
    expect(result.state.inventory.water).toBe(1);
    expect(result.state.death).not.toBeNull();
  });

  test('direct use cannot bypass an item interaction', () => {
    const state = {
      ...run('direct-interaction'),
      inventory: { 'cat-treats': 1 },
    };
    const result = dispatchCommand(
      state,
      { type: 'use_item', commandId: 'bypass', itemId: 'cat-treats', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(result.outcomes[0].accepted).toBe(false);
    expect(result.state.inventory['cat-treats']).toBe(1);
    expect(
      result.state.events.some((event) => event.type === 'item_used'),
    ).toBe(false);
  });

  test('consume-kind action applies authored tags and consumes through detail action', () => {
    const state = { ...run('consume-action'), inventory: { water: 1 } };
    const result = dispatchCommand(
      state,
      {
        type: 'perform_item_action',
        commandId: 'detail-consume',
        itemId: 'water',
        action: 'consume',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    const event = result.state.events.find((item) => item.type === 'item_used');
    expect(result.outcomes[0].accepted).toBe(true);
    expect(result.state.inventory.water).toBe(0);
    expect(event?.tags).toContain('feeding');
  });

  test('full feeding records Food suppression and distinct causal rule events', () => {
    const state = {
      ...run('full-suppression'),
      inventory: { cake: 1 },
      statuses: { full: { since: 0, source: 'test' } },
    };
    const result = dispatchCommand(
      state,
      { type: 'use_item', commandId: 'full-feed', itemId: 'cake', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    const used = result.state.events.find(
      (event) => event.type === 'item_used',
    );
    const suppressed = result.state.events.find(
      (event) => event.type === 'full_feed_suppressed',
    );
    expect(used?.metricDeltas?.food).toBeUndefined();
    expect(suppressed?.metricDeltas).toEqual({ food: 0 });
    expect(suppressed?.causedBy).toEqual([used?.id]);
    expect(new Set(result.state.events.map((event) => event.id)).size).toBe(
      result.state.events.length,
    );
  });

  test('lethal overfeeding preserves sickness as the canonical cause', () => {
    const initial = run('status-2');
    const result = dispatchCommand(
      {
        ...initial,
        metrics: { ...initial.metrics, food: 9, health: 1 },
        inventory: { uncrustables: 1 },
        statuses: { full: { since: 0, source: 'food' } },
      },
      {
        type: 'use_item',
        commandId: 'full-feed',
        itemId: 'uncrustables',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const sickness = result.events.find(
      (event) => event.type === 'sickness_onset',
    );

    expect(sickness?.metricDeltas?.health).toBe(-1);
    expect(result.death?.cause).toBe(
      'Uncrustables caused sickness from overfeeding.',
    );
    expect(result.death?.eventIds).toContain(sickness?.id);
  });

  test('Mystery Snack records only the selected profile identity', () => {
    const result = dispatchCommand(
      { ...run('mystery-profile'), inventory: { 'mystery-snack': 1 } },
      {
        type: 'use_item',
        commandId: 'mystery-consume',
        itemId: 'mystery-snack',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    const event = result.state.events.find(
      (item) => item.type === 'nutrition_profile_discovered',
    );
    expect(['A', 'B', 'C']).toContain(event?.nutritionProfileId);
    expect(event?.message).not.toMatch(/sodium|calorie|protein|sugar/i);
  });

  test('critical Health penalizes the instant action and random event independently', () => {
    let resolved: GameState | undefined;
    for (let index = 0; index < 2_000 && !resolved; index += 1) {
      const initial = run(`critical-independent-${index}`);
      const state = dispatchCommand(
        {
          ...initial,
          metrics: { ...initial.metrics, food: 5, health: 2, mood: 5 },
          inventory: { uncrustables: 1 },
          statuses: {
            overstimulated: { since: 0, source: 'test' },
          },
        },
        {
          type: 'use_item',
          commandId: `critical-independent-${index}`,
          itemId: 'uncrustables',
          now: 0,
        },
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (state.events.some((event) => event.type === 'creative_inspiration'))
        resolved = state;
    }

    expect(resolved).toBeDefined();
    expect(
      resolved!.events.filter(
        (event) => event.type === 'critical_health_mood_penalty',
      ),
    ).toHaveLength(2);
  });

  test('a treating item clears Sick only at the documented metric thresholds', () => {
    const definition = {
      ...BUNDLED_GAME_DEFINITION,
      items: BUNDLED_GAME_DEFINITION.items.map((item) =>
        item.id === 'socks-plushie'
          ? {
              ...item,
              itemActions: item.itemActions?.map((action) => ({
                ...action,
                clearsStatuses: ['sick' as const],
                tags: ['calming'],
              })),
            }
          : item,
      ),
    };
    const attempt = (health: number, commandId: string) =>
      dispatchCommand(
        {
          ...run(commandId),
          metrics: { ...run(commandId).metrics, food: 5, health },
          inventory: { 'socks-plushie': 1 },
          statuses: { sick: { since: 0, source: 'test' } },
        },
        {
          type: 'perform_item_action',
          commandId,
          itemId: 'socks-plushie',
          action: 'offer_plushie_apology',
          now: 0,
        },
        definition,
      ).state;

    expect(attempt(4, 'treatment-too-early').statuses.sick).toBeDefined();
    expect(attempt(5, 'treatment-eligible').statuses.sick).toBeUndefined();
  });
});
