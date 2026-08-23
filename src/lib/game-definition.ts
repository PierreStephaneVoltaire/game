import rules from './data/simulation-rules.json';
import items from './data/shop-items.json';
import type { CareerTier, Metrics, StatusName } from './game-types';

export type EffectRange = { min: number; max: number };

export type ItemActionDefinition = {
  id: string;
  label: string;
  kind: 'consume' | 'interaction' | 'activity' | 'service';
  effects?: Partial<Record<keyof Metrics, EffectRange>>;
  consumes?: boolean;
  requirements?: {
    ownedItemIdsAll?: string[];
    ownedItemTagsAny?: string[];
    minimumMetrics?: Partial<Metrics>;
    blockedStatuses?: StatusName[];
    requiredCareerTier?: CareerTier;
  };
  activity?: {
    type: 'commission_work';
    durationHours: number;
  };
  service?: {
    type: 'model_commission' | 'full_body_commission';
  };
  clearsStatuses?: StatusName[];
  tags?: string[];
};

export type AutomaticEventHookDefinition = {
  id: string;
  weight: number;
  message: string;
  eligibility: 'owned' | 'placed';
  effects?: Partial<Record<keyof Metrics, EffectRange>>;
  cooldownHours?: number;
};

export type ItemDefinition = {
  id: string;
  name: string;
  /** Seeded player-facing sentence fragments, prefixed with the configured companion name. */
  narration: string[];
  category: string;
  price: number;
  image: string;
  description: string;
  qualitativeNutritionHint: string;
  edible: boolean;
  usable?: boolean;
  consumable?: boolean;
  supportsQuantity?: boolean;
  maximumOwned?: number;
  stock?: { min: number; max: number };
  sugarServings?: number;
  progression?: {
    requiredCareerTier?: CareerTier;
    modelTier?: 1 | 2 | 3 | 4;
  };
  eventPoolModifiers?: Array<{
    eventId: string;
    weightDelta: number;
    eligibility: 'owned' | 'placed';
  }>;
  effects?: Partial<Record<keyof Metrics, EffectRange>>;
  tags: string[];
  preferences?: string[];
  context?: {
    refusalProbability?: number;
    preparationAcceptance?: number;
    dislikedEffects?: Partial<Record<keyof Metrics, EffectRange>>;
  };
  nutrition?: {
    serving: string;
    calories: number | null;
    sodiumMg: number | null;
    sugarG: number | null;
    proteinG: number | null;
    waterG: number | null;
    caffeineMg: number | null;
    sourceUrl: string | null;
    sourceType: string;
    sourceReference?: string;
    retrievalDate?: string;
    snapshotDate?: string;
    qualifiers?: Partial<
      Record<
        | 'calories'
        | 'sodiumMg'
        | 'sugarG'
        | 'proteinG'
        | 'waterG'
        | 'caffeineMg',
        'less_than' | 'approximately'
      >
    >;
    fictionalProfiles?: Array<{
      id: string;
      serving: string;
      calories: number;
      sodiumMg: number;
      sugarG: number;
      proteinG: number;
      waterG: number;
      caffeineMg: number;
      nutritionScores: Record<string, number>;
    }>;
    nullReasons?: Record<string, string>;
  };
  nutritionScores?: Record<string, number>;
  properties?: {
    salt: number;
    water: number;
    protein: number;
    sugar: number;
    caffeine?: number;
    portion?: number;
  };
  roomSlot?: string | null;
  roomEffects?: Partial<Metrics>;
  statusHooks?: string[];
  automaticEventHooks?: AutomaticEventHookDefinition[];
  hooks?: string[];
  itemActions?: ItemActionDefinition[];
  clearsStatuses?: StatusName[];
};

export type GameDefinition = {
  version: string;
  metricMin: number;
  metricMax: number;
  startingMetrics: Metrics;
  startingCurrency: number;
  startingInventory: Record<string, number>;
  items: ItemDefinition[];
};

const bundledRules = rules as typeof rules;

export const BUNDLED_GAME_DEFINITION: GameDefinition = {
  version: 'main-app-1',
  metricMin: bundledRules.statRange.min,
  metricMax: bundledRules.statRange.max,
  startingMetrics: bundledRules.startingMetrics,
  startingCurrency: bundledRules.startingCurrency,
  startingInventory: bundledRules.startingInventory,
  items: items as ItemDefinition[],
};

export interface GameDefinitionRepository {
  load(): Promise<GameDefinition>;
}

export class BundledGameDefinitionRepository implements GameDefinitionRepository {
  async load(): Promise<GameDefinition> {
    return BUNDLED_GAME_DEFINITION;
  }
}

export class InMemoryGameDefinitionRepository implements GameDefinitionRepository {
  constructor(private readonly definition: GameDefinition) {}

  async load(): Promise<GameDefinition> {
    return this.definition;
  }
}
