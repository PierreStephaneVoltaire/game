export type DonationTier =
  'kind_bridiot' | 'raid_windfall' | 'whale' | 'legendary_whale';

export type CareerTier =
  | 'starting_out'
  | 'affiliate'
  | 'partner'
  | 'convention_guest'
  | 'tournament_host'
  | 'three_d_ready';

export type AppearanceId = string;

export type Project = {
  id: string;
  type: 'full_body_commission' | 'model_commission';
  startedAt: number;
  completesAt: number;
  sourceActionId: string;
  payout?: number;
  modelTier?: 1 | 2 | 3 | 4;
};

export type QueuedEventStream = {
  id: string;
  type: 'tournament' | 'model_debut';
  queuedAt: number;
  durationHours: number;
  donationMultiplier: number;
  modelTier?: 1 | 2 | 3 | 4;
};

export type ProgressionState = {
  followers: number;
  careerTier: CareerTier;
  unlockedModelTiers: Array<1 | 2 | 3 | 4>;
  completedModelTiers: Array<1 | 2 | 3 | 4>;
  activeAppearanceId: AppearanceId;
  awardedMilestones: CareerTier[];
  queuedEventStreams: QueuedEventStream[];
  permanentDonationBonus: boolean;
};

export type TimedEffects = {
  /** The single caffeine-deferred awake Rest loss, if one is pending. */
  deferredRestLossAt: number | null;
  hyperfocusUntil: number | null;
  painReliefUntil: number | null;
};
