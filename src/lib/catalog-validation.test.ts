import { describe, expect, test } from 'vitest';

import { validateCatalog } from './catalog-validation';
import {
  BUNDLED_GAME_DEFINITION,
  type GameDefinition,
} from './game-definition';
import petProfile from './data/pet-profile.json';

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

describe('catalogue validation', () => {
  test('accepts all 228 maintained catalogue records', () => {
    expect(validateCatalog(BUNDLED_GAME_DEFINITION, true)).toEqual([]);
  });

  test('rejects generic copy, unknown categories, and duplicate tags', () => {
    const definition = definitionWithItem('water', (item) => {
      item.category = 'placeholder';
      item.qualitativeNutritionHint = 'A varied everyday choice.';
      item.tags = ['food', 'food'];
    });

    expect(messages(definition, 'water')).toEqual(
      expect.arrayContaining([
        'unknown item category',
        'qualitative nutrition hint is missing or generic',
        'duplicate tags',
        'category tag missing',
      ]),
    );
  });

  test('rejects catalogue copy coupled to the configured companion', () => {
    const definition = definitionWithItem('water', (item) => {
      item.description = `${petProfile.displayName}'s personal drink.`;
    });

    expect(messages(definition, 'water')).toContain(
      'catalogue copy hardcodes the companion name',
    );
  });

  test('requires exact primary provenance and pinned dataset snapshots', () => {
    const generic = definitionWithItem('water', (item) => {
      if (!item.nutrition) throw new Error('Water needs nutrition.');
      item.nutrition.sourceUrl = 'https://fdc.nal.usda.gov/download-datasets/';
      item.nutrition.sourceReference = 'USDA FoodData Central snapshot';
      item.nutrition.snapshotDate = '2026-04-01';
    });
    expect(messages(generic, 'water')).toEqual(
      expect.arrayContaining([
        'nutrition provenance must identify an exact source record',
        'USDA provenance must include an exact FDC ID',
        'usda_fndds must use snapshot 2024-10-31',
      ]),
    );

    const mismatchedFdc = definitionWithItem('water', (item) => {
      if (!item.nutrition) throw new Error('Water needs nutrition.');
      item.nutrition.sourceUrl =
        'https://fdc.nal.usda.gov/food-details/9999999/nutrients';
    });
    expect(messages(mismatchedFdc, 'water')).toContain(
      'USDA source URL must match its referenced FDC ID',
    );
  });

  test('validates qualifier fields and values', () => {
    const definition = definitionWithItem('doritos', (item) => {
      if (!item.nutrition) throw new Error('Doritos needs nutrition.');
      item.nutrition.qualifiers = {
        waterG: 'approximately',
        sugarG: 'invalid' as never,
      };
    });

    expect(messages(definition, 'doritos')).toEqual(
      expect.arrayContaining([
        'nutrition qualifier requires a numeric value: waterG',
        'unknown nutrition qualifier: invalid',
      ]),
    );
  });

  test('requires explained nulls and a complete score vocabulary', () => {
    const definition = definitionWithItem('water', (item) => {
      if (!item.nutrition) throw new Error('Water needs nutrition.');
      item.nutrition.proteinG = null;
      item.nutrition.nullReasons = {};
      item.nutritionScores = { salt: 0, water: 3 };
    });

    expect(messages(definition, 'water')).toEqual(
      expect.arrayContaining([
        'null nutrition value needs a reason: proteinG',
        'nutrition score missing: protein',
      ]),
    );
  });

  test('requires exactly three fictional profiles and forbids fixed scores', () => {
    const definition = definitionWithItem('the-concoction', (item) => {
      if (!item.nutrition?.fictionalProfiles)
        throw new Error('Mystery Snack needs profiles.');
      item.nutrition.fictionalProfiles.pop();
      item.nutritionScores = {
        salt: 0,
        water: 0,
        protein: 0,
        sugar: 0,
        caffeine: 0,
      };
    });

    expect(messages(definition, 'the-concoction')).toEqual(
      expect.arrayContaining([
        'fictional seeded item must not carry fixed nutrition scores',
        'fictional nutrition must define exactly profiles A, B, and C',
      ]),
    );
  });

  test('requires fictional profiles to be materially distinct', () => {
    const definition = definitionWithItem('the-concoction', (item) => {
      const profiles = item.nutrition?.fictionalProfiles;
      if (!profiles) throw new Error('Mystery Snack needs profiles.');
      profiles[1] = { ...structuredClone(profiles[0]), id: 'B' };
    });

    expect(messages(definition, 'the-concoction')).toContain(
      'fictional nutrition profiles must be materially distinct',
    );
  });

  test('restricts unavailable and fictional nutrition source types', () => {
    const unavailable = definitionWithItem('water', (item) => {
      if (!item.nutrition) throw new Error('Water needs nutrition.');
      item.nutrition.sourceType = 'not_applicable';
    });
    expect(messages(unavailable, 'water')).toContain(
      'not-applicable food nutrition is restricted to Açaí Bowl',
    );

    const fictional = definitionWithItem('water', (item) => {
      if (!item.nutrition) throw new Error('Water needs nutrition.');
      item.nutrition.sourceType = 'fictional_seeded_profile';
    });
    expect(messages(fictional, 'water')).toContain(
      'fictional seeded nutrition is restricted to The Concoction',
    );
  });

  test('validates structured actions, requirements, consumption, and statuses', () => {
    const definition = definitionWithItem('controller', (item) => {
      const action = item.itemActions?.[0];
      if (!action) throw new Error('Controller needs an action.');
      action.consumes = undefined;
      action.requirements = {
        ownedItemIdsAll: ['missing-item'],
        ownedItemTagsAny: ['missing-tag'],
      };
      action.clearsStatuses = ['confused' as never];
    });

    expect(messages(definition, 'controller')).toEqual(
      expect.arrayContaining([
        'action play_owned_game must explicitly author consumes',
        'action play_owned_game references unknown item: missing-item',
        'action play_owned_game references unknown item tag: missing-tag',
        'action play_owned_game clears unknown status: confused',
      ]),
    );
  });

  test('validates automatic hook eligibility and effect ranges', () => {
    const definition = definitionWithItem('catnip', (item) => {
      const hook = item.automaticEventHooks?.[0];
      if (!hook) throw new Error('Catnip needs a hook.');
      hook.eligibility = 'placed';
      hook.weight = 0;
      hook.effects = { mood: { min: 2, max: -1 } };
    });

    expect(messages(definition, 'catnip')).toEqual(
      expect.arrayContaining([
        'automatic event hook catnip_event has invalid weight',
        'automatic event hook catnip_event cannot require placement',
        'invalid hook catnip_event effect range for mood',
      ]),
    );
  });

  test('rejects inert legacy hooks and non-canonical aliases', () => {
    const definition = definitionWithItem('brownie', (item) => {
      item.id = 'brownies';
      item.hooks = ['legacy'];
    });

    expect(messages(definition, 'brownies')).toEqual(
      expect.arrayContaining([
        'catalogue contains a non-canonical alias',
        'legacy hooks field is not supported',
      ]),
    );
  });

  test('requires automatic hook IDs to be globally unique', () => {
    const definition = definitionWithItem('cat-toy', (item) => {
      const hook = item.automaticEventHooks?.[0];
      if (!hook) throw new Error('Cat Toy needs a hook.');
      hook.id = 'catnip_event';
    });

    expect(messages(definition, 'cat-toy')).toContain(
      'automatic event hook id duplicates catnip: catnip_event',
    );
  });

  test('keeps Salt Tablet from clearing kidney stones', () => {
    const definition = definitionWithItem('salt-tablet', (item) => {
      const action = item.itemActions?.[0];
      if (!action) throw new Error('Salt Tablet needs an action.');
      action.clearsStatuses = ['kidney_stone'];
    });

    expect(messages(definition, 'salt-tablet')).toContain(
      'Salt Tablet must not clear kidney_stone',
    );
  });

  test('enforces the canonical IDs, source mix, and apology clearance', () => {
    const wrongId = definitionWithItem('water', (item) => {
      item.id = 'water-copy';
    });
    expect(
      validateCatalog(wrongId, true).map((issue) => issue.message),
    ).toContain(
      'catalogue IDs differ from canonical allowlist (missing: water; unexpected: water-copy)',
    );

    const wrongMix = definitionWithItem('water', (item) => {
      if (!item.nutrition) throw new Error('Water needs nutrition.');
      item.nutrition.sourceType = 'usda_foundation';
      item.nutrition.snapshotDate = '2026-04-30';
    });
    expect(
      validateCatalog(wrongMix, true).map((issue) => issue.message),
    ).toEqual(
      expect.arrayContaining([
        'expected 37 usda_foundation nutrition records, found 38',
        'expected 66 usda_fndds nutrition records, found 65',
      ]),
    );

    const noApology = definitionWithItem('socks-plushie', (item) => {
      item.itemActions = [];
      item.usable = false;
    });
    expect(
      validateCatalog(noApology, true).map((issue) => issue.message),
    ).toContain(
      'catalogue needs a reusable apology action that clears annoyed',
    );
  });

  test('keeps repeat-use entertainment and bedding durable', () => {
    for (const id of ['movie-rental', 'fresh-bedsheets']) {
      const item = BUNDLED_GAME_DEFINITION.items.find(
        (entry) => entry.id === id,
      );
      expect(item, id).toMatchObject({
        usable: true,
        consumable: false,
        supportsQuantity: false,
      });
      expect(item?.itemActions).toEqual(
        expect.arrayContaining([expect.objectContaining({ consumes: false })]),
      );
    }
  });
});
