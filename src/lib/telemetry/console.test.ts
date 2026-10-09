import { afterEach, describe, expect, test, vi } from 'vitest';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { GameController } from '../game-controller';
import { GameplayCapture, type Operation } from './capture';
import { consoleGameplaySink } from './console';
import { resolvedState } from './collector';

const start = {
  mode: 'streaming' as const,
  now: 1_800_000_000_000,
  seed: '00421873',
  timezone: 'America/Toronto',
};
const repository = { load: async () => definition };
const output = vi.spyOn(console, 'log').mockImplementation(() => {});

afterEach(() => {
  output.mockImplementation(() => {});
  output.mockClear();
});

function records() {
  return output.mock.calls.map(([message, detail]) => ({
    message: String(message),
    detail: detail as Record<string, unknown> | undefined,
  }));
}

describe('console gameplay diagnostics', () => {
  test('retains both applied changes when metric effects cancel within one action', async () => {
    const capture = new GameplayCapture(consoleGameplaySink());
    const controller = new GameController(repository, capture);
    const before = await controller.start(start);
    output.mockClear();
    capture.execute(
      'command',
      { type: 'wait', commandId: 'offsets' },
      () => {
        resolvedState({
          ...before,
          metrics: { ...before.metrics, mood: before.metrics.mood - 1 },
        });
        return resolvedState({ ...before, metrics: { ...before.metrics } });
      },
      (state) => state,
      () => [],
      before,
    );
    const changes = records().filter((line) => line.detail?.metric === 'mood');
    expect(changes.map((line) => line.detail?.delta)).toEqual([-1, 1]);
    expect(changes.map((line) => line.detail?.commandId)).toEqual([
      'offsets',
      'offsets',
    ]);
    expect(changes.map((line) => line.detail?.after)).toEqual([
      before.metrics.mood - 1,
      before.metrics.mood,
    ]);
  });

  test('logs metric deltas, events, and command outcomes while preserving gameplay', async () => {
    const controller = new GameController(
      repository,
      new GameplayCapture(consoleGameplaySink()),
    );
    const plain = new GameController(repository);
    await controller.start(start);
    await plain.start(start);
    const initial = {
      ...controller.current!,
      metrics: {
        food: 6,
        health: 80,
        mood: 6,
        rest: 6,
        bond: 6,
        creativity: 6,
      },
    };
    await controller.load(initial);
    await plain.load(structuredClone(initial));
    output.mockClear();

    const wait = {
      type: 'wait' as const,
      hours: 3,
      commandId: 'console-wait',
      now: initial.now,
    };
    expect(await controller.dispatch(wait)).toEqual(await plain.dispatch(wait));
    const activity = {
      type: 'socialize' as const,
      commandId: 'console-socialize',
      now: controller.current!.now,
    };
    expect(await controller.dispatch(activity)).toEqual(
      await plain.dispatch(activity),
    );

    const lines = records();
    const metricLines = lines.filter((line) =>
      line.message.startsWith('[gameplay] metric '),
    );
    expect(metricLines.some((line) => line.message.includes(' +'))).toBe(true);
    expect(metricLines.some((line) => line.message.includes(' -'))).toBe(true);
    const operations: Operation[] = [];
    const capture = new GameplayCapture((operation) =>
      operations.push(operation),
    );
    const replay = new GameController(repository, capture);
    await replay.load(structuredClone(initial));
    await replay.dispatch(wait);
    await replay.dispatch(activity);
    const eventIds = operations.flatMap((operation) =>
      operation.checkpoint
        ? []
        : ((operation.input as { eventIds?: string[] } | null)?.eventIds ?? []),
    );
    const loggedEventIds = lines
      .filter((line) => line.message.startsWith('[gameplay] event '))
      .map((line) => (line.detail?.event as { id: string }).id);
    expect(eventIds.length).toBeGreaterThan(0);
    expect(loggedEventIds).toEqual(eventIds);
    expect(
      lines.filter((line) => line.message === '[gameplay] command'),
    ).toHaveLength(2);
    expect(
      lines
        .filter((line) => line.message === '[gameplay] command')
        .map((line) => (line.detail?.input as { commandId: string }).commandId),
    ).toEqual(['console-wait', 'console-socialize']);
  });

  test('checkpoints and save markers do not replay event history', async () => {
    const controller = new GameController(
      repository,
      new GameplayCapture(consoleGameplaySink()),
    );
    await controller.start(start);
    const state = controller.current!;
    output.mockClear();
    await controller.load(structuredClone(state));
    controller.capture!.marker(
      'save_confirmed',
      { saveBatchId: 'saved' },
      state,
    );
    expect(
      records().filter((line) => line.message.startsWith('[gameplay] event ')),
    ).toEqual([]);
  });

  test('refused commands retain their outcome and logging failures do not affect play', async () => {
    const controller = new GameController(
      repository,
      new GameplayCapture(consoleGameplaySink()),
    );
    const plain = new GameController(repository);
    await controller.start(start);
    await plain.start(start);
    output.mockClear();
    const refusal = {
      type: 'use_item' as const,
      itemId: 'missing-item',
      commandId: 'console-refusal',
      now: start.now,
    };
    const actual = await controller.dispatch(refusal);
    expect(actual).toEqual(await plain.dispatch(refusal));
    expect(actual.outcomes.some((outcome) => !outcome.accepted)).toBe(true);
    expect(
      records().find((line) => line.message === '[gameplay] command')?.detail
        ?.outcomes,
    ).toEqual(actual.outcomes);

    output.mockImplementation(() => {
      throw new Error('console unavailable');
    });
    expect(
      await controller.dispatch({
        type: 'wait',
        commandId: 'console-throwing',
        now: controller.current!.now,
      }),
    ).toEqual(
      await plain.dispatch({
        type: 'wait',
        commandId: 'console-throwing',
        now: plain.current!.now,
      }),
    );
  });
});
