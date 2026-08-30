import { describe, expect, test } from 'vitest';

import endingRules from './data/ending-rules.json';
import eventTexts from './data/event-texts.json';
import { PET_PROFILE } from './game-constants';
import { selectSeededText } from './seeded-text';

function assertNonemptyPools(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    expect(value.length, `${path} must not be empty`).toBeGreaterThan(0);
    for (const option of value)
      expect(typeof option, `${path} options must be strings`).toBe('string');
    return;
  }
  if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value))
      assertNonemptyPools(child, `${path}.${key}`);
}

describe('seeded JSON text pools', () => {
  test('defines nonempty arrays for every selectable event and Ending text', () => {
    assertNonemptyPools(eventTexts.builtInEvents, 'builtInEvents');
    assertNonemptyPools(eventTexts.eventTemplates, 'eventTemplates');
    assertNonemptyPools(eventTexts.lifeEvents, 'lifeEvents');
    assertNonemptyPools(eventTexts.activityCompletions, 'activityCompletions');
    assertNonemptyPools(endingRules.texts, 'ending.texts');
  });

  test('replays exactly for one seed, state version, action, and rule', () => {
    const context = {
      seed: 'copy-replay',
      stateVersion: 17,
      actionId: 'event-action',
    };
    const options = eventTexts.eventTemplates.tax_bill;
    expect(selectSeededText(options, context, 'tax_bill')).toBe(
      selectSeededText(options, context, 'tax_bill'),
    );
  });

  test('can reach every authored option and fills configured-name placeholders', () => {
    const options = endingRules.texts.events.death;
    const selected = new Set(
      Array.from({ length: 200 }, (_, index) =>
        selectSeededText(
          options,
          {
            seed: 'copy-coverage',
            stateVersion: index,
            actionId: `death-${index}`,
          },
          'ending.events.death',
        ),
      ),
    );
    expect(selected).toEqual(
      new Set(
        options.map((option) =>
          option.replaceAll('{pet}', PET_PROFILE.displayName),
        ),
      ),
    );
    expect([...selected].every((text) => !text.includes('{pet}'))).toBe(true);
  });
});
