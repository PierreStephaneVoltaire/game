import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import { dispatchCommand, startRun } from './game-engine';
import type { GameCommand, GameState } from './game-types';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 0, 2, 10);

type CommandInput = GameCommand extends infer Command
  ? Command extends GameCommand
    ? Omit<Command, 'now'>
    : never
  : never;

function streamingRun(seed: string, overrides: Partial<GameState> = {}) {
  const initial = startRun(
    { mode: 'streaming', now: NOW, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
  return {
    ...initial,
    metrics: { food: 6, health: 10, mood: 8, rest: 4, bond: 8, creativity: 8 },
    statuses: {},
    inventory: { water: 3, pretzel: 2 },
    ...overrides,
  } as GameState;
}

function dispatch(state: GameState, command: CommandInput) {
  return dispatchCommand(
    state,
    { ...command, now: state.now } as GameCommand,
    BUNDLED_GAME_DEFINITION,
  );
}

function stream(endsAt: number) {
  return {
    id: 'activity-stream',
    type: 'stream' as const,
    startedAt: NOW,
    endsAt,
    sourceActionId: 'scheduled-stream',
    payload: { ordinaryStream: true, hourlyRate: 10 },
  };
}

describe('Streaming clock ownership', () => {
  test('instant feeding adds no game time and launches no stream across many seeds', () => {
    for (let index = 0; index < 200; index += 1) {
      const initial = streamingRun(`instant-feed-${index}`);
      const single = dispatch(initial, {
        type: 'use_item',
        commandId: `water-${index}`,
        itemId: 'water',
      });
      const batch = dispatch(initial, {
        type: 'feed_items',
        commandId: `batch-${index}`,
        items: [
          { itemId: 'water', quantity: 2 },
          { itemId: 'pretzel', quantity: 1 },
        ],
      });
      for (const result of [single, batch]) {
        expect(result.state.now).toBe(NOW);
        expect(result.state.activity?.type).not.toBe('stream');
        expect(
          result.state.events.some(
            (event) =>
              event.type === 'stream_candidate' ||
              event.type === 'time_reconciled',
          ),
        ).toBe(false);
      }
    }
  });

  test('a refused Rest adds no game time', () => {
    const result = dispatch(
      streamingRun('refused-rest', {
        metrics: {
          food: 6,
          health: 10,
          mood: 8,
          rest: 10,
          bond: 8,
          creativity: 8,
        },
      }),
      { type: 'rest', commandId: 'refused-rest' },
    );
    expect(result.outcomes[0]).toMatchObject({ accepted: false });
    expect(result.state.now).toBe(NOW);
  });

  test.each(['rest', 'play', 'socialize'] as const)(
    '%s resolves to its own boundary without chaining another timed activity',
    (type) => {
      for (let index = 0; index < 100; index += 1) {
        const initial = streamingRun(`${type}-boundary-${index}`);
        const result = dispatch(initial, {
          type,
          commandId: `${type}-${index}`,
        });
        if (!result.outcomes[0]?.accepted) continue;
        const ending = result.state.events.find(
          (event) =>
            (event.type === 'activity_completed' ||
              event.type === 'activity_interrupted') &&
            event.activityType === type,
        );
        expect(ending).toBeDefined();
        expect(result.state.now).toBe(ending!.at);
        expect(
          result.state.events.filter(
            (event) =>
              event.type === 'activity_completed' ||
              event.type === 'activity_interrupted',
          ),
        ).toHaveLength(1);
        if (result.state.activity)
          expect(result.state.activity.startedAt).toBe(ending!.at);
      }
    },
  );

  test('Advance Time never leaves the companion busy when a stream runs past the endpoint', () => {
    const result = dispatch(
      streamingRun('spanning-stream', { activity: stream(NOW + 10 * HOUR) }),
      { type: 'wait', commandId: 'advance-3', hours: 3 },
    );
    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'waited',
    });
    expect(result.state.activity).toBeNull();
    expect(
      result.state.events.some(
        (event) =>
          (event.type === 'activity_completed' ||
            event.type === 'activity_interrupted') &&
          event.activityType === 'stream',
      ),
    ).toBe(true);
  });

  test('Advance Time completes a stream inside the interval at its own boundary', () => {
    const result = dispatch(
      streamingRun('contained-stream', {
        activity: stream(NOW + 2 * HOUR),
        metrics: {
          food: 8,
          health: 10,
          mood: 8,
          rest: 9,
          bond: 8,
          creativity: 8,
        },
      }),
      { type: 'wait', commandId: 'advance-3', hours: 3 },
    );
    const completion = result.state.events.find(
      (event) =>
        event.type === 'activity_completed' && event.activityType === 'stream',
    );
    expect(completion?.at).toBe(NOW + 2 * HOUR);
    expect(result.state.now).toBe(NOW + 3 * HOUR);
  });

  test('an exhausted Rest started during Advance Time resolves fully', () => {
    let rescued: GameState | undefined;
    for (let index = 0; index < 200 && !rescued; index += 1) {
      const result = dispatch(
        streamingRun(`exhausted-${index}`, {
          metrics: {
            food: 8,
            health: 10,
            mood: 8,
            rest: 3,
            bond: 8,
            creativity: 8,
          },
        }),
        { type: 'wait', commandId: `advance-${index}`, hours: 12 },
      );
      expect(result.state.activity).toBeNull();
      if (
        result.state.events.some(
          (event) =>
            event.type === 'activity_started' &&
            event.activityType === 'rest' &&
            !event.sourceActionId?.startsWith(`advance-${index}`),
        )
      )
        rescued = result.state;
    }
    expect(rescued).toBeDefined();
    expect(
      rescued!.events.some(
        (event) =>
          (event.type === 'activity_completed' ||
            event.type === 'activity_interrupted') &&
          event.activityType === 'rest',
      ),
    ).toBe(true);
  });
});
