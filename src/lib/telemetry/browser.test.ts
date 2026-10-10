import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';

const remote = vi.hoisted(() => ({
  enqueueOperation: vi.fn(),
  flushLogging: vi.fn(),
  setLoggingAccount: vi.fn(),
}));

vi.mock('./outbox', () => ({
  enqueueOperation: remote.enqueueOperation,
}));
vi.mock('./delivery', () => ({
  flushLogging: remote.flushLogging,
  setLoggingAccount: remote.setLoggingAccount,
}));

const repository = { load: async () => definition };
const start = {
  mode: 'streaming' as const,
  now: 1_800_000_000_000,
  seed: '00421873',
  timezone: 'America/Toronto',
};
const logged = vi.spyOn(console, 'log').mockImplementation(() => {});

beforeEach(() => {
  vi.resetModules();
  remote.enqueueOperation.mockReset();
  remote.flushLogging.mockReset();
  remote.setLoggingAccount.mockReset();
  logged.mockClear();
  vi.stubGlobal('window', {
    setInterval: vi.fn(),
    addEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function setup(enabled: boolean, owner: string | null) {
  vi.stubEnv('PUBLIC_GAMEPLAY_LOGGING', enabled ? 'true' : 'false');
  const { currentAccount } = await import('../accounts/account-client');
  currentAccount.set(owner ? { userId: owner, username: owner } : null);
  const { browserCapture } = await import('./browser');
  const { GameController } = await import('../game-controller');
  const capture = browserCapture();
  if (!capture) throw new Error('Expected browser capture to initialize.');
  const controller = new GameController(repository, capture);
  await controller.start(start);
  return { controller, currentAccount };
}

describe('browser gameplay capture routing', () => {
  test('logging disabled and no account still keeps console diagnostics', async () => {
    const { controller } = await setup(false, null);
    expect(
      logged.mock.calls.some(([message]) =>
        String(message).startsWith('[gameplay] run_initialized'),
      ),
    ).toBe(true);
    await controller.dispatch({
      type: 'wait',
      hours: 1,
      commandId: 'disabled-console',
      now: start.now,
    });
    expect(
      logged.mock.calls.some(([message]) => message === '[gameplay] command'),
    ).toBe(true);
    expect(remote.enqueueOperation).not.toHaveBeenCalled();
    expect(remote.flushLogging).not.toHaveBeenCalled();
  });

  test('owner changes pause uploads and returning starts with a checkpoint', async () => {
    const { controller, currentAccount } = await setup(true, 'owner-a');
    expect(remote.enqueueOperation).toHaveBeenCalledTimes(1);
    expect(remote.enqueueOperation.mock.calls[0][0]).toBe('owner-a');
    remote.enqueueOperation.mockClear();
    remote.flushLogging.mockClear();
    logged.mockClear();

    currentAccount.set({ userId: 'owner-b', username: 'owner-b' });
    await controller.dispatch({
      type: 'wait',
      hours: 1,
      commandId: 'other-owner',
      now: controller.current!.now,
    });
    expect(remote.enqueueOperation).not.toHaveBeenCalled();
    expect(
      logged.mock.calls.some(([message]) => message === '[gameplay] command'),
    ).toBe(true);

    currentAccount.set({ userId: 'owner-a', username: 'owner-a' });
    await controller.dispatch({
      type: 'wait',
      hours: 1,
      commandId: 'owner-returned',
      now: controller.current!.now,
    });
    expect(remote.enqueueOperation.mock.calls.length).toBeGreaterThan(1);
    expect(remote.enqueueOperation.mock.calls[0][0]).toBe('owner-a');
    expect(remote.enqueueOperation.mock.calls[0][1].checkpoint).toBeDefined();
    expect(remote.enqueueOperation.mock.calls[0][1].kind).toBe('transition');
    remote.enqueueOperation.mockClear();
    await controller.dispatch({
      type: 'wait',
      hours: 1,
      commandId: 'owner-normal',
      now: controller.current!.now,
    });
    expect(remote.enqueueOperation.mock.calls.length).toBeGreaterThan(1);
    expect(
      remote.enqueueOperation.mock.calls.at(-1)![1].checkpoint,
    ).toBeUndefined();
  });

  test('allowed records upload and remote failures leave console logs and game results intact', async () => {
    const { controller } = await setup(true, 'owner-a');
    const { GameController } = await import('../game-controller');
    const plain = new GameController(repository);
    await plain.start(start);
    const first = {
      type: 'wait' as const,
      hours: 1,
      commandId: 'upload-ok',
      now: controller.current!.now,
    };
    expect(await controller.dispatch(first)).toEqual(
      await plain.dispatch(first),
    );
    expect(remote.enqueueOperation.mock.calls.length).toBeGreaterThan(1);
    expect(
      remote.enqueueOperation.mock.calls.at(-1)![1].checkpoint,
    ).toBeUndefined();

    remote.enqueueOperation.mockImplementation(() => {
      throw new Error('outbox unavailable');
    });
    logged.mockClear();
    const next = {
      type: 'wait' as const,
      hours: 1,
      commandId: 'upload-fails',
      now: controller.current!.now,
    };
    const before = controller.current!;
    expect(await controller.dispatch(next)).toEqual(await plain.dispatch(next));
    expect(
      logged.mock.calls
        .filter(([message]) => String(message).startsWith('[gameplay] event'))
        .map(([, detail]) => detail.event.id),
    ).toEqual(
      controller
        .current!.events.slice(before.events.length)
        .map((event) => event.id),
    );
    expect(
      logged.mock.calls.some(([message]) => message === '[gameplay] command'),
    ).toBe(true);
  });
});
