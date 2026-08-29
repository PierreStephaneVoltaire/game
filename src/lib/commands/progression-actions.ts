import type {
  GameDefinition,
  ItemActionDefinition,
  ItemDefinition,
} from '../game-definition';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import activityRules from '../data/activity-rules.json';
import { accepted, recordAttempt, rejected } from '../simulation/engine-state';
import { resolveAttemptEvent } from '../event-rules';
import { localDate } from '../shop-rules';
import {
  projectCompletionAtLocalMidnight,
  projectId,
  resolveFullBodyPayout,
} from '../project-economy-rules';
import type { Project } from '../game-types';
import { HOUR_MS } from '../game-constants';
import { criticalMetrics } from '../simulation/health-resolution';
import { CAREER_TIERS } from '../progression-types';
import { inventoryAfterConsumedUnit } from './inventory-mutations';

export type ProgressionActionResult = {
  state: GameState;
  outcome: Outcome;
};

export function actionRequirementFailure(
  state: GameState,
  action: ItemActionDefinition,
): string | null {
  const requirements = action.requirements;
  if (!requirements) return null;
  if (
    requirements.minimumMetrics &&
    Object.entries(requirements.minimumMetrics).some(
      ([metric, value]) =>
        state.metrics[metric as keyof GameState['metrics']] < (value ?? 0),
    )
  )
    return 'The companion is not ready for that action.';
  if (requirements.blockedStatuses?.some((status) => state.statuses[status]))
    return 'A current status blocks that action.';
  if (
    requirements.requiredCareerTier &&
    !careerAtLeast(
      state.progression.careerTier,
      requirements.requiredCareerTier,
    )
  )
    return 'A higher career tier is required.';
  return null;
}

function careerAtLeast(current: string, required: string): boolean {
  return (
    CAREER_TIERS.indexOf(current as (typeof CAREER_TIERS)[number]) >=
    CAREER_TIERS.indexOf(required as (typeof CAREER_TIERS)[number])
  );
}

export function startCommissionWork(
  state: GameState,
  command: Extract<GameCommand, { type: 'perform_item_action' }>,
  item: ItemDefinition,
  action: ItemActionDefinition,
  definition: GameDefinition,
): ProgressionActionResult {
  if (state.activity)
    return unavailable(
      state,
      command,
      definition,
      'The companion is busy right now.',
    );
  if (state.metrics.creativity < activityRules.commissionWork.minimumCreativity)
    return unavailable(
      state,
      command,
      definition,
      'Commission Work requires more Creativity.',
    );
  const date = localDate(state.now, state.timezone);
  if (state.history.lastCommissionWorkDate === date)
    return unavailable(
      state,
      command,
      definition,
      'Commission Work is limited to once per local day.',
    );
  const duration =
    (action.activity?.durationHours ??
      activityRules.commissionWork.durationHours) * HOUR_MS;
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'activity_started',
    at: state.now,
    message: 'Commission Work started.',
    sourceActionId: command.commandId,
    activityType: 'commission_work',
    itemName: item.name,
    actionLabel: action.label,
  };
  const next: GameState = {
    ...state,
    inventory:
      action.consumes === true
        ? inventoryAfterConsumedUnit(state.inventory, item.id)
        : state.inventory,
    activity: {
      id: `activity-${state.actionOrdinal + 1}`,
      type: 'commission_work',
      startedAt: state.now,
      endsAt: state.now + duration,
      sourceActionId: command.commandId,
      payload: {
        startingCreativity: state.metrics.creativity,
        startingCriticalMetrics: criticalMetrics(state.metrics).join(','),
      },
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return finishAccepted(
    state,
    next,
    command,
    definition,
    accepted('commission_started', event.message, [event.id]),
    true,
  );
}

export function startModelCommission(
  state: GameState,
  command: Extract<GameCommand, { type: 'perform_item_action' }>,
  item: ItemDefinition,
  action: ItemActionDefinition,
  definition: GameDefinition,
): ProgressionActionResult {
  if (
    item.progression?.requiredCareerTier &&
    !careerAtLeast(
      state.progression.careerTier,
      item.progression.requiredCareerTier,
    )
  )
    return unavailable(
      state,
      command,
      definition,
      'A higher career tier is required.',
    );
  const tier = [...state.progression.unlockedModelTiers]
    .sort((a, b) => a - b)
    .find(
      (candidate) => !state.progression.completedModelTiers.includes(candidate),
    );
  if (!tier)
    return unavailable(
      state,
      command,
      definition,
      'That model tier is not unlocked.',
    );
  if (state.projects.some((project) => project.type === 'model_commission'))
    return unavailable(
      state,
      command,
      definition,
      'A model project is already in progress.',
    );
  const project = {
    id: projectId(state, 'model_commission'),
    type: 'model_commission' as const,
    startedAt: state.now,
    completesAt: projectCompletionAtLocalMidnight(state.now, state.timezone),
    sourceActionId: command.commandId,
    modelTier: tier,
  };
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'model_project_started',
    at: state.now,
    message: `${action.label} started.`,
    sourceActionId: command.commandId,
    projectId: project.id,
    itemName: item.name,
  };
  const next: GameState = {
    ...state,
    inventory:
      action.consumes === true
        ? inventoryAfterConsumedUnit(state.inventory, item.id)
        : state.inventory,
    projects: [...state.projects, project],
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return finishAccepted(
    state,
    next,
    command,
    definition,
    accepted('model_project_started', event.message, [event.id]),
  );
}

export function startFullBodyCommission(
  state: GameState,
  command: Extract<GameCommand, { type: 'perform_item_action' }>,
  item: ItemDefinition,
  action: ItemActionDefinition,
  definition: GameDefinition,
): ProgressionActionResult {
  if (state.projects.length)
    return unavailable(
      state,
      command,
      definition,
      'A long commission is already in progress.',
    );
  const project: Project = {
    id: projectId(state, 'full_body_commission'),
    type: 'full_body_commission',
    startedAt: state.now,
    completesAt: projectCompletionAtLocalMidnight(state.now, state.timezone),
    sourceActionId: command.commandId,
    payout: resolveFullBodyPayout(state, command.commandId),
  };
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'full_body_project_started',
    at: state.now,
    message: `${action.label} started.`,
    sourceActionId: command.commandId,
    projectId: project.id,
    itemName: item.name,
  };
  const next: GameState = {
    ...state,
    projects: [...state.projects, project],
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return finishAccepted(
    state,
    next,
    command,
    definition,
    accepted('full_body_project_started', event.message, [event.id]),
  );
}

function finishAccepted(
  before: GameState,
  state: GameState,
  command: Extract<GameCommand, { type: 'perform_item_action' }>,
  definition: GameDefinition,
  outcome: Outcome,
  deferOpportunity = false,
): ProgressionActionResult {
  const withOpportunity = deferOpportunity
    ? state
    : resolveAttemptEvent(state, command.commandId, definition);
  return {
    state: recordAttempt(
      withOpportunity,
      outcome,
      before,
      command.commandId,
      command.type,
    ),
    outcome,
  };
}

function unavailable(
  state: GameState,
  command: Extract<GameCommand, { type: 'perform_item_action' }>,
  definition: GameDefinition,
  message: string,
): ProgressionActionResult {
  const outcome = rejected('unavailable', message);
  const attempted = recordAttempt(
    resolveAttemptEvent(state, command.commandId, definition),
    outcome,
    state,
    command.commandId,
    command.type,
  );
  return { state: attempted, outcome };
}
