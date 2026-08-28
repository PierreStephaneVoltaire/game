import type {
  DonationTier,
  ProgressionState,
  Project,
  TimedEffects,
} from './progression-types';
import type {
  EndingKind,
  EndingRiskClocks,
  EndingUnlocks,
  RunEnding,
} from './ending-types';
import type { GameHistory } from './game-history-types';
import type {
  FinancedObligation,
  FinancialEffect,
  LineOfCreditState,
} from './financial-types';
export type * from './ending-types';
export type * from './game-history-types';
export type * from './financial-types';
export type {
  AppearanceId,
  CareerTier,
  DonationTier,
  ProgressionState,
  Project,
  QueuedEventStream,
  TimedEffects,
} from './progression-types';

export type GameMode = 'realtime' | 'streaming';

export type MetricName =
  'food' | 'health' | 'mood' | 'rest' | 'bond' | 'creativity';

export type Metrics = Record<MetricName, number>;

export type StatusName =
  | 'starving'
  | 'hungry'
  | 'sleep_deprived'
  | 'depressed'
  | 'lonely'
  | 'creative_block'
  | 'annoyed'
  | 'sick'
  | 'overstimulated'
  | 'kidney_stone'
  | 'full'
  | 'low_energy'
  | 'sugar_crash'
  | 'dizzy_spell'
  | 'in_debt';

export type StatusRecord = {
  since: number;
  source: string;
  lastPenaltyAt?: number;
  /** Seeded natural resolution boundary for statuses that can pass on their own. */
  naturalPassAt?: number;
  causalEventIds?: string[];
};

export type GameEvent = {
  id: string;
  type: string;
  at: number;
  message: string;
  sourceActionId?: string;
  metricDeltas?: Partial<Metrics>;
  status?: StatusName;
  cause?: string;
  /** Ordered event ids that explain a terminal or derived event. */
  causedBy?: string[];
  nutritionProfileId?: string;
  tags?: string[];
  preparation?: 'acceptable' | 'unpreferred';
  activityType?: Activity['type'];
  healthDamageSources?: HealthDamageSource[];
  /** Uncapped Food/Rest/Mood pressure retained for balance diagnostics. */
  rawNeedDamageSources?: HealthDamageSource[];
  healthRecovery?: number;
  purchases?: PurchaseRecord[];
  itemName?: string;
  /** Catalogue-authored sentence fragment selected for this item use. */
  itemNarration?: string;
  actionLabel?: string;
  outcomeKind?: string;
  outcomeAccepted?: boolean;
  donationTier?: DonationTier;
  amount?: number;
  followerDelta?: number;
  projectId?: string;
  activityNarration?: string;
  activityOutcome?: 'normal' | 'strong';
  revenueMultiplier?: number;
  selectedOutcomeId?: string;
  rescueMetric?: 'food' | 'rest';
  rescueBlockedReason?: string;
  medicalBillId?: string;
  medicalPaymentIds?: string[];
  fullValueAudienceBoostIds?: string[];
  discountedAudienceBoostIds?: string[];
  endingKind?: EndingKind;
  endingStage?: number;
  financialEffect?: FinancialEffect;
  lifeEventId?: string;
  cashDelta?: number;
  followerGrowthMultiplier?: number;
  followerGrowthDurationHours?: number;
};

export type HealthDamageSource = {
  kind: 'status' | 'item' | 'event';
  id: string;
  name: string;
  amount: number;
  eventIds: string[];
};

export type PurchaseRecord = {
  itemId: string;
  itemName: string;
  quantity: number;
};

export type Activity = {
  id: string;
  type:
    | 'rest'
    | 'socialize'
    | 'play'
    | 'stream'
    | 'medical_care'
    | 'commission_work';
  startedAt: number;
  endsAt: number;
  sourceActionId: string;
  payload?: Record<string, string | number | boolean>;
};

export type MedicalDebtBill = {
  id: string;
  createdAt: number;
  originalPrincipal: number;
  remainingPrincipal: number;
  scheduledDailyPayment: number;
  insuredAtStart: boolean;
};

export type ShopState = {
  localDate: string;
  itemIds: string[];
  stock: Record<string, number>;
  cart: Record<string, number>;
};

export type GameState = {
  definitionVersion: string;
  mode: GameMode;
  seed: string;
  timezone: string;
  now: number;
  lastResolvedAt: number;
  stateVersion: number;
  actionOrdinal: number;
  metrics: Metrics;
  statuses: Partial<Record<StatusName, StatusRecord>>;
  balance: number;
  medicalDebt: MedicalDebtBill[];
  lineOfCredit: LineOfCreditState;
  financedObligations: FinancedObligation[];
  inventory: Record<string, number>;
  room: Record<string, string>;
  /** Exact applied room deltas make placement reversible under clamping. */
  roomModifiers: Record<string, Partial<Metrics>>;
  shop: ShopState;
  activity: Activity | null;
  timedEffects: TimedEffects;
  progression: ProgressionState;
  projects: Project[];
  events: GameEvent[];
  history: GameHistory;
  endingRisks: EndingRiskClocks;
  /** Non-terminal conclusions earned during this run. */
  endingUnlocks: EndingUnlocks;
  ending: RunEnding | null;
  processedCommands: Record<string, CommandReceipt>;
};

export type Outcome = {
  accepted: boolean;
  kind: string;
  message: string;
  eventIds: string[];
  /** The command receipt is stable even when the command is rejected. */
  commandId?: string;
  stateVersion?: number;
};

export type Transition = { state: GameState; outcomes: Outcome[] };

export type CommandReceipt = {
  outcome: Outcome;
  stateVersion: number;
};

export type StartRunInput = {
  mode: GameMode;
  now: number;
  seed: string;
  timezone: string;
};

export type GameCommand =
  | {
      type: 'open_line_of_credit';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'repay_line_of_credit';
      commandId: string;
      quantity: number;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'pay_medical_debt';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'use_item';
      commandId: string;
      itemId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'wait';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'rest' | 'socialize' | 'play' | 'medical_care' | 'commission_work';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'buy_item';
      commandId: string;
      itemId: string;
      now: number;
      quantity?: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'set_cart_quantity';
      commandId: string;
      itemId: string;
      quantity: number;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'checkout_cart';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'place_item';
      commandId: string;
      itemId: string;
      slot: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'unplace_item';
      commandId: string;
      slot: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'perform_item_action';
      commandId: string;
      itemId: string;
      action: string;
      now: number;
      expectedStateVersion?: number;
    };
