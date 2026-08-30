import type { GameEvent, GameState, StatusName } from '../../../../src/lib/game-types';
import rules from '../../../../src/lib/data/simulation-rules.json';
import { HOUR_MS } from '../../../../src/lib/game-constants';

const RETAINED_BLOCKERS = new Set<StatusName>(
  rules.stream.blockers as StatusName[],
);

export function cadenceAnalysis(state: GameState) {
  const start = state.history.runStartedAt;
  const end = state.ending?.at ?? state.now;
  const opportunities = state.events.filter(
    (event) => event.type === 'random_event_opportunity',
  );
  const timeOwned = opportunities.filter((event) =>
    event.sourceActionId?.startsWith('autonomous:'),
  );
  const starts = state.events.filter(
    (event) =>
      event.type === 'stream_candidate' &&
      event.ordinaryStream &&
      event.streamActivityStarted,
  );
  const streamEnds = state.events.filter(
    (event) =>
      event.activityType === 'stream' &&
      (event.type === 'activity_completed' ||
        event.type === 'activity_interrupted'),
  );
  const qualifyingAnchors = streamEnds.flatMap((event) =>
    event.droughtResetQualified && event.droughtResetAnchorAt !== undefined
      ? [event.droughtResetAnchorAt]
      : [],
  );
  const elapsedDays = Math.max((end - start) / (24 * HOUR_MS), 0);
  return {
    autonomousBoundariesDue: Math.floor(
      (end - start) /
        (rules.events.autonomous.intervalHours * HOUR_MS),
    ),
    autonomousBoundariesProcessed: timeOwned.length,
    attemptOwnedOpportunities: opportunities.length - timeOwned.length,
    streamEligibleOpportunities: opportunities.filter(
      (event) => event.streamEligible,
    ).length,
    activityBlockedOpportunities: opportunities.filter(
      (event) => event.streamBlockedByActivity,
    ).length,
    blockedOpportunitiesByStatus: frequency(
      opportunities.flatMap((event) => event.streamBlockers ?? []),
    ),
    blockedHours: round(retainedBlockerHours(state.events, start, end), 2),
    streamCandidates: opportunities.filter(
      (event) => event.streamCandidateSelected,
    ).length,
    tooTiredSelections: state.events.filter(
      (event) =>
        event.type === 'stream_candidate' &&
        event.ordinaryStream &&
        event.streamActivityStarted === false,
    ).length,
    ordinaryStreamStarts: starts.length,
    qualifyingDroughtResets: qualifyingAnchors.length,
    ordinaryInterruptions: streamEnds.filter(
      (event) => event.ordinaryStream && event.interrupted,
    ).length,
    ordinaryMidnightCaps: streamEnds.filter(
      (event) => event.ordinaryStream && event.midnightCapped,
    ).length,
    totalStreamHours: round(
      streamEnds.reduce(
        (sum, event) => sum + (event.actualDurationMs ?? 0) / HOUR_MS,
        0,
      ),
      2,
    ),
    maximumActualStartGapHours: round(
      maximumGap(start, end, starts.map((event) => event.at)) / HOUR_MS,
      2,
    ),
    maximumQualifyingResetGapHours: round(
      maximumGap(start, end, qualifyingAnchors) / HOUR_MS,
      2,
    ),
    startsPerDay: elapsedDays ? round(starts.length / elapsedDays, 3) : 0,
    startsPerTwoDays: elapsedDays
      ? round((starts.length * 2) / elapsedDays, 3)
      : 0,
  };
}

function retainedBlockerHours(events: GameEvent[], start: number, end: number) {
  const active = new Set<StatusName>();
  let cursor = start;
  let total = 0;
  for (const event of [...events].sort(
    (left, right) => left.at - right.at || left.id.localeCompare(right.id),
  )) {
    if (!event.status || !RETAINED_BLOCKERS.has(event.status)) continue;
    if (active.size) total += Math.max(0, event.at - cursor);
    cursor = event.at;
    if (event.type === 'status_added' || event.type === 'status_onset')
      active.add(event.status);
    if (event.type === 'status_cleared') active.delete(event.status);
  }
  if (active.size) total += Math.max(0, end - cursor);
  return total / HOUR_MS;
}

function maximumGap(start: number, end: number, values: number[]) {
  const boundaries = [
    start,
    ...new Set(values.filter((value) => value >= start && value <= end)),
    end,
  ].sort((left, right) => left - right);
  let maximum = 0;
  for (let index = 1; index < boundaries.length; index += 1)
    maximum = Math.max(maximum, boundaries[index] - boundaries[index - 1]);
  return maximum;
}

function frequency(values: string[]) {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
