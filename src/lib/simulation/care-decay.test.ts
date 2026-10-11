import { describe, expect, test } from 'vitest';
import { startRun, dispatchCommand, reconcileTime } from '../game-engine';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { HOUR_MS } from '../game-constants';
import { resolveDecay } from './decay-resolution';

// Keep random event outcomes out of the activity-duration/decay assertions.
const quiet = structuredClone(definition);
quiet.simulationRules.events.weights.none = 1e12;
quiet.simulationRules.timeDecay.foodDecayProbability = 1;

describe('care activity decay pause', () => {
  test('older published content also pauses care decay', () => {
    const older = structuredClone(quiet);
    delete (older.activityRules as Partial<typeof older.activityRules>)
      .pausedDecayActivities;
    const state = startRun(
      { mode: 'realtime', now: 0, seed: 'older-content', timezone: 'UTC' },
      older,
    );
    const paused = resolveDecay(
      {
        ...state,
        activity: {
          id: 'play',
          type: 'play',
          startedAt: 0,
          endsAt: 3 * HOUR_MS,
          sourceActionId: 'play',
        },
      },
      2 * HOUR_MS,
    );
    expect(paused.metrics).toEqual(state.metrics);
  });

  test.each([
    ['giant-plushie', 'offer_plushie_apology'],
    ['new-game', 'play_game'],
  ])('using %s does not advance or charge decay time', (itemId, action) => {
    const initial = startRun(
      { mode: 'streaming', now: 0, seed: 'care-item-pause', timezone: 'UTC' },
      quiet,
    );
    initial.inventory = { [itemId]: 1, controller: 1 };
    initial.history.decayRemainderMs = 1.9 * HOUR_MS;
    const result = dispatchCommand(
      initial,
      {
        type: 'perform_item_action',
        itemId,
        action,
        commandId: 'use-care-item',
        now: 0,
      },
      quiet,
    );
    expect(result.outcomes[0]?.accepted).toBe(true);
    expect(result.state.now).toBe(initial.now);
    expect(result.state.history.decayRemainderMs).toBe(
      initial.history.decayRemainderMs,
    );
    const effects = result.state.events.find(
      (event) => event.type === 'item_used',
    )!.metricDeltas!;
    expect(result.state.metrics.rest).toBe(
      initial.metrics.rest + (effects.rest ?? 0),
    );
    expect(
      result.state.events.some((event) => event.type === 'time_reconciled'),
    ).toBe(false);
  });

  test.each(['socialize', 'play'] as const)(
    '%s preserves partial clocks and resumes without catch-up',
    (type) => {
      const initial = startRun(
        { mode: 'realtime', now: 0, seed: 'care-pause', timezone: 'UTC' },
        quiet,
      );
      const state = {
        ...initial,
        history: {
          ...initial.history,
          decayRemainderMs: 1.75 * HOUR_MS,
          healthRemainderMs: 1.75 * HOUR_MS,
          lastBondGainAt: -47.75 * HOUR_MS,
        },
        activity: {
          id: 'care',
          type,
          startedAt: 0,
          endsAt: 3 * HOUR_MS,
          sourceActionId: 'care',
        },
      };
      const paused = resolveDecay(state, 3 * HOUR_MS);
      expect(paused.metrics).toEqual(state.metrics);
      expect(paused.resolvedDecayRemainderMs).toBe(1.75 * HOUR_MS);
      expect(paused.resolvedHealthRemainderMs).toBe(1.75 * HOUR_MS);
      const resumed = {
        ...state,
        activity: null,
        now: 3 * HOUR_MS,
        lastResolvedAt: 3 * HOUR_MS,
        history: { ...state.history, lastBondGainAt: paused.lastBondGainAt },
      };
      expect(resolveDecay(resumed, 3.125 * HOUR_MS).metrics).toEqual(
        state.metrics,
      );
      const due = resolveDecay(resumed, 3.25 * HOUR_MS);
      expect(due.metrics.food).toBe(state.metrics.food - 1);
      expect(due.metrics.rest).toBe(state.metrics.rest - 1);
      expect(due.metrics.bond).toBe(state.metrics.bond - 1);
    },
  );

  test.each(['socialize', 'play'] as const)(
    '%s resolves instantly without advancing time in both modes',
    (type) => {
      for (const mode of ['streaming', 'realtime'] as const) {
        const initial = startRun(
          { mode, now: 0, seed: 'care-pause', timezone: 'UTC' },
          quiet,
        );
        initial.history.decayRemainderMs = 1.9 * HOUR_MS;
        const transition = dispatchCommand(
          initial,
          { type, commandId: 'care', now: 0 },
          quiet,
        );
        expect(transition.outcomes[0]?.accepted).toBe(true);
        const completed = transition.state;
        expect(completed.activity).toBeNull();
        expect(completed.now).toBe(initial.now);
        expect(completed.history.decayRemainderMs).toBe(
          initial.history.decayRemainderMs,
        );
        expect(completed.metrics.food).toBe(initial.metrics.food);
        expect(completed.metrics.rest).toBe(initial.metrics.rest);
        expect(completed.metrics.bond).toBe(initial.metrics.bond + 1);
        const metric = type === 'socialize' ? 'creativity' : 'mood';
        expect(completed.metrics[metric]).toBeGreaterThan(
          initial.metrics[metric],
        );
      }
    },
  );

  test.each(['socialize', 'play'] as const)(
    '%s pauses decay and Health until its lock ends, then resumes',
    (type) => {
      const initial = startRun(
        { mode: 'realtime', now: 0, seed: 'care-window', timezone: 'UTC' },
        quiet,
      );
      initial.history.decayRemainderMs = 1.75 * HOUR_MS;
      initial.history.healthRemainderMs = 1.75 * HOUR_MS;
      initial.history.nextAutonomousAt = 100 * HOUR_MS;
      const started = dispatchCommand(
        initial,
        { type, commandId: 'care-window', now: 0 },
        quiet,
      ).state;
      const until = started.history.interactionCooldowns![type]!;
      const atEnd = reconcileTime(started, until, quiet).state;
      expect(atEnd.metrics.food).toBe(started.metrics.food);
      expect(atEnd.metrics.rest).toBe(started.metrics.rest);
      expect(atEnd.history.decayRemainderMs).toBe(1.75 * HOUR_MS);
      expect(atEnd.history.healthRemainderMs).toBe(1.75 * HOUR_MS);
      const after = reconcileTime(atEnd, until + 0.5 * HOUR_MS, quiet).state;
      expect(after.metrics.food).toBe(started.metrics.food - 1);
      expect(after.metrics.rest).toBe(started.metrics.rest - 1);
    },
  );

  test('overlapping Socialize and Play locks pause decay only until the later lock ends', () => {
    const initial = startRun(
      { mode: 'realtime', now: 0, seed: 'care-overlap', timezone: 'UTC' },
      quiet,
    );
    initial.history.decayRemainderMs = 1.75 * HOUR_MS;
    initial.history.healthRemainderMs = 1.75 * HOUR_MS;
    initial.history.nextAutonomousAt = 100 * HOUR_MS;
    const played = dispatchCommand(
      initial,
      { type: 'play', commandId: 'overlap-play', now: 0 },
      quiet,
    ).state;
    const both = dispatchCommand(
      played,
      { type: 'socialize', commandId: 'overlap-socialize', now: 0 },
      quiet,
    ).state;
    const { socialize, play } = both.history.interactionCooldowns!;
    const longest = Math.max(socialize!, play!);
    const atLongest = reconcileTime(both, longest, quiet).state;
    expect(atLongest.metrics.food).toBe(both.metrics.food);
    expect(atLongest.metrics.rest).toBe(both.metrics.rest);
    expect(atLongest.history.decayRemainderMs).toBe(1.75 * HOUR_MS);
    expect(atLongest.history.healthRemainderMs).toBe(1.75 * HOUR_MS);
    const after = reconcileTime(
      atLongest,
      longest + 0.5 * HOUR_MS,
      quiet,
    ).state;
    expect(after.metrics.food).toBe(both.metrics.food - 1);
    expect(after.metrics.rest).toBe(both.metrics.rest - 1);
  });
});
