import { expect, test } from 'vitest';
import { collectSavePoints } from './save-points';
import { resolvedBoundary } from '../simulation/resolution-boundary';
import { resolvedState } from '../telemetry/collector';
import { startRun } from '../game-engine';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { MAX_SAVE_EVENTS } from '../game-constants';

const initial = () =>
  startRun(
    { mode: 'realtime', seed: '00421873', now: 0, timezone: 'UTC' },
    definition,
  );

test('large catch-ups split only after complete effects and preserve finalized event evidence', () => {
  const before = initial();
  const { result, states } = collectSavePoints(
    before,
    () => {
      let state = before;
      for (let index = 0; index < MAX_SAVE_EVENTS + 10; index++) {
        const events = [0, 1].map((offset) => ({
          id: `event-${index}-${offset}`,
          type: 'time_reconciled',
          at: index,
          message: 'Before settlement',
        }));
        state = resolvedState({
          ...state,
          events: [...state.events, ...events],
        });
        state = resolvedBoundary({
          ...state,
          balance: state.balance + 1,
          events: state.events.map((event) =>
            events.includes(event) ? { ...event, message: 'Settled' } : event,
          ),
        });
      }
      return state;
    },
    (state) => state,
  );
  let previous = before;
  for (const state of states) {
    expect(state.events.length - previous.events.length).toBeLessThanOrEqual(
      MAX_SAVE_EVENTS,
    );
    expect(
      state.events
        .slice(before.events.length)
        .every((event) => event.message === 'Settled'),
    ).toBe(true);
    expect(result.events.slice(0, state.events.length)).toEqual(state.events);
    previous = state;
  }
  expect(states.length).toBeGreaterThan(2);
  expect(states.at(-1)).toBe(result);
});
