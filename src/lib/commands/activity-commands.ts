import type { GameDefinition } from '../game-definition';
import type { GameEvent, GameState, Outcome } from '../game-types';
import rules from '../data/simulation-rules.json';
import { chooseDuration, refusalProbability } from '../activity-rules';
import { actionRandom } from '../seeded-rng';
import { applyOverstimulation, isHighMood } from '../status-rules';
import { accepted, rejected } from '../simulation/engine-state';
import { HOUR_MS } from '../game-constants';
import {
  criticalMetrics,
  isCriticalState,
} from '../simulation/health-resolution';
import { hospitalCost, hospitalInsuranceItemId } from '../billing-rules';

export type ActivityCommandResult = {
  handled: boolean;
  state: GameState;
  outcome: Outcome;
  completionOwnsAttemptOpportunity: boolean;
};

type ActivityFields = {
  commandId: string;
  now: number;
  expectedStateVersion?: number;
};
type ActivityCommand =
  | (ActivityFields & { type: 'wait' })
  | (ActivityFields & { type: 'medical_care' })
  | (ActivityFields & { type: 'rest' | 'socialize' | 'play' })
  | (ActivityFields & { type: 'commission_work' });
type WaitCommand = Extract<ActivityCommand, { type: 'wait' }>;
type MedicalCareCommand = Extract<ActivityCommand, { type: 'medical_care' }>;
type CompanionCommand = Extract<
  ActivityCommand,
  { type: 'rest' | 'socialize' | 'play' }
>;
type CommissionCommand = Extract<ActivityCommand, { type: 'commission_work' }>;

type ReconcileResult = {
  state: GameState;
  eventIds: string[];
  elapsedHours: number;
};
type Reconcile = (
  state: GameState,
  now: number,
  definition: GameDefinition,
  options?: { stopAtCritical?: boolean; preventLethalDecay?: boolean },
) => ReconcileResult;

export function handleActivityCommand(
  state: GameState,
  command: ActivityCommand,
  definition: GameDefinition,
  reconcile: Reconcile,
): ActivityCommandResult {
  if (command.type === 'wait')
    return wait(state, command, definition, reconcile);
  if (command.type === 'medical_care')
    return medicalCare(state, command, definition);
  if (command.type === 'commission_work') return commissionWork(state, command);
  return companionActivity(state, command);
}

function commissionWork(
  state: GameState,
  command: CommissionCommand,
): ActivityCommandResult {
  return result(
    state,
    rejected(
      'unavailable',
      `Commission Work is launched from the Rigging Tablet. (${command.commandId})`,
    ),
  );
}

function wait(
  state: GameState,
  command: WaitCommand,
  definition: GameDefinition,
  reconcile: Reconcile,
): ActivityCommandResult {
  if (state.mode !== 'streaming')
    return result(
      state,
      rejected(
        'unavailable',
        'Advance time is available in Streaming mode only.',
      ),
    );
  const critical = isCriticalState(state);
  const minimum = critical ? rules.wait.criticalMinHours : rules.wait.minHours;
  const maximum = critical ? rules.wait.criticalMaxHours : rules.wait.maxHours;
  const hours =
    minimum +
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        command.commandId,
        'wait',
        'hours',
      ) *
        (maximum - minimum + 1),
    );
  const waited = reconcile(state, state.now + hours * HOUR_MS, definition, {
    stopAtCritical: !critical,
    preventLethalDecay: !critical,
  });
  const actualHoursValue = waited.elapsedHours;
  return result(
    waited.state,
    accepted(
      'waited',
      `Time advanced ${formatHours(actualHoursValue)}.`,
      waited.eventIds,
    ),
  );
}

