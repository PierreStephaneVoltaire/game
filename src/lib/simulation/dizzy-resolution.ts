import { simulationRules as rules } from '../runtime-definition';
import { HOUR_MS, STAT_MIN } from '../game-constants';
import { actionRandom } from '../seeded-rng';
import type { GameState, Metrics } from '../game-types';

export type DizzyHealthCheck = {
  metrics: Metrics;
  statuses: GameState['statuses'];
  onset: boolean;
};

/** Rolls Dizzy only at an unprotected Health-clock boundary. */
export function resolveDizzyHealthCheck(
  state: GameState,
  metrics: Metrics,
  boundaryAt: number,
): DizzyHealthCheck {
  const cutoff = boundaryAt - rules.nutrition.rollingWindowHours * HOUR_MS;
  const rollingSalt = state.history.consumptions
    .filter(
      (consumption) => consumption.at >= cutoff && consumption.at <= boundaryAt,
    )
    .reduce((total, consumption) => total + consumption.salt, 0);
  const onset =
    !state.statuses.dizzy_spell &&
    boundaryAt - state.history.runStartedAt >=
      rules.dizzySpell.exemptHours * HOUR_MS &&
    rollingSalt <= rules.dizzySpell.saltMaximum &&
    actionRandom(
      state.seed,
      state.stateVersion,
      `dizzy-spell:${boundaryAt}`,
      'dizzy_spell',
      'health_check',
    ) < rules.dizzySpell.probability;
  if (!onset) return { metrics, statuses: state.statuses, onset: false };
  return {
    metrics: {
      ...metrics,
      rest: Math.max(STAT_MIN, metrics.rest + rules.dizzySpell.onset.rest),
      mood: Math.max(STAT_MIN, metrics.mood + rules.dizzySpell.onset.mood),
    },
    statuses: {
      ...state.statuses,
      dizzy_spell: { since: boundaryAt, source: 'health_check' },
    },
    onset: true,
  };
}
