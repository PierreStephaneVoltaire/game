import simulationRules from './data/simulation-rules.json';
import petProfile from './data/pet-profile.json';
import type { MetricName } from './game-types';

export const SIMULATION_RULES = simulationRules;
export const PET_PROFILE = petProfile;

export const STAT_MIN = simulationRules.statRange.min;
export const STAT_MAX = simulationRules.statRange.max;
export const HEALTH_MAX = simulationRules.healthMaximum;
export function metricMaximum(metric: MetricName): number {
  return metric === 'health' ? HEALTH_MAX : STAT_MAX;
}
export function clampMetric(metric: MetricName, value: number): number {
  return Math.max(STAT_MIN, Math.min(metricMaximum(metric), value));
}
export const STARTING_CURRENCY = simulationRules.startingCurrency;
export const MAX_CART_QUANTITY = simulationRules.maxCartQuantity;
export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * HOUR_MS;
export const LOCAL_MIDNIGHT_SEARCH_HOURS = 36;
export const STATUS_FIXED_POINT_PASS_LIMIT = 14;
