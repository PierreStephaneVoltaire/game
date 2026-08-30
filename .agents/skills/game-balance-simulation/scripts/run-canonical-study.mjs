#!/usr/bin/env node
/* global process */
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
  '.agents/skills/game-balance-simulation/scripts/run-canonical-study.test.ts',
);
const validatorPath = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/validate-balance-results.mjs',
);
const configPath = resolve(
  root,
  '.agents/skills/game-balance-simulation/scripts/vitest.config.ts',
);

run('pnpm', ['exec', 'vitest', 'run', testPath, '--config', configPath, '--reporter=verbose'], {
  ...process.env,
  BALANCE_ENGINE_REVISION: engineRevision,
  RUN_BALANCE_STUDY: '1',
  BALANCE_RESULTS_PATH: resultsPath,
  BALANCE_REPORT_PATH: reportPath,
});
run('pnpm', ['exec', 'prettier', '--write', reportPath, resultsPath], process.env);
run(process.execPath, [validatorPath, resultsPath], process.env);
process.stdout.write(`report: ${reportPath}\nresults: ${resultsPath}\n`);

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
