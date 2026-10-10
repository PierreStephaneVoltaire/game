import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  nextOutbox: vi.fn(),
  flushGame: vi.fn(),
}));

vi.mock('./outbox', () => ({ nextOutbox: storage.nextOutbox }));
vi.mock('./sync', () => ({ flushGame: storage.flushGame }));

const { scheduleGameSync } = await import('./scheduler');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
  storage.nextOutbox.mockResolvedValue(null);
  storage.flushGame.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

test('debounces changes for one second with a five second maximum wait', async () => {
  const gameHash = 'scheduler-debounce';
  scheduleGameSync(gameHash, {});
  for (let index = 0; index < 6; index += 1) {
    await vi.advanceTimersByTimeAsync(800);
    scheduleGameSync(gameHash, {});
  }

  await vi.advanceTimersByTimeAsync(199);
  expect(storage.flushGame).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(storage.flushGame).toHaveBeenCalledTimes(1);
  expect(storage.flushGame).toHaveBeenCalledWith(gameHash, {});
});

test('retries pending outbox work after the scheduled backoff', async () => {
  const gameHash = 'scheduler-retry';
  storage.nextOutbox
    .mockResolvedValueOnce({ batchId: 'pending' })
    .mockResolvedValueOnce(null);

  scheduleGameSync(gameHash, {});
  await vi.advanceTimersByTimeAsync(1000);
  expect(storage.flushGame).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(5999);
  expect(storage.flushGame).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(storage.flushGame).toHaveBeenCalledTimes(2);
});

test('keeps a change scheduled while a flush is in flight', async () => {
  const gameHash = 'scheduler-inflight';
  let finishFlush!: () => void;
  storage.flushGame.mockImplementationOnce(
    () => new Promise<void>((resolve) => (finishFlush = resolve)),
  );
  const earlierHooks = { rejected: vi.fn() };
  const laterHooks = { rejected: vi.fn() };

  scheduleGameSync(gameHash, earlierHooks);
  await vi.advanceTimersByTimeAsync(1000);
  expect(storage.flushGame).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(200);
  scheduleGameSync(gameHash, laterHooks);
  finishFlush();
  await Promise.resolve();
  await Promise.resolve();

  await vi.advanceTimersByTimeAsync(999);
  expect(storage.flushGame).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(storage.flushGame).toHaveBeenCalledTimes(2);
  expect(storage.flushGame).toHaveBeenLastCalledWith(gameHash, laterHooks);
});
