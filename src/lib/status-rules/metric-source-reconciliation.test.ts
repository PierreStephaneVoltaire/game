import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from '../game-definition';
import { startRun } from '../game-engine';
import { reconcileMetricSource } from './metric-source-reconciliation';

function run() {
  return startRun(
    { mode: 'realtime', now: 0, seed: 'metric-source', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('immediate metric-source status normalization', () => {
  test('fires a newly aligned onset effect exactly once', () => {
    const before = run();
    const changed = {
      ...before,
      metrics: { ...before.metrics, bond: 2 },
    };
    const first = reconcileMetricSource(before, changed, 'source');
    expect(first.statuses.lonely).toBeDefined();
    expect(first.metrics.mood).toBe(before.metrics.mood - 1);

    const repeated = reconcileMetricSource(first, first, 'source-again');
    expect(repeated.metrics.mood).toBe(first.metrics.mood);
  });

  test('suppresses Creativity changes while Hyperfocus is pinned', () => {
    const before = run();
    const focused = {
      ...before,
      metrics: { ...before.metrics, creativity: 1 },
      timedEffects: { ...before.timedEffects, hyperfocusUntil: 1_000 },
    };
    const result = reconcileMetricSource(before, focused, 'creative-source');
    expect(result.metrics.creativity).toBe(10);
    expect(result.statuses.creative_block).toBeUndefined();
  });
});
