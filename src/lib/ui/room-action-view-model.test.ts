import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from '$lib/test-game-definition';
import { startRun } from '$lib/game-engine';
import { createGameViewModel } from './game-view-model';

describe('room action view model', () => {
  test('exposes applicable care actions and inventory placement choices', () => {
    const initial = startRun(
      {
        mode: 'streaming',
        now: 0,
        seed: 'room-action-choices',
        timezone: 'UTC',
      },
      BUNDLED_GAME_DEFINITION,
    );
    const model = createGameViewModel(
      {
        ...initial,
        inventory: {
          ...initial.inventory,
          'new-game': 1,
          controller: 1,
          'giant-plushie': 1,
          'rubber-duck': 1,
          'rigging-tablet': 1,
        },
      },
      BUNDLED_GAME_DEFINITION,
    );

    expect(model.careChoices.socialize).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: 'new-game',
          actionId: 'play_game',
        }),
        expect.objectContaining({
          itemId: 'giant-plushie',
          actionId: 'offer_plushie_apology',
        }),
      ]),
    );
    expect(model.careChoices.play).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: 'new-game',
          actionId: 'play_game',
        }),
      ]),
    );
    expect(
      model.careChoices.play.some(
        (choice) => choice.itemId === 'giant-plushie',
      ),
    ).toBe(false);
    expect(model.roomChoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: 'rubber-duck', slot: 'shelf' }),
        expect.objectContaining({
          itemId: 'rigging-tablet',
          actionId: 'commission_work',
        }),
      ]),
    );
    expect(
      model.roomChoices.some((choice) => choice.actionId === 'play_game'),
    ).toBe(false);
    expect(
      model.roomChoices.some(
        (choice) => choice.actionId === 'offer_plushie_apology',
      ),
    ).toBe(false);
    expect(model.roomChoices.some((choice) => choice.itemId === 'water')).toBe(
      false,
    );
    expect(
      model.anchors.find((anchor) => anchor.key === 'shelf')?.placementChoices,
    ).toEqual([
      expect.objectContaining({
        itemId: 'rubber-duck',
        owned: 1,
        slot: 'shelf',
      }),
    ]);
    expect(
      model.anchors.find((anchor) => anchor.key === 'floor')?.placementChoices,
    ).toEqual([
      expect.objectContaining({
        itemId: 'giant-plushie',
        owned: 1,
        slot: 'floor',
      }),
    ]);
  });
});
