import lifeEventData from './data/life-events.json';
import { startRun } from './game-engine';
import { BUNDLED_GAME_DEFINITION } from './test-game-definition';
import {
  LIFE_EVENT_INTERVAL_MS,
  rollLifeEventIds,
} from './life-event-scheduler';

export const RUN_COUNT = 1_000;
export const BOUNDARIES_PER_RUN = 2_880;
export const MAX_BATCH_SIZE = 25;
export const STUDY_START = Date.parse('2026-01-01T00:00:00Z');

export type FrequencyRun = {
  seed: string;
  boundaries: number;
  sameBoundaryCount: number;
  counts: Record<string, number>;
};

export function seedForRun(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= RUN_COUNT)
    throw new Error(
      `frequency run index must be between 0 and ${RUN_COUNT - 1}`,
    );
  return `life-event-frequency-${String(index + 1).padStart(4, '0')}`;
}

export function runFrequencyBatch(
  startIndex: number,
  count: number,
  boundaryCount = BOUNDARIES_PER_RUN,
): FrequencyRun[] {
  if (!Number.isInteger(startIndex) || startIndex < 0)
    throw new Error('frequency batch start must be a non-negative integer');
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH_SIZE)
    throw new Error(
      `frequency batch count must be between 1 and ${MAX_BATCH_SIZE}`,
    );
  if (startIndex + count > RUN_COUNT)
    throw new Error('frequency batch exceeds the 1,000-run study');
  if (!Number.isInteger(boundaryCount) || boundaryCount < 1)
    throw new Error('frequency boundary count must be a positive integer');

  return Array.from({ length: count }, (_, offset) => {
    const seed = seedForRun(startIndex + offset);
    const state = startRun(
      { mode: 'streaming', now: STUDY_START, seed, timezone: 'UTC' },
      BUNDLED_GAME_DEFINITION,
    );
    const counts = Object.fromEntries(
      lifeEventData.events.map((event) => [event.id, 0]),
    );
    let sameBoundaryCount = 0;
    for (let boundary = 1; boundary <= boundaryCount; boundary += 1) {
      const at = STUDY_START + boundary * LIFE_EVENT_INTERVAL_MS;
      const eventIds = rollLifeEventIds(state, at);
      if (eventIds.length > 1) sameBoundaryCount += 1;
      for (const eventId of eventIds)
        counts[eventId] = (counts[eventId] ?? 0) + 1;
    }
    return { seed, boundaries: boundaryCount, sameBoundaryCount, counts };
  });
}

export function mergeFrequencyRuns(runs: FrequencyRun[]) {
  const totals = Object.fromEntries(
    lifeEventData.events.map((event) => [event.id, 0]),
  );
  for (const run of runs)
    for (const [eventId, count] of Object.entries(run.counts))
      totals[eventId] = (totals[eventId] ?? 0) + count;
  const totalSuccessfulRolls = Object.values(totals).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    study: {
      id: 'life-event-frequency-1000-v1',
      engine: 'real',
      runCount: RUN_COUNT,
      boundariesPerRun: BOUNDARIES_PER_RUN,
      totalBoundaries: runs.reduce((sum, run) => sum + run.boundaries, 0),
      sameBoundaryCount: runs.reduce(
        (sum, run) => sum + run.sameBoundaryCount,
        0,
      ),
      intervalMinutes: lifeEventData.intervalMinutes,
      horizonDays: 60,
      timezone: 'UTC',
    },
    configured: {
      events: lifeEventData.events.map((event) => ({
        id: event.id,
        rollDenominator: event.rollDenominator,
      })),
    },
    totals,
    meanSuccessfulRollsPerRun: totalSuccessfulRolls / RUN_COUNT,
    runs,
  };
}
