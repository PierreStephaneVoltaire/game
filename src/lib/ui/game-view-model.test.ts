import { describe, expect, it } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from '$lib/game-definition';
import { HOUR_MS } from '$lib/game-constants';
import { startRun } from '$lib/game-engine';
import type { GameState } from '$lib/game-types';
import { companion } from './companion';
import { createGameViewModel } from './game-view-model';

const startedAt = Date.UTC(2026, 7, 22, 14);

function startedState(): GameState {
  return startRun(
    {
      mode: 'streaming',
      now: startedAt,
      seed: 'ui-view-model',
      timezone: 'America/Toronto',
    },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('game view model', () => {
  it('presents progression, projects, timed effects, avatar, debt, and hospital coverage', () => {
    const initial = startedState();
    const state: GameState = {
      ...initial,
      now: startedAt + 6 * HOUR_MS,
      balance: -9_500,
      statuses: { sick: { since: startedAt, source: 'test' } },
      inventory: { ...initial.inventory, 'insurance-card': 1 },
      timedEffects: {
        ...initial.timedEffects,
        hyperfocusUntil: startedAt + 8 * HOUR_MS,
        painReliefUntil: startedAt + 12 * HOUR_MS,
      },
      progression: {
        ...initial.progression,
        followers: 10_500,
        careerTier: 'twitch_partner',
        activeAppearanceId: 'model_3_0',
      },
      projects: [
        {
          id: 'model-1',
          type: 'model_commission',
          modelTier: 1,
          startedAt,
          completesAt: startedAt + 12 * HOUR_MS,
          sourceActionId: 'commission-1',
        },
      ],
    };

    const model = createGameViewModel(state, BUNDLED_GAME_DEFINITION);

    expect(model.followers).toBe(10_500);
    expect(model.career).toEqual({
      key: 'twitch_partner',
      label: 'Twitch Partner',
      nextMilestone: {
        key: 'sub_30k',
        label: '30K Subscribers',
        followers: 30_000,
        remaining: 19_500,
      },
    });
    expect(model.debt).toEqual({
      active: true,
      amount: 9_500,
      total: 9_500,
      negativeCash: 9_500,
      hospitalPrincipal: 0,
      locClosureCost: 0,
      otherFinancedPrincipal: 0,
    });
    expect(model.effects).toEqual([
      {
        key: 'hyperfocus',
        label: 'Hyperfocus',
        endsAt: startedAt + 8 * HOUR_MS,
      },
      {
        key: 'pain_relief',
        label: 'Pain Relief',
        endsAt: startedAt + 12 * HOUR_MS,
      },
    ]);
    expect(model.projects).toEqual([
      {
        id: 'model-1',
        label: 'Model 1 commission',
        endsAt: startedAt + 12 * HOUR_MS,
        progressPercentage: 50,
      },
    ]);
    expect(model.activeAvatar).toEqual(
      companion.appearances.find((appearance) => appearance.id === 'model_3_0'),
    );
    expect(model.hospital).toEqual({
      durationHours: 12,
      cost: 500,
      insured: true,
      consumedItemName: 'Insurance Card',
    });
    expect(model.metrics.find((metric) => metric.key === 'health')).toEqual({
      key: 'health',
      label: 'Health',
      value: 32,
      maximum: 40,
      percentage: 80,
    });
    expect(model.metrics.find((metric) => metric.key === 'food')).toEqual({
      key: 'food',
      label: 'Food',
      value: 6,
      maximum: 10,
      percentage: 60,
    });
  });

  it('exposes exact debt-aware purchase and checkout affordances', () => {
    const initial = startedState();
    const state: GameState = {
      ...initial,
      balance: -1,
      shop: {
        ...initial.shop,
        itemIds: ['painkillers', 'insurance-card', 'rigging-tablet'],
        stock: {
          painkillers: 2,
          'insurance-card': 1,
          'rigging-tablet': 3,
        },
        cart: { painkillers: 1 },
      },
    };

    const model = createGameViewModel(state, BUNDLED_GAME_DEFINITION);
    const byId = new Map(model.shop.map((item) => [item.id, item]));

    expect(byId.get('painkillers')?.purchaseAllowed).toBe(true);
    expect(byId.get('insurance-card')?.purchaseAllowed).toBe(true);
    expect(byId.get('rigging-tablet')?.purchaseAllowed).toBe(true);
    expect(byId.get('rigging-tablet')?.maximumCartQuantity).toBe(3);
    expect(model.cartCheckoutAllowed).toBe(true);

    const mixed = createGameViewModel(
      {
        ...state,
        shop: {
          ...state.shop,
          cart: { painkillers: 1, 'insurance-card': 1 },
        },
      },
      BUNDLED_GAME_DEFINITION,
    );
    expect(mixed.cartCheckoutAllowed).toBe(true);
    expect(mixed.cartResultingBalance).toBe(
      state.balance -
        (byId.get('painkillers')!.price + byId.get('insurance-card')!.price),
    );
  });

  it('projects Commission Work through the owned Rigging Tablet detail', () => {
    const initial = startedState();
    const model = createGameViewModel(
      {
        ...initial,
        metrics: { ...initial.metrics, creativity: 4 },
        inventory: { ...initial.inventory, 'rigging-tablet': 1 },
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(
      model.inventory
        .find((item) => item.id === 'rigging-tablet')
        ?.itemActions.find((action) => action.id === 'commission_work'),
    ).toEqual({
      id: 'commission_work',
      label: 'Commission Work',
      available: true,
    });
  });

  it('presents ending risks separately from statuses with countdowns', () => {
    const initial = startedState();
    const model = createGameViewModel(
      {
        ...initial,
        now: startedAt + 24 * HOUR_MS,
        metrics: { ...initial.metrics, mood: 0 },
        endingRisks: {
          quit_streaming: {
            triggerStartedAt: startedAt,
            warningStages: [0, 24],
            warningEventIds: [],
          },
        },
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(model.statuses).toEqual([]);
    expect(model.endingRisks).toEqual([
      {
        kind: 'quit_streaming',
        label: 'Quit Streaming risk',
        remaining: 48,
        unit: 'hours',
      },
    ]);
  });

  it.each([
    ['death', 'Death', 'Health reached 0.'],
    [
      'quit_streaming',
      'Quit Streaming',
      'Mood remained at 0 continuously for 72 game-hours.',
    ],
    ['financial_ruin', 'Financial Ruin', 'Balance crossed −$20,000.'],
  ] as const)('presents the %s ending card', (kind, title, explanation) => {
    const initial = startedState();
    const common = {
      at: startedAt + HOUR_MS,
      triggerStartedAt: startedAt,
      eventIds: [],
    };
    const ending: GameState['ending'] =
      kind === 'death'
        ? {
            kind,
            at: common.at,
            cause: 'Starvation',
            causes: [
              {
                kind: 'status',
                id: 'starving',
                name: 'Starvation',
                eventIds: [],
              },
            ],
            eventIds: [],
          }
        : kind === 'financial_ruin'
          ? {
              ...common,
              kind,
              cause: 'Insolvency',
              endingBalance: -20_001,
              triggerEventId: 'trigger',
            }
          : {
              ...common,
              kind,
              durationHours: 72,
              endingMetricValue: 0,
            };
    const model = createGameViewModel(
      { ...initial, ending },
      BUNDLED_GAME_DEFINITION,
    );
    expect(model.ending).toMatchObject({ kind, title, explanation });
    expect(model.endingRisks).toEqual([]);
    expect(model.commandsDisabled).toBe(true);
    if (kind === 'death')
      expect(model.ending?.causes).toEqual([{ name: 'Starvation' }]);
  });

  it('keeps commands enabled for an active run', () => {
    expect(
      createGameViewModel(startedState(), BUNDLED_GAME_DEFINITION)
        .commandsDisabled,
    ).toBe(false);
  });
});
