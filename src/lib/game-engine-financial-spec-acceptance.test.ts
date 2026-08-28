import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import { debtBreakdown } from './financial-rules';
import { DAY_MS, HOUR_MS } from './game-constants';

function run() {
  return startRun(
    { mode: 'streaming', now: 0, seed: 'financial-spec', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('economy specification through the engine seam', () => {
  test('any ordinary catalogue item may be bought on credit', () => {
    const initial = run();
    const item = BUNDLED_GAME_DEFINITION.items.find(
      (candidate) => candidate.category === 'decoration',
    )!;
    const stocked = {
      ...initial,
      balance: 1,
      shop: {
        ...initial.shop,
        itemIds: [item.id],
        stock: { [item.id]: 1 },
      },
    };

    const result = dispatchCommand(
      stocked,
      {
        type: 'buy_item',
        commandId: 'credit-decoration',
        itemId: item.id,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'item_purchased',
    });
    expect(result.state.balance).toBe(1 - item.price);
  });

  test('LOC origination creates the complete obligation and In Debt status', () => {
    const result = dispatchCommand(
      run(),
      { type: 'open_line_of_credit', commandId: 'open-loc', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'line_of_credit_opened',
    });
    expect(result.state.balance).toBe(10_010);
    expect(result.state.lineOfCredit).toMatchObject({
      status: 'open',
      remainingUnits: 20,
      remainingClosureCost: 12_000,
      cumulativeOpenCharges: 0,
    });
    expect(debtBreakdown(result.state)).toEqual({
      negativeCash: 0,
      hospitalPrincipal: 0,
      locClosureCost: 12_000,
      otherFinancedPrincipal: 0,
      total: 12_000,
    });
    expect(result.state.statuses.in_debt).toBeDefined();
    expect(
      result.state.events.filter((event) => event.type === 'debt_status_entered'),
    ).toHaveLength(1);
  });

  test('LOC repayment cannot use credit and the twentieth unit closes it', () => {
    const opened = dispatchCommand(
      run(),
      { type: 'open_line_of_credit', commandId: 'open-loc', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const rejected = dispatchCommand(
      { ...opened, balance: 599 },
      {
        type: 'repay_line_of_credit',
        commandId: 'repay-unaffordable',
        quantity: 1,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(rejected.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'insufficient_funds',
    });
    expect(rejected.state.lineOfCredit).toEqual(opened.lineOfCredit);

    const closed = dispatchCommand(
      { ...opened, balance: 12_000 },
      {
        type: 'repay_line_of_credit',
        commandId: 'repay-all',
        quantity: 20,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(closed.state.balance).toBe(0);
    expect(closed.state.lineOfCredit).toMatchObject({ status: 'closed' });
    expect(closed.state.statuses.in_debt).toBeUndefined();
    expect(debtBreakdown(closed.state).total).toBe(0);
  });

  test('an open LOC charges exactly $1,000 at each later local midnight', () => {
    const opened = dispatchCommand(
      run(),
      { type: 'open_line_of_credit', commandId: 'open-loc', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    let nextDay = opened;
    while (nextDay.now < DAY_MS)
      nextDay = reconcileTime(
        nextDay,
        DAY_MS,
        BUNDLED_GAME_DEFINITION,
      ).state;

    expect(nextDay.lineOfCredit).toMatchObject({
      remainingUnits: 20,
      remainingClosureCost: 12_000,
      cumulativeOpenCharges: 1_000,
    });
    const charges = nextDay.events.filter(
      (event) => event.type === 'loc_open_charge',
    );
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({
      amount: -1_000,
      financialEffect: { cashDelta: -1_000 },
    });

    const replay = reconcileTime(nextDay, DAY_MS, BUNDLED_GAME_DEFINITION).state;
    expect(replay).toEqual(nextDay);
  });

  test('the operation crossing $20,000 total debt ends immediately', () => {
    const initial = run();
    const item = BUNDLED_GAME_DEFINITION.items.find(
      (candidate) => candidate.price >= 100,
    )!;
    const result = dispatchCommand(
      {
        ...initial,
        balance: 0,
        medicalDebt: [
          {
            id: 'medical-bill:test',
            createdAt: 0,
            originalPrincipal: 19_950,
            remainingPrincipal: 19_950,
            scheduledDailyPayment: 150,
            insuredAtStart: false,
          },
        ],
        shop: {
          ...initial.shop,
          itemIds: [item.id],
          stock: { [item.id]: 1 },
        },
      },
      {
        type: 'buy_item',
        commandId: 'ruin-purchase',
        itemId: item.id,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.state.ending).toMatchObject({
      kind: 'financial_ruin',
      cause: 'Insolvency',
      totalDebt: 19_950 + item.price,
      triggerEventId: expect.any(String),
    });
    expect(
      result.state.events.find((event) => event.type === 'run_ended'),
    ).toMatchObject({
      type: 'run_ended',
      endingKind: 'financial_ruin',
    });
  });

  test('Hospital principal enters debt status and can cause immediate ruin', () => {
    const initial = run();
    const result = dispatchCommand(
      {
        ...initial,
        metrics: { ...initial.metrics, health: 2 },
        statuses: { sick: { since: 0, source: 'test' } },
        medicalDebt: [
          {
            id: 'medical-bill:existing',
            createdAt: 0,
            originalPrincipal: 10_000,
            remainingPrincipal: 10_000,
            scheduledDailyPayment: 150,
            insuredAtStart: false,
          },
        ],
      },
      { type: 'medical_care', commandId: 'ruin-at-hospital', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );

    expect(result.state.ending).toMatchObject({
      kind: 'financial_ruin',
      cause: 'Insolvency',
      totalDebt: 20_000,
    });
    expect(result.state.ending?.eventIds).toContain(
      result.state.events.find(
        (event) => event.type === 'medical_debt_created',
      )?.id,
    );
  });

  test('positive income clears In Debt immediately when total debt recovers', () => {
    const initial = run();
    const recovered = reconcileTime(
      {
        ...initial,
        balance: -10_000,
        statuses: {
          in_debt: { since: 0, source: 'total_debt' },
        },
        history: {
          ...initial.history,
          nextAutonomousAt: 4 * HOUR_MS,
        },
      },
      2 * HOUR_MS,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(recovered.balance).toBe(-9_999);
    expect(recovered.statuses.in_debt).toBeUndefined();
    expect(
      recovered.events.filter(
        (event) => event.type === 'debt_status_recovered',
      ),
    ).toHaveLength(1);
  });
});
