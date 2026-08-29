import { describe, expect, test } from 'vitest';

import { validateCatalog } from './catalog-validation';
import {
  BUNDLED_GAME_DEFINITION,
  type GameDefinition,
} from './game-definition';

function definitionWithItem(
  itemId: string,
  update: (item: GameDefinition['items'][number]) => void,
): GameDefinition {
  const definition = structuredClone(BUNDLED_GAME_DEFINITION);
  const item = definition.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Missing fixture item: ${itemId}`);
  update(item);
  return definition;
}

function messages(definition: GameDefinition, itemId: string): string[] {
  return validateCatalog(definition)
    .filter((issue) => issue.itemId === itemId)
    .map((issue) => issue.message);
}

describe('catalogue item consumption validation', () => {
  test('consumes non-room stat items while placed furniture stays reusable', () => {
    for (const id of ['movie-rental', 'fresh-bedsheets']) {
      const item = BUNDLED_GAME_DEFINITION.items.find(
        (entry) => entry.id === id,
      );
      expect(item, id).toMatchObject({
        usable: true,
        consumable: true,
        supportsQuantity: true,
      });
      expect(item?.itemActions).toEqual(
        expect.arrayContaining([expect.objectContaining({ consumes: true })]),
      );
    }

    const furniture = BUNDLED_GAME_DEFINITION.items.find(
      (entry) => entry.id === 'socks-plushie',
    );
    expect(furniture).toMatchObject({
      roomSlot: 'shelf',
      consumable: false,
      supportsQuantity: false,
    });
    expect(furniture?.itemActions).toEqual(
      expect.arrayContaining([expect.objectContaining({ consumes: false })]),
    );
  });

  test('rejects a permanent non-room action that grants stats', () => {
    const invalid = definitionWithItem('movie-rental', (item) => {
      item.consumable = false;
      item.supportsQuantity = false;
      item.itemActions![0].consumes = false;
    });

    expect(messages(invalid, 'movie-rental')).toContain(
      'non-room stat action movie_night must consume its inventory item',
    );
  });

  test('rejects a reusable model-commission service', () => {
    const invalid = definitionWithItem('new-model-commission', (item) => {
      item.consumable = false;
      item.supportsQuantity = false;
      item.itemActions![0].consumes = false;
    });

    expect(messages(invalid, 'new-model-commission')).toContain(
      'model-commission service start_model_commission must consume its inventory item',
    );
  });
});
