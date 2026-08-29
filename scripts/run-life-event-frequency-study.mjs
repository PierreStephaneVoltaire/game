#!/usr/bin/env node
/* global process */
import { unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const outputPath = resolve(
  root,
  process.env.LIFE_EVENT_FREQUENCY_RESULTS_PATH ??
    'docs/LIFE_EVENT_FREQUENCY_RESULTS.json',
);
const testPath = resolve(root, 'src/lib/life-event-frequency-study.test.ts');
const validatorPath = resolve(
  root,
  'scripts/validate-life-event-frequency.mjs',
);
const mergerPath = resolve(
  root,
  'scripts/merge-life-event-frequency-study.mjs',
);
const batchPaths = [];
for (let batch = 0; batch < 40; batch += 1) {
  const suffix = String(batch + 1).padStart(2, '0');
  const batchPath = resolve(root, `.tmp-life-event-frequency-${suffix}.json`);
  batchPaths.push(batchPath);
  run('pnpm', ['exec', 'vitest', 'run', testPath, '--reporter=dot'], {
    ...process.env,
    RUN_LIFE_EVENT_FREQUENCY_STUDY: '1',
    LIFE_EVENT_FREQUENCY_BATCH: String(batch),
    LIFE_EVENT_FREQUENCY_BATCH_SIZE: '25',
    LIFE_EVENT_FREQUENCY_RESULTS_PATH: batchPath,
  });
  run(process.execPath, [validatorPath, batchPath, '--partial'], process.env);
}
run(process.execPath, [mergerPath, outputPath, ...batchPaths], process.env);
run(process.execPath, [validatorPath, outputPath], process.env);
for (const batchPath of batchPaths) unlinkSync(batchPath);
console.log(`results: ${outputPath}`);

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
