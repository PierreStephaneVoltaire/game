import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameState } from './game-types';
import { projectJourney } from './ui/journey-events';

const HOUR = 3_600_000;

function activityState(
  seed: string,
  mode: 'streaming' | 'realtime' = 'streaming',
) {
  const state = startRun(
    { mode, now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
  return {
    ...state,
    metrics: {
      food: 10,
      health: 10,
      mood: 5,
      rest: 10,
      bond: 4,
      creativity: 5,
    },
    history: { ...state.history, nextAutonomousAt: 100 * HOUR },
  };
}

describe('Socialize and Play care effects', () => {
  test('only Play can cause Overstimulated through its primary Mood reward', () => {
    const seed = 'overstimulation-activity-identity-0';
    const initial = activityState(seed);
    const highMood = {
      ...initial,
      metrics: { ...initial.metrics, mood: 9 },
    };
    const socialized = dispatchCommand(
      highMood,
      { type: 'socialize', commandId: 'high-mood-socialize-0', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const played = dispatchCommand(
      highMood,
      { type: 'play', commandId: 'high-mood-play-0', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const socialCompletion = socialized.events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.activityType === 'socialize',
    )!;
    const playCompletion = played.events.find(
      (event) =>
        event.type === 'activity_completed' && event.activityType === 'play',
    )!;

    expect(
      socialized.events.some(
        (event) =>
          event.status === 'overstimulated' && event.at === socialCompletion.at,
      ),
    ).toBe(false);
    expect(
      played.events.some(
        (event) =>
          event.status === 'overstimulated' && event.at === playCompletion.at,
      ),
    ).toBe(true);
  });

  test.each(['play', 'socialize'] as const)(
    'a refused %s attempt selects no outcome and grants no reward',
    (type) => {
      let refused: ReturnType<typeof dispatchCommand> | undefined;
      for (let index = 0; index < 200 && !refused; index += 1) {
        const initial = activityState(`vignette-refusal-${type}-${index}`);
        const state: GameState = {
          ...initial,
          metrics: { ...initial.metrics, mood: 2, rest: 2 },
          statuses: { annoyed: { since: 0, source: 'test' } },
        };
        const result = dispatchCommand(
          state,
          {
            type,
            commandId: `vignette-refusal-${type}-${index}`,
            now: 0,
          },
          BUNDLED_GAME_DEFINITION,
        );
        if (result.outcomes[0]?.kind === 'refused') refused = result;
      }

      expect(refused?.outcomes[0]?.accepted).toBe(false);
      expect(
        refused?.state.events.some(
          (event) =>
            event.activityType === type && event.activityOutcome !== undefined,
        ),
      ).toBe(false);
    },
  );

  test('a refused repeat preserves the attempt-based streak and suppresses the next primary reward', () => {
    const first = dispatchCommand(
      activityState('refused-repeat-streak'),
      { type: 'play', commandId: 'repeat-accepted-first', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const playReadyAt = first.history.interactionCooldowns!.play!;
    let refused: GameState | undefined;
    for (let index = 0; index < 200 && !refused; index += 1) {
      const attempted = dispatchCommand(
        {
          ...first,
          metrics: { ...first.metrics, mood: 2, rest: 2 },
          statuses: { annoyed: { since: first.now, source: 'test' } },
        },
        {
          type: 'play',
          commandId: `repeat-refused-${index}`,
          now: playReadyAt,
        },
        BUNDLED_GAME_DEFINITION,
      );
      if (attempted.outcomes[0]?.kind === 'refused') refused = attempted.state;
    }
    const restored: GameState = {
      ...refused!,
      metrics: { ...refused!.metrics, mood: 5, rest: 10 },
      statuses: {},
    };
    const third = dispatchCommand(
      restored,
      { type: 'play', commandId: 'repeat-accepted-third', now: restored.now },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const completion = third.events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.sourceActionId === 'repeat-accepted-third',
    );

    expect(completion?.metricDeltas).toEqual({ mood: 0, bond: 1 });
  });

  test('a Play in progress from an older save is interrupted without reward', () => {
    const initial = activityState('interrupted-legacy-play', 'realtime');
    const started: GameState = {
      ...initial,
      activity: {
        id: 'activity-legacy',
        type: 'play',
        startedAt: 0,
        endsAt: 3 * HOUR,
        sourceActionId: 'interrupted-legacy-play',
        payload: {
          activityOutcome: 'normal',
          startingRest: initial.metrics.rest,
          startingMood: initial.metrics.mood,
          startingCriticalMetrics: '',
        },
      },
    };
    const interrupted = reconcileTime(
      {
        ...started,
        metrics: { ...started.metrics, food: 1 },
      },
      HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const event = interrupted.events.find(
      (candidate) =>
        candidate.type === 'activity_interrupted' &&
        candidate.activityType === 'play',
    );

    expect(event?.metricDeltas).toEqual({});
    expect(
      projectJourney(interrupted.events, 'Nova').some(
        (entry) => entry.message === event?.message,
      ),
    ).toBe(false);
  });

  test.each(['play', 'socialize'] as const)(
    '%s resolves instantly and only locks itself until its cooldown passes',
    (type) => {
      const other = type === 'play' ? 'socialize' : 'play';
      const first = dispatchCommand(
        activityState(`cooldown-${type}`, 'realtime'),
        { type, commandId: `cooldown-${type}-first`, now: 0 },
        BUNDLED_GAME_DEFINITION,
      );
      const readyAt = first.state.history.interactionCooldowns![type]!;
      const blocked = dispatchCommand(
        first.state,
        { type, commandId: `cooldown-${type}-blocked`, now: readyAt - 1 },
        BUNDLED_GAME_DEFINITION,
      );
      const otherAction = dispatchCommand(
        first.state,
        { type: other, commandId: `cooldown-${type}-other`, now: 1 },
        BUNDLED_GAME_DEFINITION,
      );
      const ready = dispatchCommand(
        first.state,
        { type, commandId: `cooldown-${type}-ready`, now: readyAt },
        BUNDLED_GAME_DEFINITION,
      );

      expect(first.outcomes[0]?.accepted).toBe(true);
      expect(first.state.activity).toBeNull();
      expect(first.state.now).toBe(0);
      expect(readyAt).toBeGreaterThan(0);
      expect(blocked.outcomes[0]?.kind).toBe('cooldown');
      expect(otherAction.outcomes[0]?.kind).not.toBe('cooldown');
      expect(otherAction.outcomes[0]?.kind).not.toBe('activity_blocked');
      expect(ready.outcomes[0]?.kind).not.toBe('cooldown');
    },
  );

  test('Hyperfocus still pins Creativity while Socialize awards Bond', () => {
    const initial = activityState('hyperfocus-socialize');
    const result = dispatchCommand(
      {
        ...initial,
        timedEffects: { ...initial.timedEffects, hyperfocusUntil: 24 * HOUR },
      },
      { type: 'socialize', commandId: 'hyperfocus-socialize', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const completion = result.events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.sourceActionId === 'hyperfocus-socialize',
    );

    expect(result.metrics.creativity).toBe(10);
    expect(completion?.metricDeltas?.bond).toBe(1);
  });
});
