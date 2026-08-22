import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginGameSession, sendGameIntent } from './game-session';
import { HOUR_MS } from './game-constants';

describe('browser game session', () => {
  afterEach(() => vi.useRealTimers());

  it('reconciles Realtime state before constructing the next command', async () => {
    vi.useFakeTimers();
    const startedAt = Date.UTC(2026, 7, 22, 14);
    vi.setSystemTime(startedAt);
    await beginGameSession('realtime');

    vi.setSystemTime(startedAt + 2 * HOUR_MS);
    const outcome = await sendGameIntent({ type: 'play' });

    expect(outcome.accepted).toBe(true);
    expect(outcome.kind).not.toBe('stale');
  });
});
