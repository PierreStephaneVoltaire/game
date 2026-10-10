import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { GameState } from '../game-types';
import type { OutboxRecord } from './types';

const storage = vi.hoisted(() => ({
  nextOutbox: vi.fn(),
  markSent: vi.fn(),
  acknowledge: vi.fn(),
  noteRetry: vi.fn(),
}));
const remote = vi.hoisted(() => ({
  downloadGame: vi.fn(),
  cacheRemoteGame: vi.fn(),
}));
vi.mock('./outbox', () => storage);
vi.mock('./remote', () => remote);
const { flushGame } = await import('./sync');
const state = {
  events: [],
  ending: null,
  stateVersion: 5,
  balance: 10,
} as unknown as GameState;
const pending: OutboxRecord = {
  batchId: 'batch',
  gameHash: '00421873',
  baseStateVersion: 3,
  previousEventId: null,
  contentVersion: 'old',
  commands: [],
  events: [],
  targetState: state,
  createdAt: 1,
  retryCount: 0,
};
const acknowledgement = {
  stateVersion: 4,
  committedThroughSequence: 0,
  committedThroughEventId: null,
};
let fetcher: ReturnType<typeof vi.fn>;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });
beforeEach(() => {
  storage.nextOutbox.mockResolvedValueOnce(pending).mockResolvedValue(null);
  storage.markSent.mockImplementation(async (record) => record);
  fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

test('freezes the batch before delivery and saves already-resolved results across content refreshes', async () => {
  const order: string[] = [];
  const refreshContent = vi.fn(async () => {
    order.push('refresh');
  });
  storage.markSent.mockImplementation(async (record) => {
    order.push('freeze');
    return record;
  });
  fetcher.mockImplementation(async () => {
    order.push('send');
    return json(200, acknowledgement);
  });
  await flushGame(pending.gameHash, { refreshContent });
  expect(order).toEqual(['refresh', 'freeze', 'send']);
  expect(storage.acknowledge).toHaveBeenCalledWith(
    pending,
    expect.objectContaining({ stateVersion: 4 }),
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body).targetState).toEqual(state);
});

test('a competing save adopts the complete server state without executing pending commands', async () => {
  fetcher.mockResolvedValue(
    json(412, {
      error: { code: 'STALE_STATE', message: 'The game state is stale.' },
    }),
  );
  const canonical = {
    stateVersion: 9,
    lastEventSequence: 0,
    lastEventId: null,
    state: { ...state, balance: 0 },
  };
  remote.downloadGame.mockResolvedValue(canonical);
  const adoptRemote = vi.fn();
  const rejected = vi.fn();
  await flushGame(pending.gameHash, { adoptRemote, rejected });
  expect(adoptRemote).toHaveBeenCalledWith(canonical, pending);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(storage.acknowledge).not.toHaveBeenCalled();
  expect(rejected).toHaveBeenCalledWith(
    pending,
    expect.objectContaining({
      code: 'STALE_STATE',
      batchId: pending.batchId,
      baseStateVersion: 3,
    }),
  );
});

test('a lost acknowledgement for this batch confirms it instead of discarding newer local state', async () => {
  fetcher.mockResolvedValue(json(412, { error: { code: 'STALE_STATE' } }));
  remote.downloadGame.mockResolvedValue({
    stateVersion: 4,
    lastEventSequence: 0,
    lastEventId: null,
    latestCommittedBatchId: pending.batchId,
    state,
  });
  const adoptRemote = vi.fn();
  await flushGame(pending.gameHash, { adoptRemote });
  expect(adoptRemote).not.toHaveBeenCalled();
  expect(storage.acknowledge).toHaveBeenCalledWith(
    pending,
    expect.objectContaining({ stateVersion: 4 }),
  );
});

test('failed deliveries retain the same batch, and competing senders share a flight', async () => {
  fetcher.mockResolvedValue(json(429, { error: { code: 'RATE_LIMITED' } }));
  await Promise.all([flushGame(pending.gameHash), flushGame(pending.gameHash)]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(storage.noteRetry).toHaveBeenCalledWith(pending.batchId);
  expect(storage.acknowledge).not.toHaveBeenCalled();
});

test('invalid acknowledgements cannot advance a cursor', async () => {
  fetcher.mockResolvedValue(
    json(200, { ...acknowledgement, committedThroughSequence: 2 }),
  );
  await flushGame(pending.gameHash);
  expect(storage.acknowledge).not.toHaveBeenCalled();
  expect(storage.noteRetry).toHaveBeenCalledWith(pending.batchId);
});

test('a rejected save with no newer server progress keeps local progress and its batch', async () => {
  fetcher.mockResolvedValue(
    json(409, {
      error: { code: 'EVENT_CONFLICT', message: 'Event IDs must be unique.' },
    }),
  );
  remote.downloadGame.mockResolvedValue({
    stateVersion: 3,
    lastEventSequence: 0,
    lastEventId: null,
    state: { ...state, stateVersion: 3, balance: 0 },
  });
  const adoptRemote = vi.fn();
  const rejected = vi.fn();
  await flushGame(pending.gameHash, { adoptRemote, rejected });
  expect(adoptRemote).not.toHaveBeenCalled();
  expect(remote.cacheRemoteGame).not.toHaveBeenCalled();
  expect(storage.acknowledge).not.toHaveBeenCalled();
  expect(storage.noteRetry).toHaveBeenCalledWith(pending.batchId);
  expect(rejected).toHaveBeenLastCalledWith(
    pending,
    expect.objectContaining({
      code: 'EVENT_CONFLICT',
      resolution: 'local_progress_retained',
      remoteStateVersion: 3,
      batchId: pending.batchId,
    }),
  );
});

test('a malformed local ledger is diagnosed and retained without being sent', async () => {
  const duplicate = { id: 'event-1', type: 'x', at: 0, message: '' };
  const malformed: OutboxRecord = {
    ...pending,
    targetState: {
      ...state,
      events: [duplicate, duplicate],
    } as unknown as GameState,
  };
  storage.nextOutbox.mockReset();
  storage.nextOutbox.mockResolvedValueOnce(malformed).mockResolvedValue(null);
  const rejected = vi.fn();
  await flushGame(pending.gameHash, { rejected });
  expect(fetcher).not.toHaveBeenCalled();
  expect(storage.noteRetry).toHaveBeenCalledWith(pending.batchId);
  expect(rejected).toHaveBeenCalledWith(
    malformed,
    expect.objectContaining({ code: 'LOCAL_LEDGER_INVALID' }),
  );
});
