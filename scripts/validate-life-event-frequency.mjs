#!/usr/bin/env node
/* global process */
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'docs/LIFE_EVENT_FREQUENCY_RESULTS.json';
const partial = process.argv.includes('--partial');
const document = JSON.parse(readFileSync(path, 'utf8'));
const errors = [];
if (document?.study?.engine !== 'real')
  errors.push('study.engine must be real');
const expectedRuns = partial ? undefined : 1_000;
if (!partial && document?.study?.runCount !== expectedRuns)
  errors.push('study.runCount must be exactly 1000');
if (document?.study?.boundariesPerRun !== 2_880)
  errors.push('study.boundariesPerRun must be exactly 2880');
if (!partial && document?.study?.totalBoundaries !== 1_000 * 2_880)
  errors.push('study.totalBoundaries must equal 1000 × 2880');
if (!partial && document?.study?.batchCount !== 40)
  errors.push('study.batchCount must be exactly 40');
if (!partial && document?.study?.batchSize !== 25)
  errors.push('study.batchSize must be exactly 25');
if (!partial && !Number.isFinite(document?.study?.sameBoundaryCount))
  errors.push('study.sameBoundaryCount must be numeric');
if (
  !partial &&
  (!Number.isFinite(document?.meanSuccessfulRollsPerRun) ||
    document.meanSuccessfulRollsPerRun < 8.2 ||
    document.meanSuccessfulRollsPerRun > 9.3)
)
  errors.push('meanSuccessfulRollsPerRun must be between 8.2 and 9.3');
if (!partial && document?.study?.sameBoundaryCount < 1)
  errors.push('study.sameBoundaryCount must be at least 1');
if (
  !Array.isArray(document?.runs) ||
  (expectedRuns && document.runs.length !== expectedRuns)
)
  errors.push('runs must contain exactly 1000 isolated seeds');
if (partial && (!document.runs?.length || document.runs.length > 25))
  errors.push('partial batches must contain between 1 and 25 seeds');
const ids = (document.runs ?? []).map((run) => run.seed);
if (new Set(ids).size !== ids.length)
  errors.push('runs must have unique seeds');
for (const [index, run] of (document.runs ?? []).entries()) {
  if (run.boundaries !== 2_880)
    errors.push(`runs[${index}].boundaries must be exactly 2880`);
  if (!Number.isFinite(run.sameBoundaryCount))
    errors.push(`runs[${index}].sameBoundaryCount must be numeric`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`validated ${document.runs.length} frequency-study seeds`);
