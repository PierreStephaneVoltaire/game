import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  beginGameSession,
  createGameKey,
  ensureGameSession,
  gameViewModel,
  sendGameIntent,
} from './game-session';
import { HOUR_MS } from './game-constants';

describe('browser game session', () => {
  afterEach(() => vi.useRealTimers());

  it('does not create a run when no keyed session was started', async () => {
    await expect(ensureGameSession()).resolves.toBe(false);
    expect(get(gameViewModel)).toBeNull();
  });

  it('reconciles Realtime state before constructing the next command', async () => {
    vi.useFakeTimers();
    const startedAt = Date.UTC(2026, 7, 22, 14);
    vi.setSystemTime(startedAt);
    await beginGameSession('realtime', '10000001');

    vi.setSystemTime(startedAt + 2 * HOUR_MS);
    const outcome = await sendGameIntent({ type: 'play' });

    expect(outcome.kind).not.toBe('stale');
  });

  it('reconciles an existing Realtime run when the game layout is entered', async () => {
    vi.useFakeTimers();
    const startedAt = Date.UTC(2026, 7, 22, 14);
    vi.setSystemTime(startedAt);
    await beginGameSession('realtime', '10000002');

    vi.setSystemTime(startedAt + 2 * HOUR_MS);
    await ensureGameSession();

    expect(get(gameViewModel)?.now).toBe(startedAt + 2 * HOUR_MS);
  });

  it('uses the supplied session key as the run seed', async () => {
    await beginGameSession('streaming', '00421873');

    expect(get(gameViewModel)?.seed).toBe('00421873');
  });

  it('generates an eight-digit game key', () => {
    expect(createGameKey()).toMatch(/^\d{8}$/);
  });
});
