/* global process */
import { writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  canonicalRunSpecs,
  runStudySpec,
} from './balance-study-policy';
import { buildStudyResult } from './balance-study-results';
import { renderStudyReport } from './balance-report';

describe('canonical 50-run balance study', () => {
  test('runs the stable policy against the real engine', () => {
    if (process.env.RUN_BALANCE_STUDY !== '1') return;
    const requestedProfile = process.env.BALANCE_STUDY_PROFILE;
    const specs = canonicalRunSpecs().filter(
      (spec) => !requestedProfile || spec.profile === requestedProfile,
    );
    const result = buildStudyResult(specs.map(runStudySpec));
    const resultsPath =
      process.env.BALANCE_RESULTS_PATH ??
      'docs/ECONOMY_EVENTS_BALANCE_RESULTS.json';
    const reportPath =
      process.env.BALANCE_REPORT_PATH ??
      'docs/ECONOMY_EVENTS_BALANCE_REPORT.md';
    writeFileSync(resultsPath, `${JSON.stringify(result, null, 2)}\n`);
    if (!requestedProfile)
      writeFileSync(reportPath, renderStudyReport(result));
    expect(result.runs).toHaveLength(requestedProfile ? specs.length : 50);
  }, 600_000);
});
