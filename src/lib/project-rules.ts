import type { GameEvent, GameState, Project } from './game-types';
import rules from './data/simulation-rules.json';
import { queueEventStream } from './event-stream-rules';
import { reconcileMetricSource } from './status-rules/metric-source-reconciliation';
import { applyFollowerMilestones } from './economy-rules';
import {
  projectCompletionAtLocalMidnight,
  projectId,
  resolveFullBodyPayout,
} from './project-economy-rules';
import { appearanceIdForModelTier } from './companion-profile';
import { creditIncome } from './income-rules';
import { finalizeFinancialOperation } from './financial-rules';

export function startFullBodyProject(
  state: GameState,
  sourceActionId: string,
): GameState {
  const project: Project = {
    id: projectId(state, 'full_body_commission'),
    type: 'full_body_commission',
    startedAt: state.now,
    completesAt: projectCompletionAtLocalMidnight(state.now, state.timezone),
    sourceActionId,
    payout: resolveFullBodyPayout(state, sourceActionId),
  };
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'full_body_project_started',
    at: state.now,
    message: 'A rare full-body commission is now in progress.',
    sourceActionId,
    projectId: project.id,
  };
  return {
    ...state,
    projects: [...state.projects, project],
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
}

/**
 * Reconciles projects whose completion boundary has passed. The time
 * reconciler should call this at its boundaries; keeping it separate prevents
 * project payout rules from leaking into health or status resolution.
 */
export function completeDueProjects(
  state: GameState,
  now = state.now,
): GameState {
  const due = state.projects.filter((project) => project.completesAt <= now);
  if (!due.length) return state;
  let next = {
    ...state,
    projects: state.projects.filter((project) => project.completesAt > now),
  };
  for (const project of due) next = completeProject(next, project, now);
  return next;
}

function completeProject(
  state: GameState,
  project: Project,
  at: number,
): GameState {
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'project_completed',
    at,
    message:
      project.type === 'model_commission'
        ? 'The model commission is ready for debut.'
        : `Full-body commission completed for $${project.payout ?? 0}.`,
    sourceActionId: project.sourceActionId,
    projectId: project.id,
    amount: project.payout,
  };
  if (project.type === 'full_body_commission') {
    const mutated: GameState = {
      ...creditIncome(state, project.payout ?? 0),
      events: [...state.events, event],
    };
    return finalizeFinancialOperation({
      before: state,
      state: mutated,
      triggerEventId: event.id,
      kind: 'project_income',
    });
  }
  const tier = project.modelTier ?? 1;
  const withDebut = queueEventStream(
    {
      ...state,
      metrics: {
        ...state.metrics,
        mood: Math.min(
          10,
          state.metrics.mood + rules.projects.modelCompletion.mood,
        ),
        creativity: Math.min(
          10,
          state.metrics.creativity + rules.projects.modelCompletion.creativity,
        ),
      },
      progression: {
        ...state.progression,
        completedModelTiers: [
          ...new Set([...state.progression.completedModelTiers, tier]),
        ],
        activeAppearanceId: appearanceIdForModelTier(tier),
        permanentDonationBonus:
          tier === 4 || state.progression.permanentDonationBonus,
        followers:
          state.progression.followers +
          rules.projects.modelCompletion.followers,
      },
      events: [...state.events, event],
    },
    {
      type: 'model_debut',
      durationHours: rules.projects.modelDebutHours,
      donationMultiplier: 1,
      modelTier: tier,
    },
    project.sourceActionId,
  );
  const milestoneEvents: GameEvent[] = [];
  const withMilestones = applyFollowerMilestones(
    withDebut,
    project.sourceActionId,
    at,
    milestoneEvents,
  );
  const reconciled = reconcileMetricSource(
    state,
    {
      ...withMilestones,
      events: [...withMilestones.events, ...milestoneEvents],
    },
    project.sourceActionId,
  );
  return reconciled.balance === state.balance
    ? reconciled
    : finalizeFinancialOperation({
        before: state,
        state: reconciled,
        triggerEventId: event.id,
        kind: 'career_milestone_income',
      });
}
