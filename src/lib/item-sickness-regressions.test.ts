import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { dispatchCommand, startRun } from './game-engine';
import type { GameState } from './game-types';

function state(seed: string, itemId: string): GameState {
  const initial = startRun(
    { mode: 'streaming', now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
  return {
    ...initial,
    inventory: { [itemId]: 1 },
    metrics: { ...initial.metrics, food: 3, health: 10, mood: 5 },
    statuses: {},
  };
}

function feed(initial: GameState, itemId: string) {
  return dispatchCommand(
    initial,
    { type: 'use_item', commandId: 'feed', itemId, now: 0 },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('Sick feeding and Water effects', () => {
  test('Water immediately adds one Food and one Health', () => {
    const result = feed(state('water-effects', 'water'), 'water');

    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'item_used',
    });
    expect(result.state.metrics).toMatchObject({ food: 4, health: 11 });
  });

  test('Full suppresses Water Food but preserves its Health effect', () => {
    const initial = state('full-water-0', 'water');
    const result = feed(
      {
        ...initial,
        metrics: { ...initial.metrics, food: 9 },
        statuses: { full: { since: 0, source: 'test' } },
      },
      'water',
    );

    expect(result.outcomes[0].accepted).toBe(true);
    expect(result.state.metrics).toMatchObject({ food: 9, health: 11 });
    expect(result.state.statuses.sick).toBeUndefined();
  });

  test.each([
    ['water', 'sick-refusal-water-0'],
    ['goldfish', 'sick-refusal-goldfish-6'],
  ])('Sick adds 25 refusal points independently for %s', (itemId, seed) => {
    const normal = feed(state(seed, itemId), itemId);
    const sick = feed(
      {
        ...state(seed, itemId),
        statuses: { sick: { since: 0, source: 'test' } },
      },
      itemId,
    );

    expect(normal.outcomes[0].accepted).toBe(true);
    expect(sick.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'refused',
    });
  });

  test('an accepted Water while Sick keeps its normal effects without damage', () => {
    const initial = state('sick-accept-1', 'water');
    const result = feed(
      {
        ...initial,
        statuses: { sick: { since: 0, source: 'test' } },
      },
      'water',
    );

    expect(result.outcomes[0].accepted).toBe(true);
    expect(result.state.metrics).toMatchObject({
      food: 4,
      health: 11,
      mood: 5,
    });
    expect(
      result.state.events.some((event) => event.type === 'sick_feeding_harm'),
    ).toBe(false);
  });
});
