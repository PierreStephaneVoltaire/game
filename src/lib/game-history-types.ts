export type ConsumptionRecord = {
  at: number;
  itemId: string;
  salt: number;
  water: number;
  protein: number;
  sugar: number;
  caffeine?: number;
  sugarServings?: number;
  sugarTagged: boolean;
  nutritionProfileId?: string;
};

export type GameHistory = {
  consumptions: ConsumptionRecord[];
  /** Successful purchases retained after consumable inventory is used. */
  lifetimePurchases: Record<string, number>;
  /** The ten most recent successful food or drink feeds used for stone risk. */
  kidneyStoneFeeds: ConsumptionRecord[];
  lastBondGainAt: number;
  lastCareAttemptAt: number;
  lastInteractionAt: number;
  careAttemptStreak: number;
  repeatAction: string | null;
  repeatCount: number;
  sugarCrashDueAt: number | null;
  lastStatusReconcileAt: number;
  decayRemainderHours: number;
  healthRemainderHours: number;
  pendingFoodDecayHit: boolean;
  eventCooldowns: Record<string, number>;
  oncePerLocalDate: Record<string, string>;
  cravingItemId: string | null;
  cravingStartedAt: number | null;
  cravingRefreshCount: number;
  annoyanceThreshold: number;
  annoyanceWarningIssued: boolean;
  /** Placement may reset Bond decay once per catalogue item type per 48 hours. */
  bondPlacementResetAt: Record<string, number>;
  lastCommissionWorkDate: string | null;
  nextAutonomousAt: number;
  runStartedAt: number;
  autonomousRescue: {
    foodLocked: boolean;
    restLocked: boolean;
  };
  lastCriticalHealthMoodPenaltyAt: number | null;
  lastMovementAt: number | null;
  lifeEventScheduler: {
    boundariesProcessed: number;
    successfulRolls: Record<string, number>;
    suppressedAgencyInvitations: number;
    multiSuccessBoundaries: number;
  };
};
