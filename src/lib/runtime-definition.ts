import type { GameDefinition } from './game-definition';
import { configureGameConstants } from './game-constants';

let activeDefinition: GameDefinition | null = null;

/** The engine boundary sets this before resolving any gameplay rule. */
export function activateGameDefinition(definition: GameDefinition): void {
  activeDefinition = definition;
  configureGameConstants(definition);
}

export function currentGameDefinition(): GameDefinition {
  if (!activeDefinition)
    throw new Error('Runtime content was not activated before gameplay.');
  return activeDefinition;
}

type DocumentName = Exclude<
  keyof GameDefinition,
  | 'version'
  | 'schemaVersion'
  | 'metricMin'
  | 'metricMax'
  | 'startingMetrics'
  | 'startingCurrency'
  | 'startingInventory'
  | 'items'
>;

function document<Name extends DocumentName>(
  name: Name,
): GameDefinition[Name] {
  return new Proxy(
    {} as GameDefinition[Name],
    {
      get: (_target, key) => Reflect.get(currentGameDefinition()[name], key),
    },
  );
}

export const simulationRules = document('simulationRules');
export const activityRules = document('activityRules');
export const endingRules = document('endingRules');
export const eventTexts = document('eventTexts');
export const financialRules = document('financialRules');
export const lifeEvents = document('lifeEvents');
export const petProfile = document('petProfile');
