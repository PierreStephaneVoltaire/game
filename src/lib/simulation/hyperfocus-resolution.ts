import { simulationRules as rules } from '../runtime-definition';
import { STAT_MIN } from '../game-constants';
import type { GameState, Metrics } from '../game-types';
import type { StatusReconciliation } from '../status-rules';

export function resolveHyperfocusBoundary(
  state: GameState,
  metrics: Metrics,
  now: number,
): {
  metrics: Metrics;
  metricDeltas: Partial<Metrics>;
  timedEffects: GameState['timedEffects'];
} {
  const timedEffects = { ...state.timedEffects };
  const metricDeltas: Partial<Metrics> = {};
  if (
    timedEffects.hyperfocusUntil !== null &&
    state.lastResolvedAt < timedEffects.hyperfocusUntil &&
    now >= timedEffects.hyperfocusUntil
  ) {
    timedEffects.hyperfocusUntil = null;
    return {
      timedEffects,
      metrics: {
        ...metrics,
        creativity: Math.max(
          STAT_MIN,
          metrics.creativity + rules.hyperfocus.expiry.creativity,
        ),
        rest: Math.max(STAT_MIN, metrics.rest + rules.hyperfocus.expiry.rest),
      },
      metricDeltas: { ...rules.hyperfocus.expiry },
    };
  }
  if (
    timedEffects.hyperfocusUntil !== null &&
    now < timedEffects.hyperfocusUntil
  )
    return {
      timedEffects,
      metrics: { ...metrics, creativity: rules.hyperfocus.pinnedCreativity },
      metricDeltas,
    };
  return { timedEffects, metrics, metricDeltas };
}

export function pinHyperfocusStatusEffects(
  reconciliation: StatusReconciliation,
  timedEffects: GameState['timedEffects'],
  now: number,
): StatusReconciliation {
  if (
    timedEffects.hyperfocusUntil === null ||
    now >= timedEffects.hyperfocusUntil
  )
    return reconciliation;
  const suppressCreativity = <T extends { metricDeltas: Partial<Metrics> }>(
    effect: T,
  ): T => {
    const metricDeltas = { ...effect.metricDeltas };
    delete metricDeltas.creativity;
    return { ...effect, metricDeltas };
  };
  return {
    ...reconciliation,
    metrics: {
      ...reconciliation.metrics,
      creativity: rules.hyperfocus.pinnedCreativity,
    },
    onsetEffects: reconciliation.onsetEffects.map(suppressCreativity),
    recurrenceEffects: reconciliation.recurrenceEffects.map(suppressCreativity),
    clearEffects: reconciliation.clearEffects.map(suppressCreativity),
  };
}