function medicalCare(
  state: GameState,
  command: MedicalCareCommand,
  definition: GameDefinition,
): ActivityCommandResult {
  if (!state.statuses.kidney_stone && !state.statuses.sick)
    return result(
      state,
      rejected('unavailable', 'Hospital care is not needed.'),
    );
  const duration = rules.medicalCare.durationHours * HOUR_MS;
  const insuranceItemId = hospitalInsuranceItemId(state, definition);
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'activity_started',
    at: state.now,
    message: 'Hospital visit started.',
    sourceActionId: command.commandId,
    activityType: 'medical_care',
  };
  const next: GameState = {
    ...state,
    activity: {
      id: `activity-${state.actionOrdinal + 1}`,
      type: 'medical_care',
      startedAt: state.now,
      endsAt: state.now + duration,
      sourceActionId: command.commandId,
    },
    balance: state.balance - hospitalCost(state, definition),
    inventory: insuranceItemId
      ? {
          ...state.inventory,
          [insuranceItemId]: Math.max(
            0,
            (state.inventory[insuranceItemId] ?? 0) - 1,
          ),
        }
      : state.inventory,
    actionOrdinal: state.actionOrdinal + 1,
    stateVersion: state.stateVersion + 1,
    events: [...state.events, event],
  };
  return {
    handled: true,
    state: next,
    outcome: accepted('medical_started', 'Hospital visit started.', [event.id]),
    completionOwnsAttemptOpportunity: true,
  };
}

function companionActivity(
  state: GameState,
  command: CompanionCommand,
): ActivityCommandResult {
  const overstimulated =
    (command.type === 'socialize' || command.type === 'play') &&
    isHighMood(state.metrics.mood);
  let next = state;
  if (overstimulated) {
    const stimulation = applyOverstimulation(
      next.metrics,
      next.statuses,
      'high_mood_attempt',
      next.now,
      true,
    );
    next = {
      ...next,
      metrics: stimulation.metrics,
      statuses: stimulation.statuses,
      stateVersion: next.stateVersion + 1,
    };
  }
  const duration = chooseDuration(command.type, next, command.commandId);
  if (command.type === 'rest' && duration === 0)
    return result(
      next,
      rejected('refused', 'Companion refuses to rest right now.'),
    );
  if (
    (command.type === 'socialize' || command.type === 'play') &&
    actionRandom(
      next.seed,
      next.stateVersion,
      command.commandId,
      'refusal',
      'attempt',
    ) < refusalProbability(next)
  )
    return result(
      next,
      rejected('refused', 'Companion refused that interaction.'),
    );

  const event: GameEvent = {
    id: `event-${next.events.length + 1}`,
    type: 'activity_started',
    at: next.now,
    message: `${activityLabel(command.type)} started.`,
    sourceActionId: command.commandId,
    activityType: command.type,
  };
  next = {
    ...next,
    activity: {
      id: `activity-${next.actionOrdinal + 1}`,
      type: command.type,
      startedAt: next.now,
      endsAt: next.now + duration,
      sourceActionId: command.commandId,
      payload: {
        ...(overstimulated ? { suppressMoodGain: true } : {}),
        startingRest: next.metrics.rest,
        startingCriticalMetrics: criticalMetrics(next.metrics).join(','),
      },
    },
    actionOrdinal: next.actionOrdinal + 1,
    stateVersion: next.stateVersion + 1,
    history: {
      ...next.history,
      lastInteractionAt: next.now,
      lastCareAttemptAt: next.now,
    },
    events: [...next.events, event],
  };
  return {
    handled: true,
    state: next,
    outcome: accepted('activity_started', event.message, [event.id]),
    completionOwnsAttemptOpportunity: true,
  };
}

function result(state: GameState, outcome: Outcome): ActivityCommandResult {
  return {
    handled: true,
    state,
    outcome,
    completionOwnsAttemptOpportunity: false,
  };
}

function activityLabel(type: CompanionCommand['type']): string {
  if (type === 'socialize') return 'Socializing';
  return type[0].toUpperCase() + type.slice(1);
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded} hour${rounded === 1 ? '' : 's'}`;
}
