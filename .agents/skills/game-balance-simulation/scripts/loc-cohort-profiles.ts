import type { ExpandedRunSpec } from './balance-study-contract';
import type { ExpandedProfile } from './balance-profile-schema';

const COHORTS = [
  {
    id: 'immediate_clear',
    label: 'LOC Immediate Clear',
    base: 'focused',
    debt: 'loc_immediate_clear',
  },
  {
    id: 'clipper_gambler',
    label: 'LOC Clipper Gambler',
    base: 'focused',
    debt: 'loc_clipper_gambler',
  },
  {
    id: 'never_repay',
    label: 'LOC Never Repay',
    base: 'casual',
    debt: 'loc_never_repay',
  },
  {
    id: 'partial_trap',
    label: 'LOC Partial Trap',
    base: 'focused',
    debt: 'loc_partial_trap',
  },
] as const;

export const LOC_COHORT_RUNS = 100;

export function locCohortSpecs(): ExpandedRunSpec[] {
  return COHORTS.flatMap((cohort) =>
    Array.from({ length: LOC_COHORT_RUNS }, (_, index) => {
      const focused = cohort.base === 'focused';
      const config: ExpandedProfile = {
        id: `${cohort.id}-${String(index + 1).padStart(3, '0')}`,
        label: cohort.label,
        archetype: focused ? 'optimizer' : 'common',
        target: focused ? 500_000 : 250_000,
        schedule: {
          type: 'fixed_interval',
          intervalHours: focused ? 4 : 6,
        },
        care: {
          strategy: 'priority',
          foodThreshold: focused ? 4 : 3,
          restThreshold: focused ? 4 : 3,
          moodThreshold: focused ? 3 : 2,
          actionsPerVisit: focused ? 3 : 2,
          priority: ['food', 'rest', 'mood', 'bond'],
        },
        shopping: {
          foodReserve: focused ? 10 : 9,
          minimumCashReserve: 0,
          priorityTags: [],
          preferredItemIds: [],
          avoidTags: [],
          spendAggressiveness: 'normal',
          foodSelection: focused ? 'nutrition_safe' : 'preference',
          insurance: focused ? 'after_incident' : 'never',
        },
        nutrition: { strategy: focused ? 'risk_minimizer' : 'preference_first' },
        career: {
          strategy: focused ? 'stream_when_possible' : 'casual',
          clipperStacks: focused ? 2 : 1,
        },
        medical: {
          strategy: focused ? 'critical_hospital' : 'hydrate',
          healthThreshold: 10,
        },
        debt: { strategy: cohort.debt },
        autonomyAwareness: 'normal',
        overlays: [cohort.id],
      };
      return {
        id: config.id,
        profile: config.id,
        label: config.label,
        studyGroup: 'heterogeneous',
        archetype: config.archetype,
        seed: `loc-cohort-v1-${cohort.id}-${index + 1}`,
        cadenceHours: config.schedule.intervalHours!,
        target: config.target,
        responseMode: 'optimal',
        config,
      };
    }),
  );
}
