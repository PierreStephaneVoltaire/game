import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { GameController } from './game-controller';
import { dispatchCommand, startRun } from './game-engine';
import { actionRandom } from './seeded-rng';
import { rotateShop } from './shop-rules';
import rules from './data/simulation-rules.json';
import { createGameViewModel } from './ui/game-view-model';

describe('GameController', () => {
  test('loads definitions behind the controller seam', async () => {
    let loads = 0;
    const controller = new GameController({
      async load() {
        loads += 1;
        return BUNDLED_GAME_DEFINITION;
      },
    });
    const state = await controller.start({
      mode: 'streaming',
      seed: 'controller-seed',
      now: 0,
      timezone: 'UTC',
    });
    expect(state.definitionVersion).toBe(BUNDLED_GAME_DEFINITION.version);
    expect(
      (await controller.dispatch({ type: 'wait', commandId: 'wait', now: 0 }))
        .outcomes[0].accepted,
    ).toBe(true);
    await controller.reconcile(controller.current!.now);
    expect(loads).toBe(1);
  });

  test('maps catalogue presentation from the repository-loaded definition', () => {
    const definition = {
      ...BUNDLED_GAME_DEFINITION,
      items: BUNDLED_GAME_DEFINITION.items.map((item) =>
        item.id === 'water' ? { ...item, name: 'Repository Water' } : item,
      ),
    };
    const state = startRun(
      { mode: 'streaming', now: 0, seed: 'view-definition', timezone: 'UTC' },
      definition,
    );

    expect(
      createGameViewModel(state, definition).catalogue.find(
        (item) => item.id === 'water',
      )?.name,
    ).toBe('Repository Water');
  });
});

describe('deterministic keyed rules', () => {
  test('uses the configured annoyance-threshold bounds', () => {
    const original = { ...rules.annoyance };
    try {
      rules.annoyance.min = 7;
      rules.annoyance.max = 7;
      const run = startRun(
        { mode: 'streaming', now: 0, seed: 'annoyance', timezone: 'UTC' },
        BUNDLED_GAME_DEFINITION,
      );
      expect(run.history.annoyanceThreshold).toBe(7);
    } finally {
      Object.assign(rules.annoyance, original);
    }
  });

  test('separate roll ids do not reuse one random outcome', () => {
    expect(actionRandom('seed', 4, 'command', 'scope', 'first')).not.toBe(
      actionRandom('seed', 4, 'command', 'scope', 'second'),
    );
  });

  test('shop rotation is deterministic and has 24 entries', () => {
    const run = startRun(
      { mode: 'streaming', now: 0, seed: 'shop-seed', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const first = rotateShop(run, BUNDLED_GAME_DEFINITION, '2026-08-21');
    expect(first.itemIds).toHaveLength(24);
    expect(first).toEqual(
      rotateShop(run, BUNDLED_GAME_DEFINITION, '2026-08-21'),
    );
  });

  test('wait is deterministic through the public seam', () => {
    const run = startRun(
      { mode: 'streaming', now: 0, seed: 'wait-seed', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const command = { type: 'wait' as const, commandId: 'wait', now: 0 };
    expect(
      dispatchCommand(run, command, BUNDLED_GAME_DEFINITION).outcomes,
    ).toEqual(
      dispatchCommand(
        startRun(
          { mode: 'streaming', now: 0, seed: 'wait-seed', timezone: 'UTC' },
          BUNDLED_GAME_DEFINITION,
        ),
        command,
        BUNDLED_GAME_DEFINITION,
      ).outcomes,
    );
  });
});
