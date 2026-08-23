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
        followers: 650,
        careerTier: 'partner',
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

    expect(model.followers).toBe(650);
    expect(model.career).toEqual({
      key: 'partner',
      label: 'Partner',
      nextMilestone: {
        key: 'convention_guest',
        label: 'Convention Guest',
        followers: 1_200,
        remaining: 550,
      },
    });
    expect(model.debt).toEqual({ active: true, amount: 9_500 });
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
    expect(byId.get('insurance-card')?.purchaseAllowed).toBe(false);
    expect(byId.get('rigging-tablet')?.purchaseAllowed).toBe(false);
    expect(byId.get('rigging-tablet')?.maximumCartQuantity).toBe(1);
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
    expect(mixed.cartCheckoutAllowed).toBe(false);
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
});
