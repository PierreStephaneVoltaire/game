import { describe, expect, test } from 'vitest';

import { eventCandidates } from './event-candidate-pool';
import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { startRun } from './game-engine';

describe('autonomous event candidates', () => {
  test('offers the Socks event without any placed item', () => {
    const initial = startRun(
      { mode: 'realtime', now: 0, seed: 'socks-gate', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const candidates = eventCandidates(
      initial,
      BUNDLED_GAME_DEFINITION,
      '1970-01-01',
      0,
    );
    expect(
      candidates.find((candidate) => candidate.type === 'socks')?.weight,
    ).toBeGreaterThan(0);
  });
});
