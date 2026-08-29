import type { GameState } from '../../../../src/lib/game-types';
import type {
  ExpandedProfile,
  ProfileArchetype,
} from './balance-profile-schema';

export type ControlledProfileName =
  'Casual' | 'Focused' | 'Optimal' | 'Neglect';
export type ResponseMode =
  | 'unaware'
  | 'instinctive'
  | 'wait'
  | 'delayed_hospital'
  | 'hospital'
  | 'optimal';

export type CanonicalRunSpec = {
  id: string;
  profile: ControlledProfileName;
  label: string;
  studyGroup: 'controlled';
  archetype: 'controlled';
  seed: string;
  cadenceHours: number;
  target: number;
  foodThreshold: number;
  restThreshold: number;
  moodThreshold: number;
  foodReserve: number;
  creativityTarget: number;
  clipperStacks: number;
  responseMode: ResponseMode;
};

export type ExpandedRunSpec = {
  id: string;
  profile: string;
  label: string;
  studyGroup: 'heterogeneous';
  archetype: ProfileArchetype;
  seed: string;
  cadenceHours: number;
  target: number;
  responseMode: ResponseMode;
  config: ExpandedProfile;
};

export type RunSpec = CanonicalRunSpec | ExpandedRunSpec;

export type BehaviorTrace = {
  actionAttempts: Record<string, number>;
  acceptedActions: Record<string, number>;
  rejectedActions: Record<string, number>;
  careActions: Record<string, number>;
  preCareMetrics: Record<string, { total: number; samples: number }>;
  visitsWithNoCare: number;
  purchasesByCategory: Record<string, number>;
  usedItemIds: string[];
  hospitalDecisions: Record<string, number>;
  rescueLockResets: Record<'food' | 'rest', number>;
  rescueToPlayerCareHours: Record<'food' | 'rest', number[]>;
  waterResponsesAfterWarning: number;
  proteinResponsesAfterWarning: number;
  balanceSamples: Array<{ at: number; balance: number }>;
  metricSamples: Array<{ at: number; health: number }>;
};

export type RunTrace = {
  state: GameState;
  spec: RunSpec;
  checks: {
    scheduled: number;
    attended: number;
    busy: number;
    skipped: number;
    retries: number;
  };
  rejectedPurchases: number;
  behavior?: BehaviorTrace;
};

export function canonicalRunSpecs(): CanonicalRunSpec[] {
  return [
    ...Array.from({ length: 18 }, (_, index) =>
      spec('Casual', index, [8, 6, 4.8, 4][index % 4], 250_000),
    ),
    ...Array.from({ length: 12 }, (_, index) =>
      spec('Focused', index, [6, 4.8, 4][index % 3], 500_000),
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      spec('Optimal', index, 2, 1_000_000),
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      spec('Neglect', index, [8, 6, 4.8, 4][index % 4], 250_000),
    ),
  ];
}

function spec(
  profile: ControlledProfileName,
  index: number,
  cadenceHours: number,
  target: number,
): CanonicalRunSpec {
  const optimal = profile === 'Optimal';
  const focused = profile === 'Focused';
  return {
    id: `${profile.toLowerCase()}-${String(index + 1).padStart(2, '0')}`,
    profile,
    label: profile,
    studyGroup: 'controlled',
    archetype: 'controlled',
    seed: `canonical-balance-v2-${profile.toLowerCase()}-${index + 1}`,
    cadenceHours,
    target,
    foodThreshold: optimal ? 6 : 4,
    restThreshold: optimal ? 6 : 4,
    moodThreshold: optimal ? 4 : 3,
    foodReserve: profile === 'Neglect' ? 0 : optimal ? 16 : focused ? 10 : 9,
    creativityTarget: optimal ? 9 : focused ? 8 : 6,
    clipperStacks: optimal ? 3 : focused ? 2 : profile === 'Casual' ? 1 : 0,
    responseMode: responseMode(profile, index),
  };
}

function responseMode(
  profile: ControlledProfileName,
  index: number,
): ResponseMode {
  if (profile === 'Optimal') return 'optimal';
  const modes: ResponseMode[] = [
    'unaware',
    'instinctive',
    'wait',
    'delayed_hospital',
    'hospital',
  ];
  return modes[index % modes.length];
}
