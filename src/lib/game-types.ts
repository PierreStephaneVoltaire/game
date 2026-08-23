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
  | 'sugar_crash';

export type StatusRecord = {
  since: number;
  source: string;
  lastPenaltyAt?: number;
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
  discovery?: string;
  activityType?: Activity['type'];
  healthDamageSources?: HealthDamageSource[];
  healthRecovery?: number;
  purchases?: PurchaseRecord[];
  itemName?: string;
  actionLabel?: string;
  outcomeKind?: string;
  outcomeAccepted?: boolean;
};

export type HealthDamageSource = {
  kind: 'status' | 'item' | 'event';
  id: string;
  name: string;
  amount: number;
  eventIds: string[];
};

export type DeathCause = Pick<HealthDamageSource, 'kind' | 'id' | 'name'> & {
  eventIds: string[];
};

export type PurchaseRecord = {
  itemId: string;
  itemName: string;
  quantity: number;
};

export type Activity = {
  id: string;
  type: 'rest' | 'socialize' | 'play' | 'stream' | 'medical_care';
  startedAt: number;
  endsAt: number;
  sourceActionId: string;
  payload?: Record<string, string | number | boolean>;
};

export type ConsumptionRecord = {
  at: number;
  itemId: string;
  salt: number;
  water: number;
  protein: number;
  sugar: number;
  sugarTagged: boolean;
  nutritionProfileId?: string;
};

export type GameHistory = {
  consumptions: ConsumptionRecord[];
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
  annoyanceThreshold: number;
};

export type DeathRecord = {
  at: number;
  /** Compatibility summary; player UI renders the structured causes. */
  cause: string;
  causes?: DeathCause[];
  eventIds: string[];
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
  inventory: Record<string, number>;
  room: Record<string, string>;
  /** Exact applied room deltas make placement reversible under clamping. */
  roomModifiers: Record<string, Partial<Metrics>>;
  shop: ShopState;
  activity: Activity | null;
  events: GameEvent[];
  history: GameHistory;
  death: DeathRecord | null;
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
      type: 'rest' | 'socialize' | 'play' | 'medical_care';
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
