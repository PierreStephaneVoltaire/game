import type { GameDefinition } from './game-definition';
import type { MetricName } from './game-types';

export let SIMULATION_RULES = {} as GameDefinition['simulationRules'];
export let PET_PROFILE = {} as GameDefinition['petProfile'];
export let STAT_MIN = Number.NaN;
export let STAT_MAX = Number.NaN;
export let HEALTH_MAX = Number.NaN;
export let STARTING_CURRENCY = Number.NaN;
export let MAX_CART_QUANTITY = Number.NaN;
export let LIFE_EVENT_INTERVAL_MS = Number.NaN;

export function configureGameConstants(definition: GameDefinition): void {
  const rules = definition.simulationRules;
  SIMULATION_RULES = rules;
  PET_PROFILE = definition.petProfile;
  STAT_MIN = rules.statRange.min;
  STAT_MAX = rules.statRange.max;
  HEALTH_MAX = rules.healthMaximum;
  STARTING_CURRENCY = rules.startingCurrency;
  MAX_CART_QUANTITY = rules.maxCartQuantity;
  LIFE_EVENT_INTERVAL_MS =
    definition.lifeEvents.intervalMinutes * MINUTE_MS;
}

export function metricMaximum(metric: MetricName): number {
  return metric === 'health' ? HEALTH_MAX : STAT_MAX;
}

export function clampMetric(metric: MetricName, value: number): number {
  return Math.max(STAT_MIN, Math.min(metricMaximum(metric), value));
}

export const LINE_OF_CREDIT_OFFER_ID = 'line-of-credit';
export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * HOUR_MS;
export const LOCAL_MIDNIGHT_SEARCH_HOURS = 36;
export const STATUS_FIXED_POINT_PASS_LIMIT = 14;
