import { expect, test } from 'vitest';
import { UiCommandSequence } from './command-sequence';

test('action IDs remain unique across controller instances and reloads', () => {
  const ids = Array.from({ length: 100 }, () => new UiCommandSequence().next());
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => /^ui-[0-9a-f-]{36}$/.test(id))).toBe(true);
});
