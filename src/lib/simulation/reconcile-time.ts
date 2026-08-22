import type { GameDefinition } from '../game-definition';
import type { GameEvent, GameState, Transition } from '../game-types';
import rules from '../data/simulation-rules.json';
import { recordDeathIfNeeded } from './engine-state';
import { completeActivity } from './activity-completion';
import { resolveDecay } from './decay-resolution';
import { resolveTimelineEffects } from './timeline-effects';
import { nextStatusBoundary } from '../status-rules';
import { nextLocalMidnight } from '../shop-rules';
import { HOUR_MS } from '../game-constants';

export type ReconcileResult = Transition & {
  elapsedHours: number;
  eventIds: string[];
};

export function reconcileTime(
  state: GameState,
  now: number,
  definition: GameDefinition,
): ReconcileResult {
  if (state.death)
    return { state, outcomes: [], elapsedHours: 0, eventIds: [] };
  if (state.metrics.health <= 0) {
    const terminal = recordDeathIfNeeded(state);
    return {
      state: terminal,
      outcomes: [],
      elapsedHours: 0,
      eventIds: terminal.events
        .slice(state.events.length)
        .map((event) => event.id),
    };
  }
  if (now <= state.lastResolvedAt)
    return { state, outcomes: [], elapsedHours: 0, eventIds: [] };

  const intervalHours = rules.timeDecay.intervalHours;
  const nextDecayAt =
    state.lastResolvedAt +
    (intervalHours - state.history.decayRemainderHours) * HOUR_MS;
  const nextStatusAt = nextStatusBoundary(state, state.lastResolvedAt);
  const nextMidnightAt = nextLocalMidnight(
    state.lastResolvedAt,
    state.timezone,
  );
  const boundaries = [
    state.activity?.endsAt,
    state.history.sugarCrashDueAt ?? undefined,
    nextDecayAt,
    nextStatusAt,
    nextMidnightAt,
  ].filter(
    (boundary): boundary is number =>
      typeof boundary === 'number' &&
      boundary > state.lastResolvedAt &&
      boundary < now,
  );
  const nextBoundary = boundaries.length ? Math.min(...boundaries) : null;
  if (nextBoundary !== null) {
    const throughBoundary = reconcileTime(state, nextBoundary, definition);
    const throughTarget = reconcileTime(throughBoundary.state, now, definition);
    return {
      state: throughTarget.state,
      outcomes: [...throughBoundary.outcomes, ...throughTarget.outcomes],
      elapsedHours: throughBoundary.elapsedHours + throughTarget.elapsedHours,
      eventIds: [...throughBoundary.eventIds, ...throughTarget.eventIds],
    };
  }

  const decay = resolveDecay(state, now);
  const {
    intervals,
    metricDeltas,
    statusReconciliation,
    streamSnackRequests,
    bondIntervals,
    resolvedDecayRemainderHours,
  } = decay;
  let deathAt = decay.deathAt;
  let reconciliationNow = decay.reconciliationNow;
  let next: GameState = {
    ...state,
    now: reconciliationNow,
    lastResolvedAt: reconciliationNow,
    stateVersion: state.stateVersion,
    metrics: statusReconciliation.metrics,
    statuses: statusReconciliation.statuses,
    history: {
      ...state.history,
      lastStatusReconcileAt: reconciliationNow,
      decayRemainderHours: resolvedDecayRemainderHours,
      lastBondGainAt: decay.lastBondGainAt,
      sugarCrashDueAt: statusReconciliation.sugarCrashDueAt,
    },
  };
  const timeline = resolveTimelineEffects({
    state: next,
    definition,
    statusReconciliation,
    reconciliationNow,
    deathAt,
    streamSnackRequests,
    lastResolvedAt: state.lastResolvedAt,
  });
  next = timeline.state;
  const eventIds = timeline.eventIds;
  deathAt = timeline.deathAt;
  const lethalEventId = timeline.lethalEventId;
  reconciliationNow = timeline.reconciliationNow;
  const resolvedElapsedHours = timeline.resolvedElapsedHours;
  if (
    !deathAt &&
    next.metrics.health > 0 &&
    next.activity &&
    reconciliationNow >= next.activity.endsAt
  ) {
    const completion = completeActivity({
      state: next,
      activity: next.activity,
      reconciliationNow,
      definition,
    });
    next = completion.state;
    eventIds.push(...completion.eventIds);
  }
  if (deathAt) {
    let terminalEventId: string | undefined;
    if (!lethalEventId) {
      const event: GameEvent = {
        id: `event-${next.events.length + 1}`,
        type: 'critical_health_loss',
        at: reconciliationNow,
        message: 'Critical needs caused the final Health loss.',
        metricDeltas,
      };
      terminalEventId = event.id;
      next = {
        ...next,
        events: [...next.events, event],
        stateVersion: next.stateVersion + 1,
      };
    }
    const beforeDeathEventCount = next.events.length;
    next = recordDeathIfNeeded(next);
    if (terminalEventId) eventIds.push(terminalEventId);
    eventIds.push(
      ...next.events.slice(beforeDeathEventCount).map((item) => item.id),
    );
    return result(next, eventIds, resolvedElapsedHours);
  }
  if (intervals === 0 && bondIntervals === 0 && eventIds.length === 0) {
    next = recordDeathIfNeeded(next);
    return {
      state: next,
      outcomes: [],
      elapsedHours: resolvedElapsedHours,
      eventIds: [],
    };
  }
  if (intervals === 0 && bondIntervals === 0) {
    const beforeDeathEventCount = next.events.length;
    next = recordDeathIfNeeded(next);
    eventIds.push(
      ...next.events.slice(beforeDeathEventCount).map((event) => event.id),
    );
    next = { ...next, stateVersion: next.stateVersion + 1 };
    return result(next, eventIds, resolvedElapsedHours);
  }
  const event: GameEvent = {
    id: `event-${next.events.length + 1}`,
    type: 'time_reconciled',
    at: reconciliationNow,
    message: `${intervals} decay interval${intervals === 1 ? '' : 's'} resolved.`,
    metricDeltas,
  };
  next = {
    ...next,
    events: [...next.events, event],
    stateVersion: next.stateVersion + 1,
  };
  eventIds.push(event.id);
  const beforeDeathEventCount = next.events.length;
  next = recordDeathIfNeeded(next);
  eventIds.push(
    ...next.events
      .slice(beforeDeathEventCount)
      .map((deathEvent) => deathEvent.id),
  );
  return result(next, eventIds, resolvedElapsedHours);
}

function result(
  state: GameState,
  eventIds: string[],
  elapsedHours: number,
): ReconcileResult {
  return {
    state,
    outcomes: eventIds.map((id) => ({
      accepted: true,
      kind: 'time_reconciled',
      message: 'Time reconciled.',
      eventIds: [id],
    })),
    elapsedHours,
    eventIds,
  };
}
