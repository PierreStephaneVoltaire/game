import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';
import { eventCandidates } from './event-candidate-pool';
import { streamWeight } from './stream-rules';
import { localDate } from './shop-rules';
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

const hardBlockers: Array<{
  status: StatusName;
  metrics: Partial<GameState['metrics']>;
}> = [
  { status: 'starving', metrics: { food: 2 } },
  { status: 'sleep_deprived', metrics: { rest: 2 } },
  { status: 'sick', metrics: {} },
  { status: 'kidney_stone', metrics: {} },
  { status: 'depressed', metrics: { mood: 2 } },
];

const softStatuses: StatusName[] = [
  'hungry',
  'low_energy',
  'overstimulated',
  'dizzy_spell',
];

describe('autonomous streaming public seam', () => {
  test('control state exposes a weighted stream candidate when eligible', () => {
    const state = streamRun();
    const candidates = eventCandidates(
      state,
      BUNDLED_GAME_DEFINITION,
      localDate(state.now, state.timezone),
      streamWeight(state, 'ui-1'),
    );
    expect(
      candidates.find((candidate) => candidate.type === 'stream')?.weight,
    ).toBeGreaterThan(0);
  });

  test.each(hardBlockers)(
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

  test.each(softStatuses)(
    '$status remains active without zeroing ordinary stream weight',
    (status) => {
      const initial = streamRun();
      const state: GameState = {
        ...initial,
        metrics: {
          ...initial.metrics,
          food: 10,
          rest: 10,
          mood: 10,
          creativity: 10,
        },
        statuses: { [status]: { since: STREAM_NOW, source: 'acceptance' } },
      };

      expect(streamWeight(state, 'soft-status')).toBeGreaterThan(0);
      expect(state.statuses[status]).toBeDefined();
      expect(
        streamWeight(
          {
            ...state,
            statuses: {
              ...state.statuses,
              sick: { since: STREAM_NOW, source: 'acceptance' },
            },
          },
          'soft-status',
        ),
      ).toBe(0);
    },
  );
});
