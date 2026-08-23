export type DonationTier =
  'kind_bridiot' | 'raid_windfall' | 'whale' | 'legendary_whale';

export const CAREER_TIERS = [
  'debut',
  'first_model',
  'sub_1k',
  'model_redesign',
  'twitch_partner',
  'sub_30k',
  'tournament_appearance',
  'sub_50k',
  'convention_guest',
  'sub_100k',
  'three_d_ready',
  'sub_200k',
  'sub_250k',
  'sub_500k',
  'sub_1m',
] as const;

export type CareerTier = (typeof CAREER_TIERS)[number];

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
