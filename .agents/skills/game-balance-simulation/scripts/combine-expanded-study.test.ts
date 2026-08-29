/* global process */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { canonicalRunSpecs } from './balance-study-policy';
import { expandedRunSpecs } from './balance-expanded-profiles';
import { mergeStudyResults } from './balance-study-merge';
import type { buildStudyResult } from './balance-study-results';
import { renderExpandedReport } from './balance-expanded-report';

type Result = ReturnType<typeof buildStudyResult>;

describe('batched 100-profile balance study', () => {
  test('combines four validated batches in canonical order', () => {
    if (process.env.COMBINE_EXPANDED_BALANCE_STUDY !== '1') return;
    const batchPaths = JSON.parse(
      process.env.BALANCE_BATCH_RESULT_PATHS ?? '[]',
    ) as string[];
    expect(batchPaths).toHaveLength(4);
    const partials = batchPaths.map(
      (path) => JSON.parse(readFileSync(path, 'utf8')) as Result,
    );
    expect(partials.map((partial) => partial.runs.length)).toEqual([
      25, 25, 25, 25,
    ]);
    const result = mergeStudyResults(partials);
    const expectedIds = [...canonicalRunSpecs(), ...expandedRunSpecs()].map(
      (spec) => spec.id,
    );
    expect(result.runs.map((run) => run.id)).toEqual(expectedIds);
    const resultsPath =
      process.env.BALANCE_RESULTS_PATH ??
      'docs/ECONOMY_EVENTS_BALANCE_RESULTS.json';
    const reportPath =
      process.env.BALANCE_REPORT_PATH ??
      'docs/ECONOMY_EVENTS_BALANCE_REPORT.md';
    writeFileSync(resultsPath, `${JSON.stringify(result, null, 2)}\n`);
    writeFileSync(reportPath, renderExpandedReport(result));
    expect(result.runs).toHaveLength(100);
  });
});
