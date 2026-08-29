import type { GameDefinition } from '../game-definition';
import type { GameEvent, GameState, Transition } from '../game-types';
import { completeActivity } from './activity-completion';
import { resolveDecay } from './decay-resolution';
import { resolveTimelineEffects } from './timeline-effects';
import { criticalMetrics, isCriticalState } from './health-resolution';
import { resolvePostHealthRescues } from './post-health-rescue';
import { reconcileRunEnding } from '../ending-rules';
import {
  catchUpLifeEvents,
  nextReconciliationBoundaries,
} from './reconcile-time-boundaries';

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
  if (state.ending)
    return { state, outcomes: [], elapsedHours: 0, eventIds: [] };
  if (state.metrics.health <= 0) {
    const terminal = reconcileRunEnding(state);
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

  const { lifeEventBoundary, nextRegularBoundary, nextBoundary } =
    nextReconciliationBoundaries(state, now);
  if (nextBoundary !== null) {
    if (nextBoundary === lifeEventBoundary) {
      const lifeCatchUp = catchUpLifeEvents(state, now, nextRegularBoundary);
      const throughTarget = reconcileTime(
        lifeCatchUp.state,
        now,
        definition,
        options,
      );
      return {
        state: throughTarget.state,
        outcomes: [
          ...lifeCatchUp.eventIds.map((id) => ({
            accepted: true,
            kind: 'time_reconciled',
            message: 'Time reconciled.',
            eventIds: [id],
          })),
          ...throughTarget.outcomes,
        ],
        elapsedHours: throughTarget.elapsedHours,
        eventIds: [...lifeCatchUp.eventIds, ...throughTarget.eventIds],
      };
    }
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
  const resolvedAnything =
    decay.intervals > 0 || decay.healthIntervals > 0 || decay.bondIntervals > 0;
  const eventIds: string[] = [];
  if (resolvedAnything) {
    const event = timeEvent(next, reconciliationNow, decay);
    next = { ...next, events: [...next.events, event] };
    eventIds.push(event.id);
    if (!deathAt && decay.healthDamageSources.length > 0) {
      const rescues = resolvePostHealthRescues({
        state: next,
        definition,
        damageSources: decay.healthDamageSources,
        damageEventId: event.id,
      });
      next = rescues.state;
      eventIds.push(...rescues.eventIds);
    }
  }
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
  eventIds.push(...timeline.eventIds);
  deathAt = timeline.deathAt;
  reconciliationNow = timeline.reconciliationNow;
  const elapsedHours = timeline.resolvedElapsedHours;
  if (resolvedAnything) next = { ...next, stateVersion: next.stateVersion + 1 };

  if (next.ending) return result(next, eventIds, elapsedHours);

  if (deathAt) {
    if (!timeline.lethalEventId && !resolvedAnything) {
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

  if (!resolvedAnything && eventIds.length > 0) {
    next = { ...next, stateVersion: next.stateVersion + 1 };
  }

  const beforeEnding = next.events.length;
  next = reconcileRunEnding(next);
  eventIds.push(...next.events.slice(beforeEnding).map((event) => event.id));
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
    rawNeedDamageSources:
      decay.rawNeedDamageSources.length > 0
        ? decay.rawNeedDamageSources
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
  const beforeEnding = state.events.length;
  const terminal = reconcileRunEnding(state);
  eventIds.push(
    ...terminal.events.slice(beforeEnding).map((event) => event.id),
  );
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
