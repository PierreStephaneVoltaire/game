/* global process */
import { writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildStudyResult } from './balance-study-results';
import { runExpandedSpec } from './balance-expanded-policy';
import { EXPANDED_STUDY_BATCH_SIZE } from './balance-study-batches';
import { locCohortSpecs, LOC_COHORT_RUNS } from './loc-cohort-profiles';

const BATCH_COUNT = 16;

function locBatch(batch: number) {
  if (!Number.isInteger(batch) || batch < 1 || batch > BATCH_COUNT)
    throw new Error(`LOC cohort batch must be between 1 and ${BATCH_COUNT}.`);
  return locCohortSpecs().slice(
    (batch - 1) * EXPANDED_STUDY_BATCH_SIZE,
    batch * EXPANDED_STUDY_BATCH_SIZE,
  );
}

describe('LOC balance cohorts', () => {
  test('defines four 100-seed cohorts and bounded batches', () => {
    const specs = locCohortSpecs();
    expect(specs).toHaveLength(BATCH_COUNT * EXPANDED_STUDY_BATCH_SIZE);
    expect(new Set(specs.map((spec) => spec.seed)).size).toBe(specs.length);
    expect(
      new Set(specs.map((spec) => spec.config.debt.strategy)),
    ).toHaveLength(4);
    expect(
      Array.from({ length: BATCH_COUNT }, (_, index) =>
        specs.slice(
          index * EXPANDED_STUDY_BATCH_SIZE,
          (index + 1) * EXPANDED_STUDY_BATCH_SIZE,
        ),
      ).every((batch) => batch.length <= EXPANDED_STUDY_BATCH_SIZE),
    ).toBe(true);
    expect(
      specs.filter((spec) => spec.config.debt.strategy === 'loc_never_repay'),
    ).toHaveLength(LOC_COHORT_RUNS);
  });

  test('runs each selected batch against the real engine', () => {
    if (process.env.RUN_LOC_COHORT_STUDY !== '1') return;
    const batch = Number(process.env.LOC_COHORT_BATCH ?? 0);
    const specs = locBatch(batch);
    const result = buildStudyResult(specs.map(runExpandedSpec));
    const resultsPath =
      process.env.LOC_COHORT_RESULTS_PATH ?? 'docs/LOC_BALANCE_RESULTS.json';
    writeFileSync(resultsPath, `${JSON.stringify(result, null, 2)}\n`);
    expect(result.runs).toHaveLength(EXPANDED_STUDY_BATCH_SIZE);
  }, 1_200_000);
});
