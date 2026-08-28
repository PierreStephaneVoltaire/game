import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { startRun } from './game-engine';

const item = (id: string) =>
  BUNDLED_GAME_DEFINITION.items.find((candidate) => candidate.id === id);

describe('V2 catalogue definition seam', () => {
  test('publishes exactly 228 canonical items in the locked category counts', () => {
    const counts = Object.fromEntries(
      ['food', 'medicine', 'care', 'reusable', 'upgrade', 'decoration'].map(
        (category) => [
          category,
          BUNDLED_GAME_DEFINITION.items.filter(
            (candidate) => candidate.category === category,
          ).length,
        ],
      ),
    );

    expect(BUNDLED_GAME_DEFINITION.items).toHaveLength(228);
    expect(counts).toEqual({
      food: 111,
      medicine: 2,
      care: 3,
      reusable: 74,
      upgrade: 23,
      decoration: 15,
    });
  });

  test('uses the replacement identities and their authored preparation data', () => {
    expect(item('mini-tacos')).toMatchObject({ name: 'Mini Tacos', price: 5 });
    expect(item('cheeseless-toppingless-pizza')).toMatchObject({
      name: 'Cheeseless Toppingless Pizza',
      price: 5,
      context: { preparationAcceptance: 0.85 },
    });
    expect(item('the-concoction')).toMatchObject({
      name: 'The Concoction',
      price: 4,
      preferences: ['variable'],
      nutrition: {
        sourceType: 'fictional_seeded_profile',
        fictionalProfiles: [
          expect.objectContaining({ id: 'A' }),
          expect.objectContaining({ id: 'B' }),
          expect.objectContaining({ id: 'C' }),
        ],
      },
    });
    expect(item('taco')).toBeUndefined();
    expect(item('pizza')).toBeUndefined();
    expect(item('mystery-snack')).toBeUndefined();
  });

  test('publishes the nine added items with their locked prices and metadata', () => {
    expect(item('can-opener')).toMatchObject({
      category: 'reusable',
      price: 35,
      consumable: false,
    });
    expect(item('insurance-card')).toMatchObject({
      category: 'care',
      price: 150,
      supportsQuantity: false,
      maximumOwned: 1,
    });
    expect(item('painkillers')).toMatchObject({
      category: 'medicine',
      price: 7,
      itemActions: [
        expect.objectContaining({ id: 'take_painkillers', kind: 'consume' }),
      ],
    });
    expect(item('electrolyte-sachet')).toMatchObject({
      category: 'care',
      price: 9,
      nutritionScores: { salt: 2, water: 2 },
    });
    expect(item('jar-of-pickle-juice')).toMatchObject({
      category: 'food',
      price: 3,
      preferences: ['liked'],
      effects: { food: { min: 1, max: 1 }, mood: { min: 1, max: 1 } },
      nutritionScores: { salt: 3, water: 2 },
    });
    expect(item('sheet-of-cute-stickers')).toMatchObject({
      category: 'decoration',
      price: 25,
      itemActions: [
        expect.objectContaining({
          id: 'confront_stickers',
          effects: { mood: { min: -2, max: -2 } },
        }),
      ],
    });
    expect(item('rigging-tablet')).toMatchObject({
      category: 'upgrade',
      price: 200,
      itemActions: [
        expect.objectContaining({
          id: 'commission_work',
          kind: 'activity',
          activity: { type: 'commission_work', durationHours: 6 },
        }),
      ],
    });
    expect(item('limited-edition-dr-pepper')).toMatchObject({
      category: 'food',
      price: 12,
      stock: { min: 1, max: 2 },
      sugarServings: 2,
    });
    expect(item('limited-edition-dr-pepper')?.tags).toContain('hyperfocus');
    expect(item('convention-guest-set')).toMatchObject({
      category: 'decoration',
      price: 120,
      progression: { requiredCareerTier: 'convention_guest' },
    });
    expect(item('new-model-commission')).toMatchObject({
      category: 'upgrade',
      price: 300,
      progression: { requiredCareerTier: 'first_model' },
      itemActions: [
        expect.objectContaining({
          id: 'start_model_commission',
          kind: 'service',
          service: { type: 'model_commission' },
        }),
      ],
    });
  });

  test('authors essential starter tortillas and stackable Clippers', () => {
    expect(item('five-plain-tortillas')).toMatchObject({
      category: 'food',
      price: 2,
      preferences: ['liked'],
      effects: { food: { min: 2, max: 2 }, mood: { min: 2, max: 2 } },
      nutritionScores: { salt: 0, water: 0, protein: 0, sugar: 0, caffeine: 0 },
    });
    expect(item('five-plain-tortillas')?.tags).toContain('essential');
    expect(item('water')).toMatchObject({ price: 1 });
    expect(item('water')?.tags).toContain('essential');
    expect(item('clippers')).toMatchObject({
      category: 'upgrade',
      price: 25,
      consumable: true,
      supportsQuantity: true,
      itemActions: [
        expect.objectContaining({
          progressionEffect: { type: 'activate_clippers' },
        }),
      ],
    });
  });

  test('authors the Cat Tree Socks modifier in catalogue data', () => {
    expect(item('cat-tree')).toMatchObject({
      eventPoolModifiers: [
        { eventId: 'socks', weightDelta: 3, eligibility: 'placed' },
      ],
    });
  });
});

describe('single-run product boundary', () => {
  test('a newly started run inherits no debt, effects, projects, or keepsakes', () => {
    const first = startRun(
      { mode: 'streaming', now: 0, seed: 'first-run', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const changed = {
      ...first,
      balance: -10_000,
      inventory: { trophy: 1 },
      room: { wall: 'trophy' },
      projects: [
        {
          id: 'old-project',
          type: 'full_body_commission' as const,
          startedAt: 0,
          completesAt: 1,
          sourceActionId: 'old',
          payout: 800,
        },
      ],
      timedEffects: {
        deferredRestLossAt: 1,
        hyperfocusUntil: 2,
        painReliefUntil: 3,
      },
    };
    expect(changed.balance).toBeLessThan(0);

    const fresh = startRun(
      { mode: 'realtime', now: 10, seed: 'second-run', timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    expect(fresh).toMatchObject({
      mode: 'realtime',
      balance: 20,
      inventory: { water: 1, uncrustables: 1, pretzel: 1 },
      room: {},
      projects: [],
      timedEffects: {
        deferredRestLossAt: null,
        hyperfocusUntil: null,
        painReliefUntil: null,
      },
      progression: {
        followers: 100,
        careerTier: 'debut',
        activeAppearanceId: 'classic',
        completedModelTiers: [],
        queuedEventStreams: [],
        permanentDonationBonus: false,
      },
    });
  });
});
