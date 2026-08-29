/* global process */
import { writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  BOUNDARIES_PER_RUN,
  MAX_BATCH_SIZE,
  RUN_COUNT,
  mergeFrequencyRuns,
  runFrequencyBatch,
} from './life-event-frequency-study';

describe('life-event frequency study', () => {
  test('keeps the study and batch boundaries explicit', () => {
    expect(RUN_COUNT).toBe(1_000);
    expect(BOUNDARIES_PER_RUN).toBe(2_880);
    expect(MAX_BATCH_SIZE).toBeLessThanOrEqual(25);
    const runs = runFrequencyBatch(0, 1, 2);
    expect(runs).toHaveLength(1);
    expect(runs[0].boundaries).toBe(2);
    expect(runs[0].sameBoundaryCount).toBeGreaterThanOrEqual(0);
    expect(runs[0].seed).toBe('life-event-frequency-0001');
    expect(mergeFrequencyRuns(runs).study.engine).toBe('real');
  });

  test('runs one bounded batch against the real scheduler when requested', () => {
    if (process.env.RUN_LIFE_EVENT_FREQUENCY_STUDY !== '1') return;
    const batch = Number(process.env.LIFE_EVENT_FREQUENCY_BATCH ?? 0);
    const count = Number(
      process.env.LIFE_EVENT_FREQUENCY_BATCH_SIZE ?? MAX_BATCH_SIZE,
    );
    const runs = runFrequencyBatch(batch * MAX_BATCH_SIZE, count);
    const output = mergeFrequencyRuns(runs);
    writeFileSync(
      process.env.LIFE_EVENT_FREQUENCY_RESULTS_PATH ??
        'docs/LIFE_EVENT_FREQUENCY_RESULTS.json',
      `${JSON.stringify(
        { ...output, study: { ...output.study, batch, batchSize: count } },
        null,
      )}\n`,
    );
    expect(runs).toHaveLength(count);
    expect(runs.every((run) => run.boundaries === BOUNDARIES_PER_RUN)).toBe(
      true,
    );
  }, 1_200_000);
});
