import { expect, test, vi } from 'vitest';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { GameController } from '../game-controller';
import { GameplayCapture, type Operation } from './capture';
import { replayPending } from '../persistence/replay';
import type { OutboxRecord } from '../persistence/types';

const storage = vi.hoisted(() => ({
  pending: null as OutboxRecord | null,
  replace: vi.fn(),
}));
vi.mock('../persistence/outbox', () => ({
  nextOutbox: async () => storage.pending,
  replacePending: storage.replace,
}));

test('conflict replays preserve original outcomes and identify superseded and confirmed streams', async () => {
  const operations: Operation[] = [];
  const repository = { load: async () => definition };
  const original = new GameController(
    repository,
    new GameplayCapture((operation) => operations.push(operation)),
  );
  const initial = await original.start({
    mode: 'streaming',
    seed: '00421873',
    now: 1_800_000_000_000,
    timezone: 'UTC',
  });
  const base = {
    ...initial,
    shop: {
      ...initial.shop,
      itemIds: ['water'],
      stock: { water: 5 },
      cart: {},
    },
  };
  await original.load(base);
  const command = {
    type: 'buy_item' as const,
    itemId: 'water',
    commandId: 'purchase',
    now: base.now,
  };
  const target = (await original.dispatch(command)).state;
  storage.pending = {
    batchId: crypto.randomUUID(),
    gameHash: base.seed,
    baseStateVersion: 1,
    previousEventId: 'event-1',
    contentVersion: definition.version,
    commands: [command],
    events: [],
    targetState: target,
    createdAt: 1,
    retryCount: 0,
  };
  storage.replace.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            stateVersion: 2,
            lastEventSequence: base.events.length,
            lastEventId: base.events.at(-1)!.id,
            state: { ...base, balance: 0 },
          }),
          { status: 200 },
        ),
    ),
  );
  try {
    const applied = vi.fn();
    const confirmed = await replayPending(
      base.seed,
      repository,
      applied,
      original.capture,
    );
    expect(applied).toHaveBeenCalledTimes(1);
    expect(
      operations.filter((operation) => operation.kind === 'replay_superseded'),
    ).toHaveLength(1);
    expect(
      operations.filter((operation) => operation.kind === 'replay_applied'),
    ).toHaveLength(1);
    const replayed = applied.mock.calls[0][0] as GameController;
    confirmed!.marker(
      'save_confirmed',
      { saveBatchId: 'new-batch' },
      replayed.current!,
    );
    expect(operations.at(-1)!.streamId).toBe(confirmed!.streamId);
    expect(confirmed!.streamId).not.toBe(original.capture!.streamId);
    expect(
      operations
        .filter((operation) => operation.kind === 'command')
        .map((operation) => operation.summary.accepted),
    ).toEqual([true, false, false]);
    expect(original.current).toEqual(target);
    expect(replayed.current!.balance).toBe(0);
    expect(
      new Set(operations.map((operation) => operation.streamId)).size,
    ).toBe(3);
  } finally {
    vi.unstubAllGlobals();
  }
});
