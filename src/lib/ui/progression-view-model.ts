import { hospitalCost, hospitalInsuranceItemId } from '$lib/billing-rules';
import type { GameDefinition } from '$lib/game-definition';
import type { CareerTier, GameState, Project } from '$lib/game-types';
import rules from '$lib/data/simulation-rules.json';
import { companion, type CompanionAppearance } from './companion';

export type CareerViewModel = {
  key: CareerTier;
  label: string;
  nextMilestone: {
    key: CareerTier;
    label: string;
    followers: number;
    remaining: number;
  } | null;
};

export type ProjectViewModel = {
  id: string;
  label: string;
  endsAt: number;
  progressPercentage: number;
};

export type TimedEffectViewModel = {
  key: 'hyperfocus' | 'pain_relief' | 'clippers' | 'sugar_crash_warning';
  label: string;
  endsAt: number;
};

export type HospitalViewModel = {
  durationHours: number;
  cost: number;
  insured: boolean;
  consumedItemName: string | null;
};

const careerLabels: Record<CareerTier, string> = {
  debut: 'Debut',
  first_model: 'First Model',
  sub_1k: '1K Subscribers',
  model_redesign: 'Model Redesign',
  twitch_partner: 'Twitch Partner',
  sub_30k: '30K Subscribers',
  tournament_appearance: 'Tournament Appearance',
  sub_50k: '50K Subscribers',
  convention_guest: 'Convention Guest',
  sub_100k: '100K Subscribers',
  three_d_ready: '3D Ready',
  sub_200k: '200K Subscribers',
  sub_250k: '250K Subscribers',
  sub_500k: '500K Subscribers',
  sub_1m: '1M Subscribers',
};

function careerFor(state: GameState): CareerViewModel {
  const next = rules.progression.milestones.find(
    (milestone) => milestone.followers > state.progression.followers,
  );
  const key = state.progression.careerTier;
  return {
    key,
    label: careerLabels[key],
    nextMilestone: next
      ? {
          key: next.id as CareerTier,
          label: careerLabels[next.id as CareerTier],
          followers: next.followers,
          remaining: next.followers - state.progression.followers,
        }
      : null,
  };
}

function projectLabel(project: Project): string {
  if (project.type === 'model_commission')
    return `Model ${project.modelTier ?? ''} commission`.replace('  ', ' ');
  return 'Full-body commission';
}

function projectsFor(state: GameState): ProjectViewModel[] {
  return state.projects.map((project) => {
    const duration = project.completesAt - project.startedAt;
    const elapsed = state.now - project.startedAt;
    const progressPercentage = duration
      ? Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)))
      : 100;
    return {
      id: project.id,
      label: projectLabel(project),
      endsAt: project.completesAt,
      progressPercentage,
    };
  });
}

function effectsFor(state: GameState): TimedEffectViewModel[] {
  const effects: TimedEffectViewModel[] = [];
  if (
    state.history.sugarCrashDueAt !== null &&
    state.history.sugarCrashDueAt > state.now
  )
    effects.push({
      key: 'sugar_crash_warning',
      label: 'Sugar Crash Warning',
      endsAt: state.history.sugarCrashDueAt,
    });
  if (
    state.timedEffects.hyperfocusUntil !== null &&
    state.timedEffects.hyperfocusUntil > state.now
  )
    effects.push({
      key: 'hyperfocus',
      label: 'Hyperfocus',
      endsAt: state.timedEffects.hyperfocusUntil,
    });
  if (
    state.timedEffects.clippers &&
    state.timedEffects.clippers.expiresAt > state.now
  )
    effects.push({
      key: 'clippers',
      label: `Clippers ×${state.timedEffects.clippers.stacks}`,
      endsAt: state.timedEffects.clippers.expiresAt,
    });
  if (
    state.timedEffects.painReliefUntil !== null &&
    state.timedEffects.painReliefUntil > state.now
  )
    effects.push({
      key: 'pain_relief',
      label: 'Pain Relief',
      endsAt: state.timedEffects.painReliefUntil,
    });
  return effects;
}

function avatarFor(state: GameState): CompanionAppearance {
  return (
    companion.appearances.find(
      (appearance) => appearance.id === state.progression.activeAppearanceId,
    ) ?? companion.appearances[0]
  );
}

function hospitalFor(
  state: GameState,
  definition: GameDefinition,
): HospitalViewModel {
  const insuranceId = hospitalInsuranceItemId(state, definition);
  const insurance = definition.items.find((item) => item.id === insuranceId);
  return {
    durationHours: rules.medicalCare.durationHours,
    cost: hospitalCost(state, definition),
    insured: Boolean(insuranceId),
    consumedItemName: insurance?.name ?? null,
  };
}

export function progressionPresentation(
  state: GameState,
  definition: GameDefinition,
) {
  return {
    followers: state.progression.followers,
    career: careerFor(state),
    debt: { active: state.balance < 0, amount: Math.max(0, -state.balance) },
    effects: effectsFor(state),
    projects: projectsFor(state),
    activeAvatar: avatarFor(state),
    hospital: hospitalFor(state, definition),
    streamStats: state.progression.streamStats,
  };
}
