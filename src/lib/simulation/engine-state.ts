import type { ItemDefinition } from '../game-definition';
import type {
  GameCommand,
  GameEvent,
  GameState,
  Outcome,
  Transition,
} from '../game-types';
import {
  criticalHealthMoodDelta,
  isCriticalHealthForMood,
  STATUS_NAMES,
  resolveAttemptStatus,
} from '../status-rules';
import { STAT_MIN } from '../game-constants';
import { statusTransitionMessage } from '../event-messages';

export function appendStatusTransitionEvents(
  state: GameState,
  before: GameState['statuses'],
  sourceActionId: string,
): GameState {
  const changes: GameEvent[] = [];
  for (const status of STATUS_NAMES) {
    const wasActive = Boolean(before[status]);
    const isActive = Boolean(state.statuses[status]);
    if (wasActive === isActive) continue;
    changes.push({
      id: `event-${state.events.length + changes.length + 1}`,
      type: isActive ? 'status_added' : 'status_cleared',
      at: state.now,
      message: statusTransitionMessage(status, isActive),
      sourceActionId,
      status,
      cause: isActive ? state.statuses[status]?.source : 'explicit_action',
    });
  }
  return changes.length
    ? { ...state, events: [...state.events, ...changes] }
    : state;
}

export function isCompanionAttempt(type: GameCommand['type']): boolean {
  return ![
    'wait',
    'buy_item',
    'set_cart_quantity',
    'checkout_cart',
    'place_item',
    'unplace_item',
    'medical_care',
  ].includes(type);
}

export function recordDeathIfNeeded(state: GameState): GameState {
  if (state.death || state.metrics.health > 0) return state;
  const finalCause = [...state.events]
    .reverse()
    .find((event) => (event.metricDeltas?.health ?? 0) < 0);
  const cause =
    finalCause?.message ?? 'Final Health loss from a critical need.';
  const causalIds = finalCause
    ? [...(finalCause.causedBy ?? []), finalCause.id]
    : [];
  const deathEvent: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'death',
    at: state.now,
    message: 'Companion died.',
    cause,
    causedBy: causalIds,
  };
  return {
    ...state,
    death: { at: state.now, cause, eventIds: [...causalIds, deathEvent.id] },
    events: [...state.events, deathEvent],
  };
}

export function supportsQuantity(item: ItemDefinition): boolean {
  return Boolean(
    (item as ItemDefinition & { supportsQuantity?: boolean }).supportsQuantity,
  );
}

export function applyRoomMetricDelta(
  metrics: GameState['metrics'],
  effects: Partial<GameState['metrics']> | undefined,
  min: number,
  max: number,
  multiplier = 1,
): GameState['metrics'] {
  if (!effects) return metrics;
  const next = { ...metrics };
  for (const [key, value] of Object.entries(effects)) {
    const metric = key as keyof GameState['metrics'];
    next[metric] = Math.max(
      min,
      Math.min(max, next[metric] + (value ?? 0) * multiplier),
    );
  }
  return next;
}

export function appliedRoomMetricDelta(
  metrics: GameState['metrics'],
  effects: Partial<GameState['metrics']> | undefined,
  min: number,
  max: number,
): Partial<GameState['metrics']> {
  if (!effects) return {};
  const applied: Partial<GameState['metrics']> = {};
  for (const [key, value] of Object.entries(effects)) {
    const metric = key as keyof GameState['metrics'];
    const target = Math.max(min, Math.min(max, metrics[metric] + (value ?? 0)));
    applied[metric] = target - metrics[metric];
  }
  return applied;
}

export function recordBondGain(
  state: GameState,
  before: GameState,
  at = state.now,
): GameState {
  if (state.metrics.bond <= before.metrics.bond) return state;
  return {
    ...state,
    history: { ...state.history, lastBondGainAt: at },
  };
}

export function applyCriticalHealthMoodPenalty(
  state: GameState,
  before: GameState,
  sourceActionId: string,
): GameState {
  if (!isCriticalHealthForMood(before.metrics.health)) return state;
  const changed = (['food', 'rest', 'bond', 'creativity'] as const).some(
    (metric) => state.metrics[metric] !== before.metrics[metric],
  );
  if (!changed) return state;
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'critical_health_mood_penalty',
    at: state.now,
    message: 'Critical Health made the companion feel worse.',
    sourceActionId,
    metricDeltas: { mood: criticalHealthMoodDelta() },
  };
  return {
    ...state,
    metrics: {
      ...state.metrics,
      mood: Math.max(STAT_MIN, state.metrics.mood + criticalHealthMoodDelta()),
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
}

export function recordAttempt(
  state: GameState,
  outcome: Outcome,
  before: GameState = state,
  sourceActionId?: string,
  attemptType?: GameCommand['type'],
): GameState {
  const attemptStatus = resolveAttemptStatus(state, outcome.accepted);
  const becameAnnoyed = attemptStatus.moodDelta !== 0;
  const careMetricChanged = (
    ['food', 'rest', 'bond', 'creativity'] as const
  ).some((metric) => state.metrics[metric] !== before.metrics[metric]);
  const criticalPenalty =
    isCriticalHealthForMood(before.metrics.health) &&
    careMetricChanged &&
    !state.events.some(
      (event) =>
        event.type === 'critical_health_mood_penalty' &&
        event.sourceActionId === sourceActionId,
    );
  const interaction = attemptType === 'socialize' || attemptType === 'play';
  const next = {
    ...state,
    metrics:
      becameAnnoyed || criticalPenalty
        ? {
            ...state.metrics,
            mood: Math.max(
              STAT_MIN,
              state.metrics.mood -
                (becameAnnoyed ? Math.abs(attemptStatus.moodDelta) : 0),
            ),
          }
        : state.metrics,
    statuses: attemptStatus.statuses,
    history: {
      ...state.history,
      lastCareAttemptAt: before.now,
      lastInteractionAt: before.now,
      careAttemptStreak: becameAnnoyed
        ? 0
        : outcome.accepted
          ? 0
          : state.history.careAttemptStreak + 1,
      repeatAction: interaction ? attemptType : null,
      repeatCount: interaction
        ? state.history.repeatAction === attemptType
          ? state.history.repeatCount + 1
          : 1
        : 0,
    },
    stateVersion: state.stateVersion + 1,
  };
  return criticalPenalty
    ? applyCriticalHealthMoodPenalty(next, before, sourceActionId ?? 'attempt')
    : next;
}

export function accepted(
  kind: string,
  message: string,
  eventIds: string[] = [],
): Outcome {
  return { accepted: true, kind, message, eventIds };
}

export function rejected(kind: string, message: string): Outcome {
  return { accepted: false, kind, message, eventIds: [] };
}

export function remember(
  state: GameState,
  commandId: string,
  outcome: Outcome,
): Transition {
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'command_outcome',
    at: state.now,
    message: outcome.message,
    sourceActionId: commandId,
    causedBy: outcome.eventIds,
  };
  const receiptState = {
    ...state,
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
  const receiptOutcome = {
    ...outcome,
    eventIds: [...outcome.eventIds, event.id],
  };
  const receipt = {
    ...receiptOutcome,
    commandId,
    stateVersion: receiptState.stateVersion,
  };
  return {
    state: {
      ...receiptState,
      processedCommands: {
        ...receiptState.processedCommands,
        [commandId]: {
          outcome: receipt,
          stateVersion: receiptState.stateVersion,
        },
      },
    },
    outcomes: [receipt],
  };
}
