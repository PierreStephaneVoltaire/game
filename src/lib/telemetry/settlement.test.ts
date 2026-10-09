import { expect, test } from 'vitest';
import { GameController } from '../game-controller';
import { BUNDLED_GAME_DEFINITION } from '../test-game-definition';
import { GameplayCapture, type Operation } from './capture';
import { verifyReconstruction } from './reconstruction';
import { completeActivity } from '../simulation/activity-completion';
import { HOUR_MS } from '../game-constants';

const start = {
  mode: 'realtime' as const,
  seed: '00421873',
  now: 1_800_000_000_000,
  timezone: 'UTC',
};

test.each([false, true])(
  'records stream settlements and interruptions (%s) without changing their results',
  async (interrupted) => {
    const definition = structuredClone(BUNDLED_GAME_DEFINITION);
    definition.simulationRules.stream.donations.baseChance = 1;
    const records: Operation[] = [];
    const capture = new GameplayCapture((record) => records.push(record));
    const controller = new GameController(
      { load: async () => definition },
      capture,
    );
    const base = await controller.start(start);
    const state = { ...base, now: base.now + 3 * HOUR_MS };
    await controller.load(state);
    const activity = {
      id: 'stream',
      type: 'stream' as const,
      sourceActionId: 'stream',
      startedAt: base.now,
      endsAt: state.now,
      payload: { hourlyRate: 4, ordinaryStream: true },
    };
    const run = () =>
      completeActivity({
        state,
        activity,
        reconciliationNow: state.now,
        definition,
        interrupted,
      });
    const plain = run();
    const logged = capture.execute(
      'clock_reconciled',
      { now: state.now },
      run,
      (result) => result.state,
      () => null,
      state,
    );
    expect(logged).toEqual(plain);
    const replay = verifyReconstruction(records, logged.state);
    expect(replay.complete).toBe(true);
    const donations = replay.steps.filter(
      (step) =>
        step.eventId &&
        step.state.events.find((event) => event.id === step.eventId)?.type ===
          'donation_received',
    );
    expect(donations).toHaveLength(3);
    expect(donations[1].state.balance).toBeGreaterThan(
      donations[0].state.balance,
    );
    expect(donations[2].state.balance).toBeGreaterThan(
      donations[1].state.balance,
    );
    expect(
      logged.state.events.some(
        (event) =>
          event.type ===
          (interrupted ? 'activity_interrupted' : 'activity_completed'),
      ),
    ).toBe(true);
    const position = capture.position(logged.state);
    capture.marker(
      'save_confirmed',
      { saveBatchId: 'saved' },
      structuredClone(logged.state),
      position,
    );
    expect(records.at(-1)?.input).toMatchObject({
      targetOperationId: position?.operationId,
      targetStreamId: capture.streamId,
    });
  },
);
