/* global process */
import { writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { canonicalRunSpecs, runStudySpec } from './balance-study-policy';
import {
  expandedProfileConfigs,
  expandedRunSpecs,
} from './balance-expanded-profiles';
import { runExpandedSpec } from './balance-expanded-policy';
import {
  EXPANDED_STUDY_BATCH_COUNT,
  EXPANDED_STUDY_BATCH_SIZE,
  expandedStudyBatch,
  parseExpandedStudyBatch,
} from './balance-study-batches';
import { buildStudyResult } from './balance-study-results';
import { renderBatchReport } from './balance-batch-report';
import { renderExpandedReport } from './balance-expanded-report';

describe('heterogeneous 50-profile balance extension', () => {
  test('defines exactly P51 through P100 as configuration data', () => {
    const profiles = expandedProfileConfigs();
    expect(profiles).toHaveLength(50);
    expect(profiles.map((profile) => profile.id)).toEqual(
      Array.from({ length: 50 }, (_, index) => `P${index + 51}`),
    );
    expect(new Set(profiles.map((profile) => profile.label)).size).toBe(50);
  });

  test('records deterministic seeds and all required strategy dimensions', () => {
    const specs = expandedRunSpecs();
    expect(new Set(specs.map((spec) => spec.seed)).size).toBe(50);
    for (const spec of specs) {
      expect(spec.studyGroup).toBe('heterogeneous');
      expect(spec.config.schedule.type).toBeTruthy();
      expect(spec.config.care.strategy).toBeTruthy();
      expect(spec.config.shopping.foodSelection).toBeTruthy();
      expect(spec.config.nutrition.strategy).toBeTruthy();
      expect(spec.config.career.strategy).toBeTruthy();
      expect(spec.config.medical.strategy).toBeTruthy();
      expect(spec.config.debt.strategy).toBeTruthy();
      expect(spec.config.autonomyAwareness).toBeTruthy();
    }
  });

  test('partitions all 100 runs into four stable batches of 25', () => {
    const specs = [...canonicalRunSpecs(), ...expandedRunSpecs()];
    const batches = Array.from(
      { length: EXPANDED_STUDY_BATCH_COUNT },
      (_, index) => expandedStudyBatch(specs, index + 1),
    );
    expect(batches.every((batch) => batch.length === EXPANDED_STUDY_BATCH_SIZE))
      .toBe(true);
    expect(batches.flat().map((spec) => spec.id)).toEqual(
      specs.map((spec) => spec.id),
    );
  });

  test('runs the controlled and heterogeneous policies against the real engine', () => {
    if (process.env.RUN_EXPANDED_BALANCE_STUDY !== '1') return;
    const requestedProfile = process.env.BALANCE_STUDY_PROFILE;
    const requestedBatch = parseExpandedStudyBatch(
      process.env.BALANCE_STUDY_BATCH,
    );
    const allSpecs = [...canonicalRunSpecs(), ...expandedRunSpecs()];
    const selectedSpecs = requestedBatch
      ? expandedStudyBatch(allSpecs, requestedBatch)
      : allSpecs.filter(
          (spec) =>
            !requestedProfile ||
            spec.profile === requestedProfile ||
            spec.label === requestedProfile,
        );
    const result = buildStudyResult(
      selectedSpecs.map((spec) =>
        spec.studyGroup === 'controlled'
          ? runStudySpec(spec)
          : runExpandedSpec(spec),
      ),
    );
    const resultsPath =
      process.env.BALANCE_RESULTS_PATH ??
      'docs/ECONOMY_EVENTS_BALANCE_RESULTS.json';
    const reportPath =
      process.env.BALANCE_REPORT_PATH ??
      'docs/ECONOMY_EVENTS_BALANCE_REPORT.md';
    writeFileSync(resultsPath, `${JSON.stringify(result, null, 2)}\n`);
    if (requestedBatch)
      writeFileSync(
        reportPath,
        renderBatchReport(result, requestedBatch, EXPANDED_STUDY_BATCH_COUNT),
      );
    else if (!requestedProfile)
      writeFileSync(reportPath, renderExpandedReport(result));
    for (const spec of selectedSpecs) {
      if (
        spec.studyGroup !== 'heterogeneous' ||
        spec.config.expectedOutcome === undefined
      )
        continue;
      expect(
        result.runs.find((run) => run.id === spec.id)?.outcome,
        `${spec.id} ${spec.label} must validate its configured ending`,
      ).toBe(spec.config.expectedOutcome);
    }
    expect(result.runs).toHaveLength(
      requestedBatch
        ? EXPANDED_STUDY_BATCH_SIZE
        : requestedProfile
          ? selectedSpecs.length
          : 100,
    );
  }, 1_200_000);
});
