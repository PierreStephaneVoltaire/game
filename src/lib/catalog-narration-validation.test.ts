import { describe, expect, test } from 'vitest';

import { validateCatalog } from './catalog-validation';
import { BUNDLED_GAME_DEFINITION } from './test-game-definition';

function waterNarrationIssues(narration: string[]): string[] {
  const definition = structuredClone(BUNDLED_GAME_DEFINITION);
  const water = definition.items.find((item) => item.id === 'water');
  if (!water) throw new Error('Water fixture is missing.');
  water.narration = narration;
  return validateCatalog(definition)
    .filter((issue) => issue.itemId === 'water')
    .map((issue) => issue.message);
}

describe('catalogue narration validation', () => {
  test('requires item-authored narration without discovery language', () => {
    expect(waterNarrationIssues([])).toContain(
      'item narration needs at least one authored line',
    );
    expect(
      waterNarrationIssues(['discovered something new about Water.']),
    ).toContain('item narration must not treat familiar items as discoveries');
  });
});
