import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      '.agents/skills/game-balance-simulation/scripts/run-canonical-study.test.ts',
      '.agents/skills/game-balance-simulation/scripts/run-expanded-study.test.ts',
      '.agents/skills/game-balance-simulation/scripts/combine-expanded-study.test.ts',
      '.agents/skills/game-balance-simulation/scripts/loc-cohort-study.test.ts',
    ],
  },
});
