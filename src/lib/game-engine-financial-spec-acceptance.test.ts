import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import { HOUR_MS } from './game-constants';
import endingRules from './data/ending-rules.json';

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

  test('the operation crossing −$20,000 Balance ends immediately', () => {
    const initial = run();
    const item = BUNDLED_GAME_DEFINITION.items.find(
      (candidate) => candidate.price >= 100,
    )!;
    const result = dispatchCommand(
      {
        ...initial,
        balance: -19_950,
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
      endingBalance: -19_950 - item.price,
      triggerEventId: expect.any(String),
    });
    expect(endingRules.texts.events.financialRuinCause).toContain(
      result.state.ending?.kind === 'financial_ruin'
        ? result.state.ending.cause
        : '',
    );
    expect(
      result.state.events.find((event) => event.type === 'run_ended'),
    ).toMatchObject({
      type: 'run_ended',
      endingKind: 'financial_ruin',
    });
  });

  test('Hospital principal alone does not activate In Debt or Financial Ruin', () => {
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

    expect(result.state.ending).toBeNull();
    expect(result.state.statuses.in_debt).toBeUndefined();
    expect(
      result.state.medicalDebt.reduce(
        (sum, bill) => sum + bill.remainingPrincipal,
        0,
      ),
    ).toBe(20_000);
  });

  test('−$1 activates In Debt and $0 clears it', () => {
    const initial = run();
    const water = BUNDLED_GAME_DEFINITION.items.find(
      ({ id }) => id === 'water',
    )!;
    const indebted = dispatchCommand(
      {
        ...initial,
        balance: 0,
        shop: {
          ...initial.shop,
          itemIds: [water.id],
          stock: { [water.id]: 1 },
        },
      },
      {
        type: 'buy_item',
        commandId: 'cross-below-zero',
        itemId: water.id,
        now: 0,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(indebted.balance).toBe(-1);
    expect(indebted.statuses.in_debt).toBeDefined();
    const recovered = reconcileTime(
      {
        ...indebted,
        history: {
          ...indebted.history,
          nextAutonomousAt: 4 * HOUR_MS,
        },
      },
      2 * HOUR_MS,
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(recovered.balance).toBe(0);
    expect(recovered.statuses.in_debt).toBeUndefined();
    expect(
      recovered.events.filter(
        (event) => event.type === 'debt_status_recovered',
      ),
    ).toHaveLength(1);
  });
});
