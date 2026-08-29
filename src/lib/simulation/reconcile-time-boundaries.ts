import type { GameState } from '../game-types';
import type { GameDefinition } from '../game-definition';
import rules from '../data/simulation-rules.json';
import { nextStatusBoundary } from '../status-rules';
import { nextLocalMidnight } from '../shop-rules';
import { HOUR_MS } from '../game-constants';
import { nextEndingBoundary } from '../ending-rules';
import {
  nextLifeEventBoundary,
  processLifeEventBoundary,
} from '../life-event-scheduler';

export type ReconciliationBoundarySet = {
  lifeEventBoundary: number;
  nextRegularBoundary: number;
  nextBoundary: number | null;
};

/** Find the next chronological timeline boundary, including life events. */
export function nextReconciliationBoundaries(
  state: GameState,
  now: number,
): ReconciliationBoundarySet {
  const intervalHours = rules.timeDecay.intervalHours;
  const nextDecayAt =
    state.lastResolvedAt +
    (intervalHours - state.history.decayRemainderHours) * HOUR_MS;
  const nextHealthAt = state.activity
    ? undefined
    : state.lastResolvedAt +
      (intervalHours - state.history.healthRemainderHours) * HOUR_MS;
  const potentialRegularBoundaries = [
    state.activity?.endsAt,
    state.history.sugarCrashDueAt ?? undefined,
    state.timedEffects.deferredRestLossAt ?? undefined,
    state.timedEffects.hyperfocusUntil ?? undefined,
    state.timedEffects.clippers?.nextClipAt,
    state.timedEffects.clippers?.expiresAt,
    ...state.progression.discoveryBoosts.map((boost) => boost.expiresAt),
    state.history.cravingStartedAt !== null
      ? state.history.cravingStartedAt + rules.craving.expiryHours * HOUR_MS
      : undefined,
    state.history.nextAutonomousAt,
    ...state.projects.map((project) => project.completesAt),
    nextDecayAt,
    nextHealthAt,
    nextStatusBoundary(state, state.lastResolvedAt),
    nextLocalMidnight(state.lastResolvedAt, state.timezone),
    nextEndingBoundary(state),
  ];
  const regularBoundaries = potentialRegularBoundaries.filter(
    (boundary): boundary is number =>
      typeof boundary === 'number' &&
      boundary > state.lastResolvedAt &&
      boundary < now,
  );
  const lifeEventBoundary = nextLifeEventBoundary(state);
  if (lifeEventBoundary > state.lastResolvedAt && lifeEventBoundary <= now)
    regularBoundaries.push(lifeEventBoundary);
  const nextRegularBoundary = potentialRegularBoundaries.reduce<number>(
    (minimum, boundary) => {
      if (
        typeof boundary !== 'number' ||
        boundary <= state.lastResolvedAt ||
        boundary >= now
      )
        return minimum;
      return Math.min(minimum, boundary);
    },
    Infinity,
  );
  return {
    lifeEventBoundary,
    nextRegularBoundary,
    nextBoundary: regularBoundaries.length
      ? Math.min(...regularBoundaries)
      : null,
  };
}

/** Resolve contiguous run-anchored life-event boundaries without recursion. */
export function catchUpLifeEvents(
  state: GameState,
  now: number,
  nextRegularBoundary: number,
  definition: GameDefinition,
): { state: GameState; eventIds: string[] } {
  let lifeState = state;
  const eventIds: string[] = [];
  while (!lifeState.ending) {
    const boundary = nextLifeEventBoundary(lifeState);
    if (boundary > now || boundary > nextRegularBoundary) break;
    const lifeEvents = processLifeEventBoundary(
      lifeState,
      boundary,
      undefined,
      definition,
    );
    lifeState = lifeEvents.state;
    eventIds.push(...lifeEvents.eventIds);
  }
  return { state: lifeState, eventIds };
}
