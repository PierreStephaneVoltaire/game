import { actionRandom } from './seeded-rng';
import type { GameState, Metrics } from './game-types';
import rules from './data/activity-rules.json';
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
    const values = rules.socializeMinutes;
    return values[Math.floor(roll * values.length)] * MINUTE_MS;
  }
  if (type === 'play') {
    const values = rules.playHours;
    return values[Math.floor(roll * values.length)] * HOUR_MS;
  }
  const rest = state.metrics.rest;
  if (rest >= rules.restRefusal.restAtOrAbove) return 0;
  if (rest >= rules.restRefusal.restBandAt)
    return roll <
      (rest === rules.restRefusal.restBandAt
        ? rules.restRefusal.cutoffAt8
        : rules.restRefusal.cutoffAt9)
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
    rest <= rules.restBands.low.maxRest
      ? rules.restBands.low
      : rest <= rules.restBands.medium.maxRest
        ? rules.restBands.medium
        : rules.restBands.high;
  const values = band.hours;
  const cutoffs = band.cutoffs;
  return values[roll < cutoffs[0] ? 0 : roll < cutoffs[1] ? 1 : 2] * HOUR_MS;
}

export function refusalProbability(state: GameState): number {
  let probability = 0;
  if (state.metrics.mood <= rules.refusal.moodAtOrBelow)
    probability += rules.refusal.moodProbability;
  if (state.metrics.rest <= rules.refusal.restAtOrBelow)
    probability += rules.refusal.restProbability;
  if (state.statuses.annoyed) probability += rules.refusal.annoyedProbability;
  return Math.min(rules.refusal.maximum, probability);
}

export function completionDelta(
  type: 'rest' | 'socialize' | 'play',
  durationMs: number,
  startingRest = 0,
  activityOutcome: 'normal' | 'strong' = 'normal',
): Partial<Metrics> {
  if (type === 'socialize' || type === 'play') {
    const completion = rules.completion[type];
    return {
      [completion.primaryMetric]:
        activityOutcome === 'strong'
          ? completion.strongPrimary
          : completion.normalPrimary,
      bond: completion.bond,
    };
  }
  const plannedRecovery = Math.max(STAT_MIN, Math.floor(durationMs / HOUR_MS));
  const recovered = Math.min(STAT_MAX - startingRest, plannedRecovery);
  return {
    rest: recovered,
    mood: Math.floor(recovered / rules.completion.rest.moodDivisor),
  };
}

export function activityPrimaryMetric(
  type: 'socialize' | 'play',
): 'mood' | 'creativity' {
  return rules.completion[type].primaryMetric as 'mood' | 'creativity';
}

export function chooseActivityVignette(
  type: 'socialize' | 'play',
  state: GameState,
  commandId: string,
): { outcome: 'normal' | 'strong'; narration: string } {
  const outcome =
    actionRandom(
      state.seed,
      state.stateVersion,
      commandId,
      'activity_outcome',
      type,
    ) < rules.vignettes.strongOutcomeChance
      ? 'strong'
      : 'normal';
  const lines = rules.vignettes[type][outcome];
  const lineIndex = Math.floor(
    actionRandom(
      state.seed,
      state.stateVersion,
      commandId,
      'activity_narration',
      `${type}:${outcome}`,
    ) * lines.length,
  );
  return { outcome, narration: lines[lineIndex] };
}
