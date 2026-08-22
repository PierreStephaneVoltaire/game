import { actionRandom } from './seeded-rng';
import type { GameState, Metrics } from './game-types';
import rules from './data/simulation-rules.json';
import { HOUR_MS, MINUTE_MS } from './game-constants';
import { STAT_MAX, STAT_MIN } from './game-constants';

export function chooseDuration(
  type: 'rest' | 'socialize' | 'play',
  state: GameState,
  commandId: string,
): number {
  const roll = actionRandom(
    state.seed,
    state.stateVersion,
    commandId,
    'activity_duration',
    type,
  );
  if (type === 'socialize') {
    const values = rules.activities.socializeMinutes;
    return values[Math.floor(roll * values.length)] * MINUTE_MS;
  }
  if (type === 'play') {
    const values = rules.activities.playHours;
    return values[Math.floor(roll * values.length)] * HOUR_MS;
  }
  const rest = state.metrics.rest;
  if (rest >= rules.activities.restRefusal.restAtOrAbove) return 0;
  if (rest >= rules.activities.restRefusal.restBandAt)
    return roll <
      (rest === rules.activities.restRefusal.restBandAt
        ? rules.activities.restRefusal.cutoffAt8
        : rules.activities.restRefusal.cutoffAt9)
      ? 0
      : chooseRestBand(state, commandId);
  return chooseRestBand(state, commandId);
}

function chooseRestBand(state: GameState, commandId: string): number {
  const roll = actionRandom(
    state.seed,
    state.stateVersion,
    commandId,
    'rest_duration',
    'duration',
  );
  const rest = state.metrics.rest;
  const band =
    rest <= rules.activities.restBands.low.maxRest
      ? rules.activities.restBands.low
      : rest <= rules.activities.restBands.medium.maxRest
        ? rules.activities.restBands.medium
        : rules.activities.restBands.high;
  const values = band.hours;
  const cutoffs = band.cutoffs;
  return values[roll < cutoffs[0] ? 0 : roll < cutoffs[1] ? 1 : 2] * HOUR_MS;
}

export function refusalProbability(
  state: GameState,
  type: 'socialize' | 'play',
): number {
  let probability = 0;
  if (state.metrics.mood <= rules.activities.refusal.moodAtOrBelow)
    probability += rules.activities.refusal.moodProbability;
  if (state.metrics.rest <= rules.activities.refusal.restAtOrBelow)
    probability += rules.activities.refusal.restProbability;
  if (state.statuses.annoyed)
    probability += rules.activities.refusal.annoyedProbability;
  if (state.history.repeatAction === type)
    probability += Math.min(
      rules.activities.refusal.repeatCap,
      state.history.repeatCount * rules.activities.refusal.repeatIncrement,
    );
  return Math.min(rules.activities.refusal.maximum, probability);
}

export function completionDelta(
  type: 'rest' | 'socialize' | 'play',
  durationMs: number,
  startingRest = 0,
): Partial<Metrics> {
  if (type === 'socialize') return rules.activities.completion.socialize;
  if (type === 'play') return rules.activities.completion.play;
  const plannedRecovery = Math.max(STAT_MIN, Math.floor(durationMs / HOUR_MS));
  const recovered = Math.min(STAT_MAX - startingRest, plannedRecovery);
  return {
    rest: recovered,
    health: Math.floor(
      recovered / rules.activities.completion.rest.healthDivisor,
    ),
    mood: Math.floor(recovered / rules.activities.completion.rest.moodDivisor),
  };
}
