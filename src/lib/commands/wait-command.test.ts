import { expect, test, vi } from 'vitest';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { startRun } from '../game-engine';
import { HOUR_MS } from '../game-constants';
import { intentToCommand } from '../ui/game-view-model';
import { handleActivityCommand } from './activity-commands';

test.each([12, 6, 3, 1])(
  'passes the selected %i hours through the UI and engine',
  (hours) => {
    const state = startRun(
      { mode: 'streaming', seed: '12345678', now: 0, timezone: 'UTC' },
      definition,
    );
    const command = intentToCommand(
      { type: 'wait', hours },
      state,
      'selected-wait',
    );
    if (command.type !== 'wait') throw new Error('Expected wait command');
    const reconcile = vi.fn(() => ({
      state,
      eventIds: [],
      elapsedHours: hours,
    }));
    const outcome = handleActivityCommand(
      state,
      command,
      definition,
      reconcile,
    ).outcome;
    expect(outcome.accepted).toBe(true);
    expect(reconcile).toHaveBeenCalledWith(state, hours * HOUR_MS, definition, {
      stopAtCritical: true,
      preventLethalDecay: true,
    });
  },
);

test.each([0, -1, 2, 13, 1.5, NaN, Infinity])(
  'rejects unsupported duration %s without reconciling time',
  (hours) => {
    const state = startRun(
      { mode: 'streaming', seed: '12345678', now: 0, timezone: 'UTC' },
      definition,
    );
    const reconcile = vi.fn();
    const result = handleActivityCommand(
      state,
      { type: 'wait', hours, commandId: 'invalid', now: 0 },
      definition,
      reconcile,
    );
    expect(result.outcome.accepted).toBe(false);
    expect(result.state).toBe(state);
    expect(reconcile).not.toHaveBeenCalled();
  },
);

test('a fixed wait keeps the lack of grace when already critical', () => {
  const state = startRun(
    { mode: 'streaming', seed: '12345678', now: 0, timezone: 'UTC' },
    definition,
  );
  state.metrics.food = 0;
  const reconcile = vi.fn(() => ({ state, eventIds: [], elapsedHours: 1 }));
  handleActivityCommand(
    state,
    { type: 'wait', hours: 12, commandId: 'critical', now: 0 },
    definition,
    reconcile,
  );
  expect(reconcile).toHaveBeenCalledWith(state, 12 * HOUR_MS, definition, {
    stopAtCritical: false,
    preventLethalDecay: false,
  });
});
