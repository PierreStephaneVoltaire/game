import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';
import type { GameEvent, GameState } from './game-types';
import { projectJourney } from './ui/journey-events';

function activityState(seed: string): GameState {
  const state = startRun(
    { mode: 'streaming', now: 0, seed, timezone: 'UTC' },
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
  };
}

function completeActivity(
  type: 'socialize' | 'play',
  seed: string,
  commandId = `${type}-${seed}`,
) {
  const state = dispatchCommand(
    activityState(seed),
    { type, commandId, now: 0 },
    BUNDLED_GAME_DEFINITION,
  ).state;
  return {
    state,
    event: state.events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.sourceActionId === commandId,
    )!,
  };
}

function findOutcome(
  type: 'socialize' | 'play',
  outcome: 'normal' | 'strong',
): { state: GameState; event: GameEvent } {
  for (let index = 0; index < 2_000; index += 1) {
    const result = completeActivity(type, `${type}-${outcome}-${index}`);
    if (result.event.activityOutcome === outcome) return result;
  }
  throw new Error(`No ${outcome} ${type} outcome found`);
}

function repeatedCompletions(type: 'socialize' | 'play', seed: string) {
  const first = dispatchCommand(
    activityState(seed),
    { type, commandId: `${seed}-first`, now: 0 },
    BUNDLED_GAME_DEFINITION,
  ).state;
  const second = dispatchCommand(
    first,
    { type, commandId: `${seed}-second`, now: first.now },
    BUNDLED_GAME_DEFINITION,
  ).state;
  return {
    state: second,
    event: second.events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.sourceActionId === `${seed}-second`,
    )!,
  };
}

describe('Socialize and Play activity vignettes', () => {
  test.each([['play', 'mood'] as const, ['socialize', 'creativity'] as const])(
    '%s awards Bond and its distinct primary stat',
    (type, primary) => {
      const normal = findOutcome(type, 'normal');
      const strong = findOutcome(type, 'strong');

      expect(normal.event.metricDeltas).toEqual({ [primary]: 1, bond: 1 });
      expect(strong.event.metricDeltas).toEqual({ [primary]: 2, bond: 1 });
      expect(normal.event.activityNarration).toBeTruthy();
      expect(strong.event.activityNarration).toBeTruthy();
      expect(
        projectJourney(strong.state.events, 'Nova').some(
          (entry) =>
            entry.message ===
            strong.event.activityNarration?.replace(/^Companion\b/, 'Nova'),
        ),
      ).toBe(true);
    },
  );

  test.each([['play', 'mood'] as const, ['socialize', 'creativity'] as const])(
    'repeated %s keeps Bond and its selected vignette but suppresses its primary reward',
    (type, primary) => {
      let repeated: ReturnType<typeof repeatedCompletions> | undefined;
      for (let index = 0; index < 2_000 && !repeated; index += 1) {
        const result = repeatedCompletions(
          type,
          `strong-repeat-${type}-${index}`,
        );
        if (result.event.activityOutcome === 'strong') repeated = result;
      }

      expect(repeated?.event.metricDeltas).toEqual({ [primary]: 0, bond: 1 });
      expect(repeated?.event.activityNarration).toBeTruthy();
      expect(
        projectJourney(repeated!.state.events, 'Nova').some(
          (entry) =>
            entry.message ===
            repeated!.event.activityNarration?.replace(/^Companion\b/, 'Nova'),
        ),
      ).toBe(true);
    },
  );

  test('switching interaction types restores the next primary reward', () => {
    const initial = activityState('switching-actions');
    const firstPlay = dispatchCommand(
      initial,
      { type: 'play', commandId: 'switch-play-one', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const socialize = dispatchCommand(
      firstPlay,
      {
        type: 'socialize',
        commandId: 'switch-socialize',
        now: firstPlay.now,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const secondPlay = dispatchCommand(
      socialize,
      {
        type: 'play',
        commandId: 'switch-play-two',
        now: socialize.now,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const completion = secondPlay.events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.sourceActionId === 'switch-play-two',
    );

    expect(completion?.metricDeltas?.mood).toBeGreaterThanOrEqual(1);
    expect(completion?.metricDeltas?.bond).toBe(1);
  });

  test('the same accepted action replays the same strength and vignette', () => {
    const first = completeActivity(
      'socialize',
      'seeded-vignette-replay',
      'seeded-vignette-command',
    ).event;
    const second = completeActivity(
      'socialize',
      'seeded-vignette-replay',
      'seeded-vignette-command',
    ).event;

    expect(second.activityOutcome).toBe(first.activityOutcome);
    expect(second.activityNarration).toBe(first.activityNarration);
    expect(second.metricDeltas).toEqual(first.metricDeltas);
  });

  test.each(['play', 'socialize'] as const)(
    '%s selects from nine normal and three strong authored vignettes',
    (type) => {
      const normal = new Set<string>();
      const strong = new Set<string>();
      for (
        let index = 0;
        index < 400 && (normal.size < 9 || strong.size < 3);
        index += 1
      ) {
        const event = completeActivity(
          type,
          `vignette-pool-${type}-${index}`,
        ).event;
        const pool = event.activityOutcome === 'strong' ? strong : normal;
        pool.add(event.activityNarration!);
      }

      expect(normal.size).toBe(9);
      expect(strong.size).toBe(3);
    },
  );
});
