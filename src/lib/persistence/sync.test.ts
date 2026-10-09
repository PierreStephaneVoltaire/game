import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '$lib/game-types';
import type { EventRecord, OutboxRecord } from './types';

const outbox = vi.hoisted(() => ({
  nextOutbox: vi.fn(),
  markSent: vi.fn(),
  acknowledge: vi.fn(),
  noteRetry: vi.fn(),
}));
vi.mock('./outbox', () => outbox);

const { flushGame } = await import('./sync');
const { chainedCursor } = await import('./games');

function batch(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
  return {
    batchId: 'batch-1',
    gameHash: '00421873',
    baseStateVersion: 3,
    previousEventId: 'event-3',
    contentVersion: 'v1',
    commands: [],
    events: [],
    targetState: { ending: null, stateVersion: 1 } as unknown as GameState,
    createdAt: 1,
    retryCount: 0,
    ...overrides,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

const manifest = () => new Response(null, { status: 304 });
const conflict = () => json(409, { error: { code: 'EVENT_CONFLICT' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  const pending = batch();
  outbox.nextOutbox.mockResolvedValue(pending);
  outbox.markSent.mockImplementation(async (record) => record);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function writeCalls() {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).startsWith('/api/games/current'),
  );
}

describe('game save flush', () => {
  it('marks the batch as sent before writing it', async () => {
    const order: string[] = [];
    outbox.markSent.mockImplementation(async (record) => {
      order.push('markSent');
      return record;
    });
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/manifest')) return manifest();
      order.push('write');
      return json(429, { error: { code: 'RATE_LIMITED' } });
    });

    await flushGame('00421873');

    expect(order).toEqual(['markSent', 'write']);
  });

  it('replays once on an event conflict, then resends', async () => {
    const replayConflict = vi.fn();
    let writes = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/manifest')) return manifest();
      writes += 1;
      return writes === 1
        ? conflict()
        : json(200, {
            gameHash: '00421873',
            stateVersion: 4,
            committedThroughSequence: 3,
            committedThroughEventId: 'event-3',
          });
    });
    outbox.nextOutbox
      .mockResolvedValueOnce(batch())
      .mockResolvedValueOnce(batch({ batchId: 'replayed' }))
      .mockResolvedValueOnce(null);

    await flushGame('00421873', { replayConflict });

    expect(replayConflict).toHaveBeenCalledTimes(1);
    expect(writeCalls()).toHaveLength(2);
    expect(outbox.acknowledge).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: 'replayed' }),
      expect.objectContaining({ stateVersion: 4 }),
    );
  });

  it('stops after one replay when conflicts repeat', async () => {
    const replayConflict = vi.fn();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/manifest') ? manifest() : conflict(),
    );

    await flushGame('00421873', { replayConflict });

    expect(replayConflict).toHaveBeenCalledTimes(1);
    expect(writeCalls()).toHaveLength(2);
    expect(outbox.noteRetry).toHaveBeenCalledTimes(1);
  });

  it('stops without replaying when rate limited', async () => {
    const replayConflict = vi.fn();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/manifest')
        ? manifest()
        : json(429, { error: { code: 'RATE_LIMITED' } }),
    );

    await flushGame('00421873', { replayConflict });

    expect(replayConflict).not.toHaveBeenCalled();
    expect(writeCalls()).toHaveLength(1);
  });
});

describe('chained batch cursor', () => {
  it('follows the last event of the sent batch', () => {
    const events = [
      { id: 'event-4', sequence: 4 },
      { id: 'event-5', sequence: 5 },
    ] as EventRecord[];
    expect(chainedCursor(batch({ events }))).toEqual({
      baseStateVersion: 4,
      previousEventId: 'event-5',
    });
  });

  it('keeps the previous event when the sent batch has no events', () => {
    expect(chainedCursor(batch())).toEqual({
      baseStateVersion: 4,
      previousEventId: 'event-3',
    });
  });
});
