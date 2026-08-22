import { execFileSync } from 'node:child_process';

import { describe, expect, test } from 'vitest';

describe('catalogue compiler', () => {
  test('generated shop-items.json has no drift from maintained sources', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ['scripts/generate-canonical-catalogue.mjs', '--check'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          stdio: 'pipe',
        },
      ),
    ).not.toThrow();
  });
});
