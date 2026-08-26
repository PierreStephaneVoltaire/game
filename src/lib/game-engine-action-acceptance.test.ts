import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameMode, GameState } from './game-types';

const HOUR = 3_600_000;

function run(mode: GameMode = 'streaming', seed = 'action-acceptance') {
  return startRun(
    { mode, now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

function restState(rest: number, seed: string) {
  const initial = run('streaming', seed);
  return {
    ...initial,
    metrics: { ...initial.metrics, food: 10, health: 10, mood: 5, rest },
    statuses: { sick: { since: 0, source: 'acceptance' } },
  } as GameState;
}

function restResult(rest: number, seed: string, commandId = `rest-${seed}`) {
  return dispatchCommand(
    restState(rest, seed),
    { type: 'rest', commandId, now: 0 },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('activity distributions and refusals', () => {
  test.each([
    [0, [7, 8, 9]],
    [3, [6, 7, 8]],
    [6, [4, 5, 6]],
  ])(
    'Rest at %i resolves only its authored duration band',
    (startingRest, durations) => {
      const seen = new Set<number>();
      for (
        let index = 0;
        index < 400 && seen.size < durations.length;
        index += 1
      ) {
        const result = restResult(
          startingRest,
          `rest-band-${startingRest}-${index}`,
        );
        expect(result.outcomes[0]?.accepted).toBe(true);
        const started = result.state.events.find(
          (event) =>
            event.type === 'activity_started' &&
            event.sourceActionId === `rest-rest-band-${startingRest}-${index}`,
        );
        const completed = result.state.events.find(
          (event) =>
            event.type === 'activity_completed' &&
            event.sourceActionId === `rest-rest-band-${startingRest}-${index}`,
        );
        expect(started).toBeDefined();
        expect(completed).toBeDefined();
        seen.add((completed!.at - started!.at) / HOUR);
      }
      expect([...seen].sort((a, b) => a - b)).toEqual(durations);
    },
  );

  test('Rest at 8 and 9 can refuse, while Rest at 10 always refuses', () => {
    for (const rest of [8, 9]) {
      let refused = false;
      let accepted = false;
      for (let index = 0; index < 400 && (!refused || !accepted); index += 1) {
        const outcome = restResult(rest, `rest-refusal-${rest}-${index}`)
          .outcomes[0];
        refused ||= outcome.kind === 'refused';
        accepted ||= outcome.accepted;
      }
      expect(refused).toBe(true);
      expect(accepted).toBe(true);
    }
    expect(restResult(10, 'rest-refusal-10').outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'refused',
    });
  });

  test('completed Rest applies recovery and clears Sleep Deprived', () => {
    const initial = run('streaming', 'rest-recovery');
    const state = {
      ...initial,
      metrics: { ...initial.metrics, food: 10, health: 6, mood: 5, rest: 7 },
      statuses: {
        sleep_deprived: { since: 0, source: 'rest' },
        sick: { since: 0, source: 'acceptance' },
      },
    } as GameState;
    const result = dispatchCommand(
      state,
      { type: 'rest', commandId: 'rest-recovery', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    const completed = result.state.events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.sourceActionId === 'rest-recovery',
    )!;
    const recovered = completed.metricDeltas?.rest ?? 0;
    expect(completed.metricDeltas).toMatchObject({
      rest: recovered,
      mood: Math.floor(recovered / 6),
    });
    expect(completed.metricDeltas?.health).toBeUndefined();
    expect(result.state.statuses.sleep_deprived).toBeUndefined();
  });

  test('Socialize and Play apply their distinct completion effects', () => {
    const social = dispatchCommand(
      {
        ...run('streaming', 'socialize-acceptance'),
        metrics: {
          food: 10,
          health: 10,
          mood: 5,
          rest: 10,
          bond: 4,
          creativity: 5,
        },
        statuses: { sick: { since: 0, source: 'acceptance' } },
      },
      { type: 'socialize', commandId: 'socialize-acceptance', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const socialCompletion = social.events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.sourceActionId === 'socialize-acceptance',
    );
    expect(socialCompletion?.metricDeltas?.bond).toBe(1);
    expect([1, 2]).toContain(socialCompletion?.metricDeltas?.creativity);
    expect(socialCompletion?.metricDeltas?.mood).toBeUndefined();

    const play = dispatchCommand(
      {
        ...run('streaming', 'play-acceptance'),
        metrics: {
          food: 10,
          health: 10,
          mood: 5,
          rest: 10,
          bond: 4,
          creativity: 5,
        },
        statuses: { sick: { since: 0, source: 'acceptance' } },
      },
      { type: 'play', commandId: 'play-acceptance', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const playCompletion = play.events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.sourceActionId === 'play-acceptance',
    );
    expect(playCompletion?.metricDeltas?.bond).toBe(1);
    expect([1, 2]).toContain(playCompletion?.metricDeltas?.mood);
    expect(playCompletion?.metricDeltas?.creativity).toBeUndefined();
  });

  test('Mood, Rest, and Annoyed make Socialize/Play refusals possible', () => {
    for (const type of ['socialize', 'play'] as const) {
      let refusal: ReturnType<typeof dispatchCommand> | undefined;
      for (let index = 0; index < 200 && !refusal; index += 1) {
        const initial = run('streaming', `refusal-${type}-${index}`);
        const state = {
          ...initial,
          metrics: { ...initial.metrics, food: 10, mood: 2, rest: 2 },
          statuses: { annoyed: { since: 0, source: 'acceptance' } },
        } as GameState;
        const result = dispatchCommand(
          state,
          { type, commandId: `refusal-${type}-${index}`, now: 0 },
          BUNDLED_GAME_DEFINITION,
        );
        if (result.outcomes[0]?.kind === 'refused') refusal = result;
      }
      expect(refusal?.outcomes[0]).toMatchObject({
        accepted: false,
        kind: 'refused',
      });
    }
  });
});

describe('Wait, Medical Care, and active activity boundaries', () => {
  test('Streaming Wait advances 1–12 hours and Realtime Wait is refused', () => {
    const streaming = dispatchCommand(
      run('streaming', 'wait-acceptance'),
      { type: 'wait', commandId: 'wait-acceptance', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(streaming.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'waited',
    });
    expect(streaming.state.now / HOUR).toBeGreaterThanOrEqual(1);
    expect(streaming.state.now / HOUR).toBeLessThanOrEqual(12);

    const realtime = dispatchCommand(
      run('realtime', 'wait-realtime'),
      { type: 'wait', commandId: 'wait-realtime', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(realtime.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'unavailable',
    });
    expect(realtime.state.now).toBe(0);
  });

  test('Medical Care is instant in Streaming and remains active for 12 hours in Realtime', () => {
    const streamingInitial = run('streaming', 'medical-streaming');
    const fixture = (state: GameState): GameState => ({
      ...state,
      metrics: {
        food: 10,
        health: 10,
        mood: 10,
        rest: 10,
        bond: 10,
        creativity: 10,
      },
      statuses: { kidney_stone: { since: 0, source: 'acceptance' } },
    });
    const streaming = dispatchCommand(
      fixture(streamingInitial),
      { type: 'medical_care', commandId: 'medical-streaming', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(streaming.state.balance).toBe(-9_974);
    expect(streaming.state.activity).toBeNull();
    expect(streaming.state.statuses.kidney_stone).toBeUndefined();

    const realtimeInitial = fixture(run('realtime', 'medical-realtime'));
    const started = dispatchCommand(
      realtimeInitial,
      { type: 'medical_care', commandId: 'medical-realtime', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(started.state.activity?.type).toBe('medical_care');
    const completed = reconcileTime(
      started.state,
      12 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(completed.activity).toBeNull();
    expect(completed.statuses.kidney_stone).toBeUndefined();
  });

  test('Realtime active care activity blocks care commands', () => {
    const initial = {
      ...run('realtime', 'active-blocking'),
      metrics: {
        food: 10,
        health: 10,
        mood: 5,
        rest: 7,
        bond: 5,
        creativity: 5,
      },
    } as GameState;
    const started = dispatchCommand(
      initial,
      { type: 'rest', commandId: 'active-rest', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(started.state.activity?.type).toBe('rest');
    for (const [index, command] of [
      { type: 'use_item' as const, itemId: 'water' },
      { type: 'socialize' as const },
      { type: 'play' as const },
    ].entries()) {
      const result = dispatchCommand(
        started.state,
        { ...command, commandId: `blocked-${index}`, now: 0 },
        BUNDLED_GAME_DEFINITION,
      );
      expect(result.outcomes[0]).toMatchObject({
        accepted: false,
        kind: 'activity_blocked',
      });
    }
  });
});
