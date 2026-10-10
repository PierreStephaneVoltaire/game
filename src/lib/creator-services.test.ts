import { describe, expect, test } from 'vitest';

import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import { settleDueVentures } from './commands/creator-services';
import { streamWeightDiagnostics } from './stream-rules';
import {
  BUNDLED_GAME_DEFINITION,
  type GameDefinition,
} from './test-game-definition';
import type { CreatorVenture, GameState } from './game-types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function run(seed: string, definition = BUNDLED_GAME_DEFINITION): GameState {
  const initial = startRun(
    { mode: 'realtime', now: 0, seed, timezone: 'UTC' },
    definition,
  );
  return {
    ...initial,
    metrics: {
      food: 8,
      health: 24,
      mood: 5,
      rest: 8,
      bond: 5,
      creativity: 5,
    },
  };
}

function withService(
  itemId: string,
  update: (
    service: NonNullable<
      NonNullable<
        GameDefinition['items'][number]['itemActions']
      >[number]['service']
    >,
  ) => void,
): GameDefinition {
  const definition = structuredClone(BUNDLED_GAME_DEFINITION);
  const service = definition.items.find((item) => item.id === itemId)
    ?.itemActions?.[0]?.service;
  if (!service) throw new Error(`Missing service on ${itemId}`);
  update(service);
  return definition;
}

function launch(
  state: GameState,
  itemId: string,
  action: string,
  definition = BUNDLED_GAME_DEFINITION,
  commandId = `${itemId}-launch`,
) {
  return dispatchCommand(
    { ...state, inventory: { ...state.inventory, [itemId]: 1 } },
    { type: 'perform_item_action', commandId, itemId, action, now: 0 },
    definition,
  );
}

function merchRun(state: GameState) {
  const venture = state.ventures?.find(
    (candidate): candidate is Extract<CreatorVenture, { type: 'merch_run' }> =>
      candidate.type === 'merch_run',
  );
  if (!venture) throw new Error('Expected an active merch run.');
  return venture;
}

