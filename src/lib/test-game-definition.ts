/** Bundled authoring data for tests and balance studies only. */
import rules from './data/simulation-rules.json' with { type: 'json' };
import items from './data/shop-items.json' with { type: 'json' };
import activityRules from './data/activity-rules.json' with { type: 'json' };
import endingRules from './data/ending-rules.json' with { type: 'json' };
import eventTexts from './data/event-texts.json' with { type: 'json' };
import financialRules from './data/financial-rules.json' with { type: 'json' };
import lifeEvents from './data/life-events.json' with { type: 'json' };
import petProfile from './data/pet-profile.json' with { type: 'json' };
import {
  type GameDefinition,
  type GameDefinitionRepository,
  type ItemDefinition,
} from './game-definition';
import { activateGameDefinition } from './runtime-definition';

export * from './game-definition';

const bundledRules = rules as typeof rules;

export const BUNDLED_GAME_DEFINITION: GameDefinition = {
  version: 'main-app-1',
  schemaVersion: 1,
  metricMin: bundledRules.statRange.min,
  metricMax: bundledRules.statRange.max,
  startingMetrics: bundledRules.startingMetrics,
  startingCurrency: bundledRules.startingCurrency,
  startingInventory: bundledRules.startingInventory,
  items: items as ItemDefinition[],
  activityRules,
  endingRules,
  eventTexts,
  financialRules,
  lifeEvents,
  petProfile,
  simulationRules: bundledRules,
};

export class BundledGameDefinitionRepository implements GameDefinitionRepository {
  async load(): Promise<GameDefinition> {
    return BUNDLED_GAME_DEFINITION;
  }
}

activateGameDefinition(BUNDLED_GAME_DEFINITION);
