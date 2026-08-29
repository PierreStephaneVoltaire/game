#!/usr/bin/env node
/* global process */
import { readFileSync, writeFileSync } from 'node:fs';

const outputPath = process.argv[2] ?? 'docs/LIFE_EVENT_FREQUENCY_RESULTS.json';
const batchPaths = process.argv.slice(3);
if (batchPaths.length !== 40)
  throw new Error(
    'frequency merge requires exactly 40 batches of at most 25 seeds',
  );
const documents = batchPaths.map((path) =>
  JSON.parse(readFileSync(path, 'utf8')),
);
const runs = documents.flatMap((document) => document.runs ?? []);
if (runs.length !== 1_000)
  throw new Error('frequency merge must contain exactly 1,000 runs');
if (new Set(runs.map((run) => run.seed)).size !== runs.length)
  throw new Error('frequency runs must have unique seeds');
const first = documents[0];
const totals = {};
for (const run of runs)
  for (const [eventId, count] of Object.entries(run.counts ?? {}))
    totals[eventId] = (totals[eventId] ?? 0) + count;
const totalSuccessfulRolls = Object.values(totals).reduce(
  (sum, count) => sum + count,
  0,
);
const sameBoundaryCount = runs.reduce(
  (sum, run) => sum + (run.sameBoundaryCount ?? 0),
  0,
);
const study = { ...first.study };
delete study.batch;
delete study.batchSize;
const result = {
  ...first,
  study: {
    ...study,
    batchCount: 40,
    batchSize: 25,
    runCount: 1_000,
    boundariesPerRun: 2_880,
    totalBoundaries: 1_000 * 2_880,
    sameBoundaryCount,
  },
  totals,
  meanSuccessfulRollsPerRun: totalSuccessfulRolls / 1_000,
  runs,
};
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`merged ${runs.length} frequency-study runs into ${outputPath}`);
