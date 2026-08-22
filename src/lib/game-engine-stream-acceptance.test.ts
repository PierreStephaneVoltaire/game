import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';
import type { GameState, StatusName } from './game-types';

const STREAM_SEED = '00000010000000100000001000000010';
const STREAM_NOW = Date.UTC(2026, 7, 22, 17);

function streamRun() {
  return startRun(
    {
      mode: 'streaming',
      now: STREAM_NOW,
      seed: STREAM_SEED,
      timezone: 'America/Toronto',
    },
    BUNDLED_GAME_DEFINITION,
  );
}

const blockers: Array<{
  status: StatusName;
  metrics: Partial<GameState['metrics']>;
}> = [
  { status: 'hungry', metrics: { food: 3 } },
  { status: 'starving', metrics: { food: 2 } },
  { status: 'sleep_deprived', metrics: { rest: 2 } },
  { status: 'sick', metrics: {} },
  { status: 'kidney_stone', metrics: {} },
  { status: 'depressed', metrics: { mood: 2 } },
  { status: 'low_energy', metrics: { food: 2, rest: 2 } },
  { status: 'overstimulated', metrics: {} },
];

describe('autonomous streaming public seam', () => {
  test('control seed and command produce a stream candidate when eligible', () => {
    const result = dispatchCommand(
      streamRun(),
      { type: 'socialize', commandId: 'ui-1', now: STREAM_NOW },
      BUNDLED_GAME_DEFINITION,
    );
    expect(
      result.state.events.some((event) => event.type === 'stream_candidate'),
    ).toBe(true);
  });

  test.each(blockers)(
    '$status prevents a stream candidate under the same seed and command',
    ({ status, metrics }) => {
      const initial = streamRun();
      const state = {
        ...initial,
        metrics: {
          ...initial.metrics,
          food: 10,
          rest: 10,
          mood: 10,
          ...metrics,
        },
        statuses: { [status]: { since: STREAM_NOW, source: 'acceptance' } },
      } as GameState;
      const result = dispatchCommand(
        state,
        { type: 'socialize', commandId: 'ui-1', now: STREAM_NOW },
        BUNDLED_GAME_DEFINITION,
      ).state;
      expect(result.activity?.type).not.toBe('stream');
      expect(
        result.events.some((event) => event.type === 'stream_candidate'),
      ).toBe(false);
    },
  );
});
