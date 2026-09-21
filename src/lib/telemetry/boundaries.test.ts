import { expect, test, vi } from 'vitest';
import { GameController } from '../game-controller';
import type { GameCommand, GameState } from '../game-types';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { createGameViewModel } from '../ui/game-view-model';
import { graveyardExportMarkdown } from '../ui/graveyard-export';
import { GameplayCapture, type Operation } from './capture';
import { applyChanges } from './state-changes';
import { flushGame } from '../persistence/sync';
import type { OutboxRecord } from '../persistence/types';

const saving = vi.hoisted(() => ({
  next: vi.fn(),
  acknowledge: vi.fn(),
  retry: vi.fn(),
}));
vi.mock('../persistence/outbox', () => ({
  nextOutbox: saving.next,
  acknowledge: saving.acknowledge,
  noteRetry: saving.retry,
}));

test('reconstructs room use, hospital completion, debt payoff, and the unchanged graveyard export', async () => {
  const operations: Operation[] = [];
  const repository = { load: async () => definition };
  const logged = new GameController(
    repository,
    new GameplayCapture((operation) => operations.push(operation)),
  );
  const plain = new GameController(repository);
  const initial = await plain.start({
    mode: 'streaming',
    now: 1_800_000_000_000,
    seed: '00421873',
    timezone: 'UTC',
  });
  const item = definition.items.find(
    (candidate) => candidate.roomSlot && !candidate.edible,
  )!;
  let reconstructed: GameState | undefined;
  let consumed = 0;
  async function verify() {
    for (const operation of operations.slice(consumed))
      reconstructed =
        operation.checkpoint ?? applyChanges(reconstructed!, operation.changes);
    consumed = operations.length;
    expect(reconstructed).toEqual(plain.current);
    expect(JSON.stringify(logged.current)).toBe(JSON.stringify(plain.current));
  }
  async function load(state: GameState) {
    await plain.load(state);
    await logged.load(structuredClone(state));
    await verify();
  }
  async function command(input: GameCommand) {
    const result = await logged.dispatch(input);
    expect(result).toEqual(await plain.dispatch(input));
    expect(result.outcomes[0].accepted).toBe(true);
    await verify();
  }
  await load({
    ...initial,
    balance: 40_000,
    inventory: { ...initial.inventory, [item.id]: 1 },
    statuses: { kidney_stone: { since: initial.now, source: 'test' } },
  });
  await command({
    type: 'place_item',
    itemId: item.id,
    slot: item.roomSlot!,
    commandId: 'place',
    now: plain.current!.now,
  });
  await command({
    type: 'medical_care',
    commandId: 'hospital',
    now: plain.current!.now,
  });
  expect(plain.current!.medicalDebt.length).toBeGreaterThan(0);
  expect(plain.current!.statuses.kidney_stone).toBeUndefined();
  await command({
    type: 'pay_medical_debt',
    commandId: 'pay',
    now: plain.current!.now,
  });
  expect(plain.current!.medicalDebt).toEqual([]);
  await load({
    ...plain.current!,
    metrics: { ...plain.current!.metrics, health: 0 },
  });
  expect(await logged.reconcile(plain.current!.now)).toEqual(
    await plain.reconcile(plain.current!.now),
  );
  await verify();
  expect(logged.current!.ending?.kind).toBe('death');
  expect(
    graveyardExportMarkdown(createGameViewModel(logged.current!, definition)),
  ).toBe(
    graveyardExportMarkdown(createGameViewModel(plain.current!, definition)),
  );
});

test('a failed logging confirmation cannot reject or retry an acknowledged game save', async () => {
  const pending = {
    batchId: 'save',
    gameHash: '00421873',
    contentVersion: 'test',
    baseStateVersion: 1,
    previousEventId: null,
    targetState: { ending: null },
    events: [],
  } as unknown as OutboxRecord;
  saving.next.mockResolvedValueOnce(pending).mockResolvedValueOnce(null);
  saving.acknowledge.mockResolvedValue(undefined);
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ stateVersion: 2, committedThroughSequence: 0 }),
        ),
      ),
  );
  const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await expect(
      flushGame(pending.gameHash, {
        confirmed: () => {
          throw new Error('Logging disk failure');
        },
      }),
    ).resolves.toBeUndefined();
    expect(saving.acknowledge).toHaveBeenCalledTimes(1);
    expect(saving.retry).not.toHaveBeenCalled();
  } finally {
    warnings.mockRestore();
    vi.unstubAllGlobals();
  }
});
