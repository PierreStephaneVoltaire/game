import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { get } from 'svelte/store';
import {
  beginGameSession,
  createGameKey,
  ensureGameSession,
  gameViewModel,
  companionSpeechSession,
  reconcileGameClock,
  sendGameIntent,
  useGameDefinitionRepository,
} from './game-session';
import { HOUR_MS } from './game-constants';
import {
  BUNDLED_GAME_DEFINITION,
  BundledGameDefinitionRepository,
} from './test-game-definition';

describe('browser game session', () => {
  beforeEach(() =>
    useGameDefinitionRepository(new BundledGameDefinitionRepository()),
  );
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

  it.each(['realtime', 'streaming'] as const)(
    'publishes only the completed %s action, including clock catch-up',
    async (mode) => {
      vi.useFakeTimers();
      const startedAt = Date.UTC(2026, 7, 22, 14);
      vi.setSystemTime(startedAt);
      await beginGameSession(mode, '10000003');
      const published = vi.fn();
      const unsubscribe = companionSpeechSession.subscribe(published);
      published.mockClear();
      try {
        vi.setSystemTime(startedAt + 2 * HOUR_MS);
        await sendGameIntent({ type: 'play' });
        expect(published).toHaveBeenCalledTimes(1);
        expect(published.mock.calls[0][0].command.type).toBe('play');
        expect(published.mock.calls[0][0].state.now).toBe(
          get(gameViewModel)!.now,
        );
      } finally {
        unsubscribe();
      }
    },
  );

  it('does not publish or resolve effects again for overlapping clock triggers at the same time', async () => {
    useGameDefinitionRepository({
      load: async () => structuredClone(BUNDLED_GAME_DEFINITION),
    });
    vi.useFakeTimers();
    const startedAt = Date.UTC(2026, 7, 22, 14);
    vi.setSystemTime(startedAt);
    await beginGameSession('realtime', '10000004');
    const published = vi.fn();
    const unsubscribe = companionSpeechSession.subscribe(published);
    published.mockClear();
    try {
      vi.setSystemTime(startedAt + 2 * HOUR_MS);
      await Promise.all([
        reconcileGameClock(),
        reconcileGameClock(),
        reconcileGameClock(),
      ]);
      expect(published).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('uses the supplied session key as the run seed', async () => {
    await beginGameSession('streaming', '00421873');

    expect(get(gameViewModel)?.seed).toBe('00421873');
  });

  it('generates an eight-digit game key', () => {
    expect(createGameKey()).toMatch(/^\d{8}$/);
  });

  it('uses IndexedDB and injected content in production gameplay', () => {
    const files = globSync('src/lib/**/*.ts', {
      exclude: [
        '**/*.test.ts',
        '**/test-*.ts',
        '**/*-test-fixtures.ts',
        '**/*-study.ts',
        '**/catalog-validation.ts',
        '**/content/local-content.ts',
      ],
    });
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(
        /import(?!\s+type\b)[^;]*['"][^'"]*data\//,
      );
      expect(source, file).not.toContain('test-game-definition');
      expect(source, file).not.toContain('sessionStorage');
    }
    const session = readFileSync('src/lib/game-session.ts', 'utf8');
    expect(session).toContain('new RuntimeContentCache()');
  });
});
