import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import type { GameState, HealthDamageSource } from './game-types';
import { resolveHealthWindow } from './simulation/health-resolution';
import { resolvePostHealthRescues } from './simulation/post-health-rescue';
import {
  effectiveSugarExposure,
  resolveSugarCrashConsumption,
} from './status-rules/sugar-crash';
import {
  discountedMedicalDebtPrice,
  processDailyMedicalPayments,
} from './medical-debt-rules';
import { createGameViewModel } from './ui/game-view-model';

const HOUR = 3_600_000;

function run(seed = 'gameplay-spec', mode: GameState['mode'] = 'realtime') {
  return startRun(
    { mode, now: 0, seed, timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('survival safety nets', () => {
  test('caps combined need damage at two with stable applied attribution', () => {
    const metrics = {
      food: 0,
      health: 10,
      mood: 0,
      rest: 0,
      bond: 5,
      creativity: 5,
    };
    const result = resolveHealthWindow({
      health: 10,
      metricsAfterDecay: metrics,
      recoveryMetrics: metrics,
      foodDecayHit: true,
    });

    expect(result.damage).toBe(2);
    expect(result.sources).toEqual([
      expect.objectContaining({ id: 'starving', amount: 1 }),
      expect.objectContaining({ id: 'sleep_deprived', amount: 1 }),
    ]);
    expect(result.rawSources.map((source) => source.id)).toEqual([
      'starving',
      'sleep_deprived',
      'depressed',
    ]);
  });

  test('food rescue consumes owned food after damage and stays locked', () => {
    const initial = run('food-rescue');
    const state: GameState = {
      ...initial,
      metrics: { ...initial.metrics, food: 2, health: 20, rest: 5, mood: 5 },
      inventory: { uncrustables: 2 },
      history: { ...initial.history, pendingFoodDecayHit: true },
    };
    const result = reconcileTime(
      state,
      2 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    const damageIndex = result.events.findIndex(
      (event) => event.type === 'time_reconciled',
    );
    const rescueIndex = result.events.findIndex(
      (event) => event.type === 'autonomous_food_rescue',
    );

    expect(rescueIndex).toBeGreaterThan(damageIndex);
    expect(result.metrics.health).toBeLessThan(20);
    expect(result.inventory.uncrustables).toBe(1);
    expect(result.history.autonomousRescue.foodLocked).toBe(true);
  });

  test('Food resolves before Rest when both rescues are requested', () => {
    const initial = run('rescue-order');
    const state: GameState = {
      ...initial,
      metrics: { ...initial.metrics, food: 1, rest: 1, health: 20 },
      inventory: { ...initial.inventory, uncrustables: 1 },
    };
    const sources: HealthDamageSource[] = [
      {
        kind: 'status',
        id: 'starving',
        name: 'Starvation',
        amount: 1,
        eventIds: [],
      },
      {
        kind: 'status',
        id: 'sleep_deprived',
        name: 'Sleep deprivation',
        amount: 1,
        eventIds: [],
      },
    ];
    const result = resolvePostHealthRescues({
      state,
      definition: BUNDLED_GAME_DEFINITION,
      damageSources: sources,
      damageEventId: 'damage',
    }).state;
    const foodEvent = result.events.findIndex(
      (event) => event.type === 'autonomous_food_rescue',
    );
    const restEvent = result.events.findIndex(
      (event) =>
        event.type === 'activity_started' && event.rescueMetric === 'rest',
    );

    expect(foodEvent).toBeGreaterThanOrEqual(0);
    expect(restEvent).toBeGreaterThan(foodEvent);
    expect(result.activity?.type).toBe('rest');
    expect(result.history.autonomousRescue).toEqual({
      foodLocked: true,
      restLocked: true,
    });
  });

  test('a genuine player feed to five resets only the Food lock', () => {
    const initial = run('rescue-reset', 'streaming');
    const result = dispatchCommand(
      {
        ...initial,
        metrics: { ...initial.metrics, food: 3 },
        inventory: { ...initial.inventory, 'five-plain-tortillas': 1 },
        history: {
          ...initial.history,
          autonomousRescue: { foodLocked: true, restLocked: true },
        },
      },
      {
        type: 'use_item',
        commandId: 'player-feed-reset',
        itemId: 'five-plain-tortillas',
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.metrics.food).toBeGreaterThanOrEqual(5);
    expect(result.history.autonomousRescue).toEqual({
      foodLocked: false,
      restLocked: true,
    });
  });
});

describe('nutrition and medical obligations', () => {
  test('effective sugar is atomic and later protein cancels a pending crash', () => {
    const records = [
      {
        at: 0,
        itemId: 'sweet',
        salt: 0,
        water: 0,
        sugar: 5,
        protein: 2,
        sugarTagged: true,
      },
    ];
    expect(effectiveSugarExposure(records, 0)).toBe(3);
    const safe = resolveSugarCrashConsumption({
      consumptions: records,
      statuses: {},
      dueAt: null,
      now: 0,
    });
    expect(safe.dueAt).toBeNull();
    const scheduled = resolveSugarCrashConsumption({
      consumptions: [{ ...records[0], protein: 0 }],
      statuses: {},
      dueAt: null,
      now: 0,
    });
    expect(scheduled.transition).toBe('scheduled');
    const cancelled = resolveSugarCrashConsumption({
      consumptions: [
        ...records,
        { ...records[0], itemId: 'protein', sugar: 0, protein: 3 },
      ],
      statuses: {},
      dueAt: scheduled.dueAt,
      now: HOUR,
    });
    expect(cancelled).toMatchObject({ dueAt: null, transition: 'cancelled' });
  });

  test('Hospital locks insurance and creates a bill only on completion', () => {
    const initial = run('insured-hospital');
    const started = dispatchCommand(
      {
        ...initial,
        statuses: { kidney_stone: { since: 0, source: 'test' } },
        inventory: { ...initial.inventory, 'insurance-card': 1 },
        history: {
          ...initial.history,
          kidneyStoneFeeds: [
            {
              at: 0,
              itemId: 'salt',
              salt: 10,
              water: 0,
              protein: 0,
              sugar: 0,
              sugarTagged: false,
            },
          ],
        },
      },
      { type: 'medical_care', commandId: 'insured-hospital', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(started.balance).toBe(BUNDLED_GAME_DEFINITION.startingCurrency);
    expect(started.medicalDebt).toEqual([]);
    expect(started.activity?.payload).toMatchObject({
      insuredAtStart: true,
      principal: 500,
      scheduledDailyPayment: 25,
    });
    const completed = reconcileTime(
      started,
      12 * HOUR,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(completed.medicalDebt).toEqual([
      expect.objectContaining({ originalPrincipal: 500, insuredAtStart: true }),
    ]);
    expect(completed.history.kidneyStoneFeeds).toEqual([]);
  });

  test('daily payments do not overdraw and discounted payoff is all-or-nothing', () => {
    const initial = run('medical-payments');
    const bill = {
      id: 'bill-1',
      createdAt: 0,
      originalPrincipal: 500,
      remainingPrincipal: 500,
      scheduledDailyPayment: 150,
      insuredAtStart: false,
    };
    const due = {
      ...initial,
      balance: 100,
      medicalDebt: [bill],
      history: {
        ...initial.history,
        oncePerLocalDate: { medical_debt_payment: '1969-12-31' },
      },
    };
    const paid = processDailyMedicalPayments(due, 0).state;
    expect(paid.balance).toBe(0);
    expect(paid.medicalDebt[0].remainingPrincipal).toBe(400);

    const payoffState = { ...paid, balance: 1_000 };
    expect(discountedMedicalDebtPrice(payoffState)).toBe(340);
    const payoff = dispatchCommand(
      payoffState,
      { type: 'pay_medical_debt', commandId: 'payoff', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(payoff.balance).toBe(660);
    expect(payoff.medicalDebt).toEqual([]);
    expect(
      createGameViewModel(payoffState, BUNDLED_GAME_DEFINITION).medicalDebt,
    ).toMatchObject({ total: 400, discountedFullPayment: 340 });
  });
});
