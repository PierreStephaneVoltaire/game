import type { CareerTier, Metrics, StatusName } from './game-types';
import type activityRulesDocument from './data/activity-rules.json';
import type endingRulesDocument from './data/ending-rules.json';
import type eventTextsDocument from './data/event-texts.json';
import type financialRulesDocument from './data/financial-rules.json';
import type lifeEventsDocument from './data/life-events.json';
import type petProfileDocument from './data/pet-profile.json';
import type simulationRulesDocument from './data/simulation-rules.json';

type ActivityRules = typeof activityRulesDocument;
type EndingRules = typeof endingRulesDocument & {
  texts: {
    events: Record<string, string[]>;
    deathCauses: Record<string, string[]>;
  };
};
type EventTexts = typeof eventTextsDocument & {
  builtInEvents: Record<string, string[]>;
  eventTemplates: Record<string, string[]>;
  lifeEvents: Record<string, string[]>;
};
type FinancialRules = typeof financialRulesDocument;
type LifeEvents = typeof lifeEventsDocument;
type PetProfile = typeof petProfileDocument;
type SimulationRules = typeof simulationRulesDocument;

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
  progressionEffect?: { type: 'activate_clippers' };
  clearsStatuses?: StatusName[];
  tags?: string[];
};

export type AutomaticEventHookDefinition = {
  id: string;
  weight: number;
  message?: string;
  messages?: string[];
  eligibility: 'owned' | 'placed';
  effects?: Partial<Record<keyof Metrics, EffectRange>>;
  balanceEffect?: EffectRange;
  cooldownHours?: number;
  cooldownHoursWhenBalanceNegative?: number;
  sharedCooldownKey?: string;
  requiresIdle?: boolean;
  requiredCareerTier?: CareerTier;
  minimumFollowers?: number;
  outcomes?: Array<{
    id: string;
    weight: number;
    message: string;
    effects?: Partial<Record<keyof Metrics, EffectRange>>;
    balanceEffect?: EffectRange;
    healthDamage?: {
      min: number;
      max: number;
      causeId: string;
      causeName: string;
    };
  }>;
};

export type ItemDefinition = {
  id: string;
  name: string;
  /** Seeded player-facing sentence fragments, prefixed with the configured companion name. */
  narration: string[];
  /** Optional stream-snack-specific authored sentence fragments. */
  automaticNarration?: string[];
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
  maximumLifetimePurchases?: number;
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
  schemaVersion: number;
  metricMin: number;
  metricMax: number;
  startingMetrics: Metrics;
  startingCurrency: number;
  startingInventory: Record<string, number>;
  items: ItemDefinition[];
  activityRules: ActivityRules;
  endingRules: EndingRules;
  eventTexts: EventTexts;
  financialRules: FinancialRules;
  lifeEvents: LifeEvents;
  petProfile: PetProfile;
  simulationRules: SimulationRules;
};

/** JSON shape served by the versioned runtime-content endpoint. */
export type RuntimeContentBundle = {
  version: string;
  schema_version: number;
  shop_items: ItemDefinition[];
  activity_rules: ActivityRules;
  ending_rules: EndingRules;
  event_texts: EventTexts;
  financial_rules: FinancialRules;
  life_events: LifeEvents;
  pet_profile: PetProfile;
  simulation_rules: SimulationRules;
};

export function gameDefinitionFromBundle(
  bundle: RuntimeContentBundle,
): GameDefinition {
  return {
    version: bundle.version,
    schemaVersion: bundle.schema_version,
    metricMin: bundle.simulation_rules.statRange.min,
    metricMax: bundle.simulation_rules.statRange.max,
    startingMetrics: bundle.simulation_rules.startingMetrics,
    startingCurrency: bundle.simulation_rules.startingCurrency,
    startingInventory: bundle.simulation_rules.startingInventory,
    items: bundle.shop_items,
    activityRules: bundle.activity_rules,
    endingRules: bundle.ending_rules,
    eventTexts: bundle.event_texts,
    financialRules: bundle.financial_rules,
    lifeEvents: bundle.life_events,
    petProfile: bundle.pet_profile,
    simulationRules: bundle.simulation_rules,
  };
}

export interface GameDefinitionRepository {
  load(): Promise<GameDefinition>;
}

export class InMemoryGameDefinitionRepository implements GameDefinitionRepository {
  constructor(private readonly definition: GameDefinition) {}

  async load(): Promise<GameDefinition> {
    return this.definition;
  }
}
