import { describe, expect, test } from 'vitest';

import { eventCandidates } from './event-candidate-pool';
import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { startRun } from './game-engine';

describe('autonomous event candidates', () => {
  test('does not offer the Socks event until Cat Tree is placed', () => {
    const initial = startRun(
      { mode: 'realtime', now: 0, seed: 'socks-gate', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const withoutCatTree = eventCandidates(
      initial,
      BUNDLED_GAME_DEFINITION,
      '1970-01-01',
      0,
    );
    expect(
      withoutCatTree.find((candidate) => candidate.type === 'socks')?.weight,
    ).toBe(0);

    const withCatTree = eventCandidates(
      { ...initial, room: { ...initial.room, shelf: 'cat-tree' } },
      BUNDLED_GAME_DEFINITION,
      '1970-01-01',
      0,
    );
    expect(
      withCatTree.find((candidate) => candidate.type === 'socks')?.weight,
    ).toBeGreaterThan(0);
  });
});
