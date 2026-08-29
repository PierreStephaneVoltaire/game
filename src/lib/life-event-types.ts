import type { EventTemplateId, LifeEventTextId } from './event-messages';
import type { Metrics } from './game-types';

export type LifeEventEffects = Partial<Metrics> & {
  cash?: number;
  followersFlat?: number;
  followersPercent?: number;
  followersMinimumLoss?: number;
  followerGrowthMultiplier?: number;
  followerGrowthDurationHours?: number;
};

export type LifeEventOutcomeDefinition = {
  id: string;
  weight: number;
  messageId: LifeEventTextId;
  effects: LifeEventEffects;
};

export type LifeEventDefinition = {
  id: string;
  rollDenominator: number;
  oncePerRun?: boolean;
  requiresNonnegativeBalance?: boolean;
  behavior?:
    | { type: 'catalogue_purchase'; quantity: 1; mood: number }
    | { type: 'catalogue_item_expense'; eligibleItemIds: string[] };
  cashRange?: { minimum: number; maximum: number };
  messageId?: LifeEventTextId;
  messageTemplateId?: EventTemplateId;
  effects?: LifeEventEffects;
  outcomes?: LifeEventOutcomeDefinition[];
};
