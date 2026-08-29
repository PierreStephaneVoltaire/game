import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from '../game-definition';
import { dispatchCommand, startRun } from '../game-engine';
import type { GameState } from '../game-types';

function run(seed = 'batch-feeding'): GameState {
  return {
    ...startRun(
      { mode: 'streaming', now: 0, seed, timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    ),
    inventory: { water: 2, pretzel: 1 },
  };
}

function withoutBatchReceipt(state: GameState, commandId: string): GameState {
  const processedCommands = { ...state.processedCommands };
  delete processedCommands[commandId];
  return {
    ...state,
    stateVersion: state.stateVersion - 1,
    events: state.events.slice(0, -1),
    processedCommands,
  };
}

describe('batch feeding', () => {
  test('uses the same deterministic per-unit resolution as sequential feeds', () => {
    const commandId = 'feed-a-selection';
    const initial = run();
    const batch = dispatchCommand(
      initial,
      {
        type: 'feed_items',
        commandId,
        now: 0,
        items: [
          { itemId: 'water', quantity: 2 },
          { itemId: 'pretzel', quantity: 1 },
        ],
      },
      BUNDLED_GAME_DEFINITION,
    );

    let sequential = initial;
    for (const [itemId, quantity] of [
      ['pretzel', 1],
      ['water', 2],
    ] as const)
      for (let unit = 1; unit <= quantity; unit += 1)
        sequential = dispatchCommand(
          sequential,
          {
            type: 'use_item',
            commandId: `${commandId}:feed:${itemId}:${unit}`,
            itemId,
            now: sequential.now,
          },
          BUNDLED_GAME_DEFINITION,
        ).state;

    expect(batch.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'items_fed',
    });
    expect(withoutBatchReceipt(batch.state, commandId)).toEqual(sequential);
    expect(batch.state.inventory).toMatchObject({ water: 0, pretzel: 0 });
  });

  test('applies available units before reporting an exhausted selection', () => {
    const result = dispatchCommand(
      run('batch-insufficient'),
      {
        type: 'feed_items',
        commandId: 'too-much-water',
        now: 0,
        items: [{ itemId: 'water', quantity: 3 }],
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'items_fed',
    });
    expect(result.state.inventory.water).toBe(0);
    expect(
      result.state.processedCommands['too-much-water:feed:water:3']?.outcome,
    ).toMatchObject({ accepted: false, kind: 'unavailable' });
  });
});
