#!/usr/bin/env node
/* global process */
import { spawnSync } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const outputPath = resolve(
  root,
  process.env.LOC_COHORT_RESULTS_PATH ?? 'docs/LOC_BALANCE_RESULTS.json',
);
const testPath = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/loc-cohort-study.test.ts',
);
const configPath = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/vitest.config.ts',
);
const validatorPath = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/validate-loc-cohort-results.mjs',
);
const batchPaths = [];
for (let batch = 1; batch <= 16; batch += 1) {
  const path = resolve(root, `.tmp-loc-cohort-${String(batch).padStart(2, '0')}.json`);
  batchPaths.push(path);
  const result = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', testPath, '--config', configPath, '--reporter=dot'],
    {
      cwd: root,
      env: {
        ...process.env,
        RUN_LOC_COHORT_STUDY: '1',
        LOC_COHORT_BATCH: String(batch),
        LOC_COHORT_RESULTS_PATH: path,
      },
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  const validation = spawnSync(process.execPath, [validatorPath, path, '--partial'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (validation.error) throw validation.error;
  if (validation.status !== 0) process.exit(validation.status ?? 1);
}
const merger = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/merge-loc-cohort-study.mjs',
);
const merged = spawnSync(process.execPath, [merger, outputPath, ...batchPaths], {
  cwd: root,
  stdio: 'inherit',
});
if (merged.error) throw merged.error;
if (merged.status !== 0) process.exit(merged.status ?? 1);
const validation = spawnSync(process.execPath, [validatorPath, outputPath], {
  cwd: root,
  stdio: 'inherit',
});
if (validation.error) throw validation.error;
if (validation.status !== 0) process.exit(validation.status ?? 1);
await Promise.all(batchPaths.map((batchPath) => unlink(batchPath)));
console.log(`results: ${outputPath}`);
