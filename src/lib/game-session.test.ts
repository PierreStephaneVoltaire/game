import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { get } from 'svelte/store';
import {
  beginGameSession,
  createGameKey,
  ensureGameSession,
  gameViewModel,
  sendGameIntent,
  useGameDefinitionRepository,
} from './game-session';
import { HOUR_MS } from './game-constants';
import { BundledGameDefinitionRepository } from './test-game-definition';

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
