import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import { debtBreakdown } from './financial-rules';
import { DAY_MS, LINE_OF_CREDIT_OFFER_ID } from './game-constants';

function run() {
  return startRun(
    { mode: 'streaming', now: 0, seed: 'financial-spec', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

function checkoutLoc(
  state: ReturnType<typeof run>,
  quantity: number,
  id: string,
) {
  const inCart = dispatchCommand(
    state,
    {
      type: 'set_cart_quantity',
      commandId: `${id}:quantity`,
      itemId: LINE_OF_CREDIT_OFFER_ID,
      quantity,
      now: state.now,
    },
    BUNDLED_GAME_DEFINITION,
  ).state;
  return dispatchCommand(
    inCart,
    { type: 'checkout_cart', commandId: `${id}:checkout`, now: state.now },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('Line of Credit exact economy rules', () => {
  test('opens through checkout from the initial $20 without activating In Debt', () => {
    const result = checkoutLoc(run(), 1, 'open-loc');
    expect(result.outcomes[0]).toMatchObject({
      accepted: true,
      kind: 'cart_checked_out',
    });
    expect(result.state.balance).toBe(9_970);
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
    expect(result.state.statuses.in_debt).toBeUndefined();
  });

  test('settles a mixed opening cart atomically with its real resulting Balance', () => {
    const initial = run();
    const water = BUNDLED_GAME_DEFINITION.items.find(
      ({ id }) => id === 'water',
    )!;
    const stocked = {
      ...initial,
      shop: {
        ...initial.shop,
        itemIds: [water.id],
        stock: { [water.id]: 1 },
      },
    };
    const loc = dispatchCommand(
      stocked,
      {
        type: 'set_cart_quantity',
        commandId: 'mixed-loc',
        itemId: LINE_OF_CREDIT_OFFER_ID,
        quantity: 1,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    const cart = dispatchCommand(
      loc,
      {
        type: 'set_cart_quantity',
        commandId: 'mixed-water',
        itemId: water.id,
        quantity: 1,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(cart.balance).toBe(20);
    expect(cart.inventory).toEqual(initial.inventory);
    const checkedOut = dispatchCommand(
      cart,
      { type: 'checkout_cart', commandId: 'mixed-checkout', now: 0 },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(checkedOut.balance).toBe(9_970 - water.price);
    expect(checkedOut.inventory[water.id]).toBe(
      (initial.inventory[water.id] ?? 0) + 1,
    );
    expect(checkedOut.lineOfCredit.status).toBe('open');
  });

  test('repayment cannot use credit and the twentieth unit closes it', () => {
    const opened = checkoutLoc({ ...run(), balance: 650 }, 1, 'open-loc').state;
    const rejected = checkoutLoc(
      { ...opened, balance: 599 },
      1,
      'repay-unaffordable',
    );
    expect(rejected.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'insufficient_funds',
    });
    expect(rejected.state.lineOfCredit).toEqual(opened.lineOfCredit);

    const closed = checkoutLoc({ ...opened, balance: 12_000 }, 20, 'repay-all');
    expect(closed.state.balance).toBe(0);
    expect(closed.state.lineOfCredit).toMatchObject({ status: 'closed' });
    expect(closed.state.statuses.in_debt).toBeUndefined();
    expect(debtBreakdown(closed.state).total).toBe(0);
  });

  test('an open LOC has no time-based cash charge', () => {
    const opened = checkoutLoc({ ...run(), balance: 50 }, 1, 'open-loc').state;
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
    const opened = checkoutLoc(
      { ...run(), balance: 2_050 },
      1,
      'open-loc',
    ).state;
    const closed = checkoutLoc(opened, 20, 'repay-all').state;
    expect(closed.balance).toBe(0);
    expect(closed.lineOfCredit).toMatchObject({ status: 'closed' });
    expect(debtBreakdown(closed).total).toBe(0);
  });

  test('nineteen repayments leave exactly one $600 unit outstanding', () => {
    const opened = checkoutLoc(
      { ...run(), balance: 60_000 },
      1,
      'open-loc',
    ).state;
    const partial = checkoutLoc(opened, 19, 'repay-19').state;
    expect(partial.balance).toBe(58_550);
    expect(partial.lineOfCredit).toMatchObject({
      status: 'open',
      remainingUnits: 1,
      remainingClosureCost: 600,
    });
    const final = checkoutLoc(partial, 1, 'repay-final').state;
    expect(final.lineOfCredit).toMatchObject({ status: 'closed' });
  });
});
