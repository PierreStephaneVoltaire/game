import { describe, expect, test } from 'vitest';

import { dispatchCommand, startRun } from '$lib/game-engine';
import { BUNDLED_GAME_DEFINITION } from '$lib/test-game-definition';
import { CAREER_TIERS } from '$lib/progression-types';
import { createGameViewModel } from './game-view-model';
import { roomSetForTier, roomVariantFor, swappableSlots } from './room-look';

const look = { set: 1, placed: {}, picked: {} };

describe('room sets', () => {
  test('each distinct Subscriber Revenue multiplier starts the next set', () => {
    expect(CAREER_TIERS.map(roomSetForTier)).toEqual([
      1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8,
    ]);
  });

  test('furniture keeps its default layer until a set layer exists', () => {
    expect(roomVariantFor('bed', { ...look, set: 8 })).toBe('bed2');
  });

  test('a placed item overrides the picker and the avatar defaults to original', () => {
    expect(roomVariantFor('avatar', look)).toBe('original');
    expect(
      roomVariantFor('poster', {
        ...look,
        placed: { poster: 'umi' },
        picked: { poster: 'poster' },
      }),
    ).toBe('umi');
  });

  test('the picker only offers poster slots', () => {
    for (const [slot] of swappableSlots)
      expect(['poster', 'second-poster']).toContain(slot);
  });
});

describe('cosmetic room items', () => {
  test.each([
    ['poster-umi', 'poster', 'umi'],
    ['bunny-pixie-model', 'avatar', 'bunny_pixie'],
  ])(
    'placing %s exposes its room variant without changing metrics',
    (itemId, slot, variant) => {
      const initial = startRun(
        { mode: 'realtime', now: 0, seed: 'cosmetic', timezone: 'UTC' },
        BUNDLED_GAME_DEFINITION,
      );
      const placed = dispatchCommand(
        { ...initial, inventory: { [itemId]: 1 } },
        { type: 'place_item', itemId, slot, commandId: 'place', now: 0 },
        BUNDLED_GAME_DEFINITION,
      );
      expect(placed.outcomes[0].accepted).toBe(true);
      expect(placed.state.metrics).toEqual(initial.metrics);
      const anchor = createGameViewModel(
        placed.state,
        BUNDLED_GAME_DEFINITION,
      ).anchors.find((candidate) => candidate.key === slot);
      expect(anchor?.item?.roomVariant).toBe(variant);
    },
  );

  test('Bunny Pixie is gated behind Model Redesign', () => {
    expect(
      BUNDLED_GAME_DEFINITION.items.find(
        (item) => item.id === 'bunny-pixie-model',
      )?.progression?.requiredCareerTier,
    ).toBe('model_redesign');
  });
});
