import type { RunSpec } from './balance-study-contract';

export const EXPANDED_STUDY_BATCH_SIZE = 25;
export const EXPANDED_STUDY_BATCH_COUNT = 4;

export function expandedStudyBatch<T extends RunSpec>(
  specs: T[],
  batch: number,
): T[] {
  if (
    !Number.isInteger(batch) ||
    batch < 1 ||
    batch > EXPANDED_STUDY_BATCH_COUNT
  )
    throw new Error(
      `Balance study batch must be between 1 and ${EXPANDED_STUDY_BATCH_COUNT}.`,
    );
  const start = (batch - 1) * EXPANDED_STUDY_BATCH_SIZE;
  return specs.slice(start, start + EXPANDED_STUDY_BATCH_SIZE);
}

export function parseExpandedStudyBatch(value: string | undefined) {
  if (value === undefined) return null;
  const batch = Number(value);
  if (
    !Number.isInteger(batch) ||
    batch < 1 ||
    batch > EXPANDED_STUDY_BATCH_COUNT
  )
    throw new Error(
      `BALANCE_STUDY_BATCH must be between 1 and ${EXPANDED_STUDY_BATCH_COUNT}.`,
    );
  return batch;
}
