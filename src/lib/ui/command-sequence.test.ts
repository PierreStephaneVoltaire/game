import { describe, expect, test } from 'vitest';
import { UiCommandSequence } from './command-sequence';

describe('UI command sequence', () => {
  test('is unique within a run and resets for the next run', () => {
    const sequence = new UiCommandSequence();
    expect([sequence.next(), sequence.next()]).toEqual(['ui-1', 'ui-2']);
    sequence.reset();
    expect(sequence.next()).toBe('ui-1');
  });
});
