#!/usr/bin/env node
/* global process */
import { unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const engineRevision = currentEngineRevision();
const resultsPath = resolve(
  root,
  process.env.BALANCE_RESULTS_PATH ?? 'docs/ECONOMY_EVENTS_BALANCE_RESULTS.json',
);
const reportPath = resolve(
  root,
  process.env.BALANCE_REPORT_PATH ?? 'docs/ECONOMY_EVENTS_BALANCE_REPORT.md',
);
const testPath = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/run-expanded-study.test.ts',
);
const combineTestPath = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/combine-expanded-study.test.ts',
);
const validatorPath = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/validate-balance-results.mjs',
);
const configPath = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/vitest.config.ts',
);

const batches = Array.from({ length: 4 }, (_, index) => {
  const suffix = String(index + 1).padStart(2, '0');
  return {
    number: index + 1,
    resultsPath: resolve(
      root,
      `docs/ECONOMY_EVENTS_BALANCE_RESULTS.batch-${suffix}.json`,
    ),
    reportPath: resolve(
      root,
      `docs/ECONOMY_EVENTS_BALANCE_REPORT.batch-${suffix}.md`,
    ),
  };
});

for (const batch of batches) {
  runVitest(testPath, {
    ...process.env,
    BALANCE_ENGINE_REVISION: engineRevision,
    RUN_EXPANDED_BALANCE_STUDY: '1',
    BALANCE_STUDY_BATCH: String(batch.number),
    BALANCE_RESULTS_PATH: batch.resultsPath,
    BALANCE_REPORT_PATH: batch.reportPath,
  });
  run(
    'pnpm',
    ['exec', 'prettier', '--write', batch.reportPath, batch.resultsPath],
    process.env,
  );
  run(process.execPath, [validatorPath, batch.resultsPath], process.env);
}

runVitest(combineTestPath, {
  ...process.env,
  COMBINE_EXPANDED_BALANCE_STUDY: '1',
  BALANCE_BATCH_RESULT_PATHS: JSON.stringify(
    batches.map((batch) => batch.resultsPath),
  ),
  BALANCE_RESULTS_PATH: resultsPath,
  BALANCE_REPORT_PATH: reportPath,
});
run('pnpm', ['exec', 'prettier', '--write', reportPath, resultsPath], process.env);
run(process.execPath, [validatorPath, resultsPath], process.env);
for (const batch of batches) {
  unlinkSync(batch.reportPath);
  unlinkSync(batch.resultsPath);
}
for (const batch of batches)
  process.stdout.write(
    `batch ${batch.number}: ${batch.reportPath}\nresults: ${batch.resultsPath}\n`,
  );
process.stdout.write(`combined report: ${reportPath}\ncombined results: ${resultsPath}\n`);

function runVitest(path, env) {
  run(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      path,
      '--config',
      configPath,
      '--reporter=verbose',
    ],
    env,
  );
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function currentEngineRevision() {
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (revision.status !== 0) return 'unknown';
  const status = spawnSync(
    'git',
    [
      'status',
      '--porcelain',
      '--untracked-files=normal',
      '--',
      'src',
      '.agents/skills/game-balance-simulation',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  return `${revision.stdout.trim()}${status.stdout.trim() ? '+dirty' : ''}`;
}
