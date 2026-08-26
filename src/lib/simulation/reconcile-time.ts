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
import { criticalMetrics, isCriticalState } from './health-resolution';

export type ReconcileResult = Transition & {
  elapsedHours: number;
  eventIds: string[];
};

export type ReconcileOptions = {
  stopAtCritical?: boolean;
  preventLethalDecay?: boolean;
};

export function reconcileTime(
  state: GameState,
  now: number,
  definition: GameDefinition,
  options: ReconcileOptions = {},
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
  const nextHealthAt = state.activity
    ? undefined
    : state.lastResolvedAt +
      (intervalHours - state.history.healthRemainderHours) * HOUR_MS;
  const nextStatusAt = nextStatusBoundary(state, state.lastResolvedAt);
  const nextMidnightAt = nextLocalMidnight(
    state.lastResolvedAt,
    state.timezone,
  );
  const boundaries = [
    state.activity?.endsAt,
    state.history.sugarCrashDueAt ?? undefined,
    state.timedEffects.deferredRestLossAt ?? undefined,
    state.timedEffects.hyperfocusUntil ?? undefined,
    state.timedEffects.clippers?.nextClipAt,
    state.timedEffects.clippers?.expiresAt,
    state.history.cravingStartedAt !== null
      ? state.history.cravingStartedAt + rules.craving.expiryHours * HOUR_MS
      : undefined,
    state.history.nextAutonomousAt,
    ...state.projects.map((project) => project.completesAt),
    nextDecayAt,
    nextHealthAt,
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
    const throughBoundary = reconcileTime(
      state,
      nextBoundary,
      definition,
      options,
    );
    if (
      options.stopAtCritical &&
      !isCriticalState(state) &&
      isCriticalState(throughBoundary.state)
    )
      return throughBoundary;
    if (
      state.mode === 'streaming' &&
      state.activity &&
      !throughBoundary.state.activity &&
      throughBoundary.state.events
        .slice(state.events.length)
        .some((event) => event.type === 'activity_interrupted')
    )
      return throughBoundary;
    const throughTarget = reconcileTime(
      throughBoundary.state,
      now,
      definition,
      options,
    );
    return {
      state: throughTarget.state,
      outcomes: [...throughBoundary.outcomes, ...throughTarget.outcomes],
      elapsedHours: throughBoundary.elapsedHours + throughTarget.elapsedHours,
      eventIds: [...throughBoundary.eventIds, ...throughTarget.eventIds],
    };
  }

  const decay = resolveDecay(state, now, {
    preventLethal: options.preventLethalDecay,
  });
  let deathAt = decay.deathAt;
  let reconciliationNow = decay.reconciliationNow;
  let next: GameState = {
    ...state,
    now: reconciliationNow,
    lastResolvedAt: reconciliationNow,
    metrics: decay.statusReconciliation.metrics,
    statuses: decay.statusReconciliation.statuses,
    history: {
      ...state.history,
      lastStatusReconcileAt: reconciliationNow,
      decayRemainderHours: decay.resolvedDecayRemainderHours,
      healthRemainderHours: decay.resolvedHealthRemainderHours,
      pendingFoodDecayHit: decay.pendingFoodDecayHit,
      lastBondGainAt: decay.lastBondGainAt,
      sugarCrashDueAt: decay.statusReconciliation.sugarCrashDueAt,
    },
    timedEffects: decay.timedEffects,
  };
  const timeline = resolveTimelineEffects({
    state: next,
    definition,
    statusReconciliation: decay.statusReconciliation,
    reconciliationNow,
    deathAt,
    streamSnackRequests: decay.streamSnackRequests,
    lastResolvedAt: state.lastResolvedAt,
    autonomousOpportunity: state.history.nextAutonomousAt <= reconciliationNow,
    preventLethal: options.preventLethalDecay,
  });
  next = timeline.state;
  const eventIds = timeline.eventIds;
  deathAt = timeline.deathAt;
  reconciliationNow = timeline.reconciliationNow;
  const elapsedHours = timeline.resolvedElapsedHours;

  if (deathAt) {
    if (!timeline.lethalEventId) {
      const event = timeEvent(next, reconciliationNow, decay);
      next = appendEvent(next, event);
      eventIds.push(event.id);
    }
    return terminalResult(next, eventIds, elapsedHours);
  }
  if (next.metrics.health <= 0)
    return terminalResult(next, eventIds, elapsedHours);

  if (
    next.activity &&
    next.activity.type !== 'medical_care' &&
    hasNewCriticalCondition(next)
  ) {
    const completion = completeActivity({
      state: next,
      activity: next.activity,
      reconciliationNow,
      definition,
      interrupted: true,
    });
    next = completion.state;
    eventIds.push(...completion.eventIds);
  } else if (next.activity && reconciliationNow >= next.activity.endsAt) {
    const completion = completeActivity({
      state: next,
      activity: next.activity,
      reconciliationNow,
      definition,
    });
    next = completion.state;
    eventIds.push(...completion.eventIds);
  }

  const resolvedAnything =
    decay.intervals > 0 || decay.healthIntervals > 0 || decay.bondIntervals > 0;
  if (resolvedAnything) {
    const event = timeEvent(next, reconciliationNow, decay);
    next = appendEvent(next, event);
    eventIds.push(event.id);
  } else if (eventIds.length > 0) {
    next = { ...next, stateVersion: next.stateVersion + 1 };
  }

  const beforeDeath = next.events.length;
  next = recordDeathIfNeeded(next);
  eventIds.push(...next.events.slice(beforeDeath).map((event) => event.id));
  if (!resolvedAnything && eventIds.length === 0)
    return { state: next, outcomes: [], elapsedHours, eventIds: [] };
  return result(next, eventIds, elapsedHours);
}

function timeEvent(
  state: GameState,
  at: number,
  decay: ReturnType<typeof resolveDecay>,
): GameEvent {
  return {
    id: `event-${state.events.length + 1}`,
    type: 'time_reconciled',
    at,
    message: 'Time-based simulation rules were resolved.',
    metricDeltas: decay.metricDeltas,
    healthDamageSources:
      decay.healthDamageSources.length > 0
        ? decay.healthDamageSources
        : undefined,
    healthRecovery: decay.healthRecovery || undefined,
  };
}

function appendEvent(state: GameState, event: GameEvent): GameState {
  return {
    ...state,
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
}

function terminalResult(
  state: GameState,
  eventIds: string[],
  elapsedHours: number,
): ReconcileResult {
  const beforeDeath = state.events.length;
  const terminal = recordDeathIfNeeded(state);
  eventIds.push(...terminal.events.slice(beforeDeath).map((event) => event.id));
  return result(terminal, eventIds, elapsedHours);
}

function hasNewCriticalCondition(state: GameState): boolean {
  if (!state.activity) return false;
  const starting = String(state.activity.payload?.startingCriticalMetrics ?? '')
    .split(',')
    .filter(Boolean);
  return criticalMetrics(state.metrics).some(
    (metric) => !starting.includes(metric),
  );
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
