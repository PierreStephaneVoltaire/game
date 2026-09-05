import { STAT_MAX } from '../game-constants';
import type { GameState, Metrics } from '../game-types';
import { actionRandom } from '../seeded-rng';
import { simulationRules as rules } from '../runtime-definition';
import { HOUR_MS } from '../game-constants';
import type { StatusEffectEvent } from '../status-rules';

export function resolveNaturalStatusPassage(
  state: GameState,
  metrics: Metrics,
  now: number,
): {
  statuses: GameState['statuses'];
  metrics: Metrics;
  effects: StatusEffectEvent[];
} {
  const nextStatuses = { ...state.statuses };
  let nextMetrics = metrics;
  const effects: StatusEffectEvent[] = [];
  for (const status of ['kidney_stone', 'sick'] as const) {
    const record = nextStatuses[status];
    if (!record?.naturalPassAt || record.naturalPassAt > now) continue;
    if (
      status === 'kidney_stone' &&
      actionRandom(
        state.seed,
        state.stateVersion,
        `kidney-stone-pass:${record.naturalPassAt}`,
        'kidney_stone',
        'natural_pass',
      ) >= rules.kidneyStone.naturalPassProbability
    ) {
      nextStatuses.kidney_stone = {
        ...record,
        naturalPassAt:
          record.naturalPassAt + rules.kidneyStone.naturalPassHours * HOUR_MS,
      };
      continue;
    }
    delete nextStatuses[status];
    const mood = status === 'kidney_stone' ? 1 : 0;
    effects.push({
      status,
      metricDeltas: mood ? { mood } : {},
      message:
        status === 'kidney_stone'
          ? 'The kidney stone passed. Somehow, with dignity intact.'
          : 'The companion recovered from sickness.',
      at: record.naturalPassAt,
    });
    if (mood)
      nextMetrics = {
        ...nextMetrics,
        mood: Math.min(STAT_MAX, nextMetrics.mood + mood),
      };
  }
  return { statuses: nextStatuses, metrics: nextMetrics, effects };
}
