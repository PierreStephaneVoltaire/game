export type ProfileArchetype =
  'common' | 'risky' | 'optimizer' | 'edge' | 'hostile';

export type ScheduleConfig = {
  type:
    | 'fixed_interval'
    | 'local_times'
    | 'day_pattern'
    | 'gap_pattern'
    | 'phase_schedule';
  intervalHours?: number;
  localTimes?: string[];
  weekdayTimes?: string[];
  weekendTimes?: string[];
  gapPatternHours?: number[];
  checksByWeekday?: number[];
  cycleChecksPerDay?: number[];
  phases?: Array<{
    untilDay?: number;
    afterDay?: number;
    untilFollowers?: number;
    intervalHours: number;
  }>;
  skipEvery?: number;
  skipAfterSafe?: boolean;
  retryAfterBusyHours?: number | null;
  skipNextAfterBusy?: boolean;
};

export type CareStrategy =
  | 'threshold'
  | 'priority'
  | 'health_reactive'
  | 'critical_only'
  | 'top_up'
  | 'worst_only'
  | 'minimal'
  | 'rescue_learner'
  | 'rescue_exploit';

export type CareConfig = {
  strategy: CareStrategy;
  foodThreshold: number;
  restThreshold: number;
  moodThreshold: number;
  healthPanicThreshold?: number;
  actionsPerVisit: number | 'until_safe';
  priority: Array<'food' | 'rest' | 'mood' | 'bond'>;
  targetFood?: number;
  targetRest?: number;
  targetMood?: number;
  weekdayQuickOnly?: boolean;
  weekdayCoreOnly?: boolean;
};

export type ShoppingConfig = {
  foodReserve: number;
  minimumCashReserve: number;
  priorityTags: string[];
  preferredItemIds: string[];
  avoidTags: string[];
  spendAggressiveness: 'minimal' | 'normal' | 'high';
  foodSelection:
    | 'cheap'
    | 'food_gain'
    | 'preference'
    | 'favorite_repeat'
    | 'preferred_item'
    | 'nutrition_safe'
    | 'varied';
  waitForPreferred?: boolean;
  insurance: 'never' | 'asap' | 'after_incident';
  placeRoomItems?: boolean;
  allowDebtSpending?: boolean;
};

export type NutritionStrategy =
  | 'ignore'
  | 'preference_first'
  | 'cheap_food'
  | 'sugar_aware'
  | 'protein_counter'
  | 'salt_aware'
  | 'warning_hydrator'
  | 'risk_minimizer';

export type CareerConfig = {
  strategy:
    | 'none'
    | 'casual'
    | 'healthy_only'
    | 'stream_when_possible'
    | 'early_grind'
    | 'late_grind';
  minimumFood?: number;
  minimumRest?: number;
  minimumMood?: number;
  minimumHealth?: number;
  eveningOnly?: boolean;
  weekendHeavy?: boolean;
  clipperStacks?: number;
};

export type MedicalConfig = {
  strategy:
    | 'unaware'
    | 'hydrate'
    | 'wait'
    | 'painkiller'
    | 'delayed_hospital'
    | 'immediate_hospital'
    | 'critical_hospital'
    | 'never_hospital';
  hospitalDelayHours?: number;
  healthThreshold?: number;
  painkillerCycles?: number;
};

export type ExpandedProfile = {
  id: string;
  label: string;
  archetype: ProfileArchetype;
  target: number;
  schedule: ScheduleConfig;
  care: CareConfig;
  shopping: ShoppingConfig;
  nutrition: { strategy: NutritionStrategy };
  career: CareerConfig;
  medical: MedicalConfig;
  debt: {
    strategy:
      | 'ignore'
      | 'scheduled_only'
      | 'full_pay_when_affordable'
      | 'panic_cut_spending'
      | 'loc_immediate_clear'
      | 'loc_clipper_gambler'
      | 'loc_never_repay'
      | 'loc_partial_trap';
  };
  autonomyAwareness:
    'unaware' | 'normal' | 'relies_on_rescue' | 'tries_to_exploit_rescue';
  behavior?: {
    useNewItems?: boolean;
    clickEverything?: boolean;
    optimizeRoom?: boolean;
    noLuxury?: boolean;
    learnAfterSugarCrash?: boolean;
  };
  controlledEndingSetup?: 'quit_streaming_due';
  expectedOutcome?: 'quit_streaming' | 'financial_ruin';
  overlays: string[];
};

export const DEFAULT_EXPANDED_PROFILE = {
  target: 250_000,
  care: {
    strategy: 'threshold',
    foodThreshold: 4,
    restThreshold: 4,
    moodThreshold: 3,
    actionsPerVisit: 2,
    priority: ['food', 'rest', 'mood', 'bond'],
  },
  shopping: {
    foodReserve: 6,
    minimumCashReserve: 0,
    priorityTags: [],
    preferredItemIds: [],
    avoidTags: [],
    spendAggressiveness: 'normal',
    foodSelection: 'preference',
    insurance: 'never',
  },
  nutrition: { strategy: 'ignore' },
  career: { strategy: 'casual', clipperStacks: 1 },
  medical: { strategy: 'hydrate' },
  debt: { strategy: 'scheduled_only' },
  autonomyAwareness: 'normal',
  overlays: [],
} satisfies Omit<ExpandedProfile, 'id' | 'label' | 'archetype' | 'schedule'>;
