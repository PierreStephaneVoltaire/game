import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import { debtBreakdown } from './financial-rules';
import { DAY_MS } from './game-constants';

function run() {
  return startRun(
    { mode: 'streaming', now: 0, seed: 'financial-spec', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('Line of Credit exact economy rules', () => {
  test('opening is cash-only and creates the complete obligation', () => {
    const unaffordable = dispatchCommand(
      { ...run(), balance: 49 },
      { type: 'open_line_of_credit', commandId: 'open-too-early', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(unaffordable.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'insufficient_funds',
    });

    const result = dispatchCommand(
      { ...run(), balance: 2_050 },
      { type: 'open_line_of_credit', commandId: 'open-loc', now: 0 },
      BUNDLED_GAME_DEFINITION,
    );
    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'line_of_credit_opened',
    });
    expect(result.state.balance).toBe(12_000);
    expect(result.state.lineOfCredit).toMatchObject({
      status: 'open',
      remainingUnits: 20,
      remainingClosureCost: 12_000,
    });
    expect(debtBreakdown(result.state)).toEqual({
      negativeCash: 0,
      hospitalPrincipal: 0,
      locClosureCost: 12_000,
      otherFinancedPrincipal: 0,
      total: 12_000,
    });
    expect(result.state.statuses.in_debt).toBeDefined();
  });

  test('repayment cannot use credit and the twentieth unit closes it', () => {
    const opened = dispatchCommand(
      { ...run(), balance: 650 },
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

  test('an open LOC has no time-based cash charge', () => {
    const opened = dispatchCommand(
      { ...run(), balance: 50 },
      { type: 'open_line_of_credit', commandId: 'open-loc', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    let nextDay = opened;
    while (nextDay.lastResolvedAt < DAY_MS)
      nextDay = reconcileTime(nextDay, DAY_MS, BUNDLED_GAME_DEFINITION, {
        preventLethalDecay: true,
      }).state;

    expect(nextDay.lineOfCredit).toMatchObject({
      remainingUnits: 20,
      remainingClosureCost: 12_000,
    });
    expect(nextDay.balance).toBeGreaterThanOrEqual(opened.balance);
    expect(
      nextDay.events.some((event) => event.type === 'loc_open_charge'),
    ).toBe(false);
    expect(
      reconcileTime(nextDay, DAY_MS, BUNDLED_GAME_DEFINITION).state,
    ).toEqual(nextDay);
  });

  test('opening and immediately clearing costs exactly $2,050', () => {
    const opened = dispatchCommand(
      { ...run(), balance: 2_050 },
      { type: 'open_line_of_credit', commandId: 'open-loc', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const closed = dispatchCommand(
      opened,
      {
        type: 'repay_line_of_credit',
        commandId: 'repay-all',
        quantity: 20,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(closed.balance).toBe(0);
    expect(closed.lineOfCredit).toMatchObject({ status: 'closed' });
    expect(debtBreakdown(closed).total).toBe(0);
  });

  test('nineteen repayments leave exactly one $600 unit outstanding', () => {
    const opened = dispatchCommand(
      { ...run(), balance: 60_000 },
      { type: 'open_line_of_credit', commandId: 'open-loc', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const partial = dispatchCommand(
      opened,
      {
        type: 'repay_line_of_credit',
        commandId: 'repay-19',
        quantity: 19,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(partial.balance).toBe(58_550);
    expect(partial.lineOfCredit).toMatchObject({
      status: 'open',
      remainingUnits: 1,
      remainingClosureCost: 600,
    });
    const final = dispatchCommand(
      partial,
      {
        type: 'repay_line_of_credit',
        commandId: 'repay-final',
        quantity: 1,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(final.lineOfCredit).toMatchObject({ status: 'closed' });
  });
});
