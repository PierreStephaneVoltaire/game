import { expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { GameController } from '../game-controller';
import { GameplayCapture, type Operation } from './capture';
import { resolvedState } from './collector';
import {
  reconstructFragments,
  reconstructStream,
  verifyReconstruction,
} from './reconstruction';
import { fragments } from './batches';
import { committedSave } from '../persistence/replay';
import type { OutboxRecord } from '../persistence/types';
import { HOUR_MS } from '../game-constants';

const start = {
  mode: 'streaming' as const,
  seed: '00421873',
  now: 1_800_000_000_000,
  timezone: 'UTC',
};

test.each(['streaming', 'realtime'] as const)(
  'steps through resolved events during %s catch-up without rerunning rules',
  async (mode) => {
    const records: Operation[] = [];
    const controller = new GameController(
      { load: async () => definition },
      new GameplayCapture((operation) => records.push(operation)),
    );
    await controller.start({ ...start, mode });
    if (mode === 'realtime')
      await controller.reconcile(start.now + 3 * HOUR_MS);
    else
      await controller.dispatch({
        type: 'socialize',
        commandId: 'socialize',
        now: start.now,
      });
    const replay = verifyReconstruction(
      [...records].reverse(),
      controller.current!,
    );
    expect(replay.complete).toBe(true);
    const steps = replay.steps.filter((step) => step.eventId !== null);
    expect(steps.length).toBeGreaterThan(2);
    expect(
      new Set(steps.map((step) => step.operation.operationId)).size,
    ).toBeGreaterThan(1);
    expect(replay.state).toEqual(controller.current);
    const missing = records.findIndex((record) => record.kind === 'transition');
    expect(
      reconstructStream(records.filter((_, index) => index !== missing))
        .complete,
    ).toBe(false);
  },
);

test('offsetting effects and multiple narrative events preserve each atomic transition exactly once', async () => {
  const records: Operation[] = [];
  const capture = new GameplayCapture((record) => records.push(record));
  const controller = new GameController(
    { load: async () => definition },
    capture,
  );
  const initial = await controller.start(start);
  const after = capture.execute(
    'command',
    { type: 'test', commandId: 'atomic' },
    () => {
      const first = resolvedState({
        ...initial,
        balance: initial.balance + 4,
        events: [
          ...initial.events,
          {
            id: 'first',
            type: 'subscriber_revenue' as const,
            at: initial.now,
            message: 'first',
          },
          {
            id: 'same-effect',
            type: 'subscriber_revenue' as const,
            at: initial.now,
            message: 'same-effect',
          },
        ],
      });
      return resolvedState({
        ...first,
        balance: initial.balance,
        events: [
          ...first.events,
          {
            id: 'second',
            type: 'subscriber_revenue' as const,
            at: initial.now,
            message: 'second',
          },
        ],
      });
    },
    (state) => state,
    () => null,
    initial,
  );
  const replay = verifyReconstruction(records, after);
  expect(replay.complete).toBe(true);
  const events = replay.steps.filter((step) => step.eventId);
  expect(
    events.map((step) => [
      step.eventId,
      step.state.balance,
      step.appliesTransition,
    ]),
  ).toEqual([
    ['first', initial.balance + 4, true],
    ['same-effect', initial.balance + 4, false],
    ['second', initial.balance, true],
  ]);
  expect(
    verifyReconstruction(records, { ...after, balance: 999 }).complete,
  ).toBe(false);
  expect(reconstructStream([...records, records[1]]).state).toEqual(after);
});

test('a checkpoint after a gap restores later coverage without inventing the missing state', async () => {
  const records: Operation[] = [];
  const capture = new GameplayCapture((record) => records.push(record));
  const controller = new GameController(
    { load: async () => definition },
    capture,
  );
  await controller.start(start);
  await controller.dispatch({
    type: 'use_item',
    itemId: 'missing',
    commandId: 'refusal',
    now: start.now,
  });
  const checkpointAt = records.length;
  await controller.load(controller.current!);
  const replay = reconstructStream(records.filter((_, index) => index !== 1));
  expect(replay.complete).toBe(false);
  expect(replay.state).toEqual(controller.current);
  expect(
    replay.steps.some(
      (step) =>
        step.operation.operationId === records[checkpointAt].operationId,
    ),
  ).toBe(true);
  capture.marker(
    'stream_superseded',
    { supersededBatchIds: ['lost'] },
    controller.current!,
  );
  expect(reconstructStream(records).superseded).toBe(true);
});

test('legacy saves are acknowledged only when their committed state can be verified', async () => {
  const controller = new GameController({ load: async () => definition });
  const state = await controller.start(start);
  const pending: OutboxRecord = {
    batchId: 'batch',
    gameHash: state.seed,
    baseStateVersion: 0,
    contentVersion: definition.version,
    previousEventId: null,
    commands: [],
    events: state.events.map((event, index) => ({
      ...event,
      gameHash: state.seed,
      sequence: index + 1,
    })),
    targetState: state,
    createdAt: 0,
    retryCount: 0,
  };
  const remote = {
    gameHash: state.seed,
    stateVersion: 0,
    lastEventSequence: state.events.length,
    lastEventId: state.events.at(-1)!.id,
    state,
  };
  expect(committedSave(pending, remote)?.stateVersion).toBe(0);
  expect(
    committedSave(pending, {
      ...remote,
      state: JSON.parse(JSON.stringify(state)),
    })?.stateVersion,
  ).toBe(0);
  expect(
    committedSave(pending, {
      ...remote,
      state: { ...state, balance: state.balance + 1 },
    }),
  ).toBeNull();
});

test('reconstructs reordered Azure fragments and reports incomplete operations', async () => {
  const records: Operation[] = [];
  const controller = new GameController(
    { load: async () => definition },
    new GameplayCapture((record) => records.push(record)),
  );
  await controller.start(start);
  await controller.dispatch({
    type: 'use_item',
    itemId: 'missing',
    commandId: 'refused',
    now: start.now,
  });
  const final = records.at(-1)!;
  final.input = { evidence: 'x'.repeat(100_000) };
  const pieces = records.flatMap(fragments);
  const replay = reconstructFragments([...pieces].reverse());
  expect(replay.complete).toBe(true);
  expect(replay.state).toEqual(controller.current);
  expect(reconstructFragments([...pieces, pieces[0]]).state).toEqual(
    controller.current,
  );
  expect(
    reconstructFragments(
      pieces.filter(
        (fragment) =>
          fragment.operationId !== final.operationId || fragment.part !== 1,
      ),
    ).complete,
  ).toBe(false);
});