describe('merch runs', () => {
  test('consumes the item and pays the rolled total over its payout days', () => {
    const definition = withService('merch-run-small', (service) => {
      service.flopChance = 0;
      service.payoutDays = 3;
    });
    const started = launch(
      run('merch-pays'),
      'merch-run-small',
      'launch_merch_run',
      definition,
    );
    expect(started.outcomes[0].accepted).toBe(true);
    expect(started.state.inventory['merch-run-small']).toBe(0);
    const venture = merchRun(started.state);
    expect(venture.totalPayout).toBeGreaterThanOrEqual(3000 * 1.2);
    expect(venture.totalPayout).toBeLessThanOrEqual(3000 * 1.4);
    expect(venture.nextPayoutAt).toBe(DAY);

    const afterFirstDay = settleDueVentures(started.state, DAY);
    expect(afterFirstDay.balance - started.state.balance).toBe(
      Math.floor(venture.totalPayout / 3),
    );
    const finished = settleDueVentures(started.state, 3 * DAY);
    expect(finished.balance - started.state.balance).toBe(venture.totalPayout);
    expect(finished.ventures).toEqual([]);
    expect(finished.events.at(-1)).toMatchObject({
      type: 'merch_run_completed',
      amount: venture.totalPayout,
    });
  });

  test('a flop pays half the price back and costs Mood', () => {
    const definition = withService('merch-run-small', (service) => {
      service.flopChance = 1;
    });
    const before = run('merch-flop');
    const started = launch(
      before,
      'merch-run-small',
      'launch_merch_run',
      definition,
    ).state;
    expect(merchRun(started)).toMatchObject({
      flopped: true,
      totalPayout: 1500,
    });
    expect(started.metrics.mood).toBe(before.metrics.mood - 1);
  });

  test('allows only one active merch run', () => {
    const first = launch(
      run('merch-single'),
      'merch-run-small',
      'launch_merch_run',
    ).state;
    const second = launch(
      first,
      'merch-run-full',
      'launch_merch_run',
      BUNDLED_GAME_DEFINITION,
      'second-merch',
    );
    expect(second.outcomes[0]).toMatchObject({ accepted: false });
    expect(second.state.ventures).toHaveLength(1);
  });

  test('the first payout lands through ordinary time reconciliation', () => {
    const started = launch(
      run('merch-reconcile'),
      'merch-run-small',
      'launch_merch_run',
    ).state;
    const reconciled = reconcileTime(
      started,
      DAY + HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(
      reconciled.events.some((event) => event.type === 'merch_run_payout'),
    ).toBe(true);
    expect(merchRun(reconciled).daysPaid).toBe(1);
  });
});

describe('convention appearances', () => {
  test('grants the tier subscriber burst, Mood, and Rest at the next midnight', () => {
    const before = run('convention');
    const started = launch(before, 'convention-major', 'attend_convention');
    expect(started.outcomes[0].accepted).toBe(true);
    const reconciled = reconcileTime(
      started.state,
      DAY + HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const growth = reconciled.events.find(
      (event) => event.type === 'convention_audience_growth',
    );
    expect(growth?.followerDelta).toBe(
      Math.max(400, Math.round(before.progression.peakFollowers * 0.08)),
    );
    expect(
      reconciled.events.find((event) => event.type === 'convention_completed'),
    ).toMatchObject({ metricDeltas: { mood: 2, rest: -2 } });
    expect(reconciled.ventures).toEqual([]);
  });

  test('each convention tier can be bought once per run', () => {
    for (const id of [
      'convention-local',
      'convention-regional',
      'convention-major',
    ])
      expect(
        BUNDLED_GAME_DEFINITION.items.find((item) => item.id === id),
      ).toMatchObject({ maximumLifetimePurchases: 1 });
  });
});

describe('lost voice', () => {
  function longStream(definition: GameDefinition, hours: number) {
    const initial = run('lost-voice', definition);
    return reconcileTime(
      {
        ...initial,
        activity: {
          id: 'long-stream',
          type: 'stream',
          startedAt: 0,
          endsAt: hours * HOUR,
          sourceActionId: 'long-stream',
        },
      },
      hours * HOUR,
      definition,
    ).state;
  }

  function certainLostVoice(): GameDefinition {
    const definition = structuredClone(BUNDLED_GAME_DEFINITION);
    definition.simulationRules.lostVoice.probability = 1;
    return definition;
  }

  test('a stream over eight hours can take the voice for 24 to 48 hours', () => {
    const state = longStream(certainLostVoice(), 10);
    const record = state.statuses.lost_voice;
    expect(record).toBeDefined();
    const passHours = ((record?.naturalPassAt ?? 0) - 10 * HOUR) / HOUR;
    expect(passHours).toBeGreaterThanOrEqual(24);
    expect(passHours).toBeLessThanOrEqual(48);
    expect(streamWeightDiagnostics(state, 'check').streamBlockers).toContain(
      'lost_voice',
    );
  });

  test('streams of eight hours or less never cause it', () => {
    expect(
      longStream(certainLostVoice(), 8).statuses.lost_voice,
    ).toBeUndefined();
  });

  test('passes naturally at its seeded boundary', () => {
    const definition = certainLostVoice();
    const state = longStream(definition, 10);
    const passAt = state.statuses.lost_voice?.naturalPassAt ?? 0;
    const later = reconcileTime(state, passAt + HOUR, definition).state;
    expect(later.statuses.lost_voice).toBeUndefined();
  });

  test.each([['honey'], ['tea']])('%s clears it', (itemId) => {
    const definition = certainLostVoice();
    const state = longStream(definition, 10);
    const fed = dispatchCommand(
      {
        ...state,
        metrics: { ...state.metrics, food: 4 },
        inventory: { [itemId]: 1 },
      },
      { type: 'use_item', commandId: `${itemId}-cure`, itemId, now: state.now },
      definition,
    ).state;
    expect(fed.statuses.lost_voice).toBeUndefined();
  });
});
