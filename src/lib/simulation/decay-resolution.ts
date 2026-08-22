import type { GameState } from '../game-types';
import type { StatusReconciliation } from '../status-rules';
import { reconcileStatusRules, sugarCrashMetricDeltas } from '../status-rules';
import rules from '../data/simulation-rules.json';
import { HOUR_MS } from '../game-constants';
import { STAT_MIN } from '../game-constants';

export type DecayResolution = {
  intervals: number;
  metricDeltas: Partial<GameState['metrics']>;
  metrics: GameState['metrics'];
  statusReconciliation: StatusReconciliation;
  streamSnackRequests: number;
  bondIntervals: number;
  deathAt: number | null;
  reconciliationNow: number;
  resolvedElapsedHours: number;
  resolvedDecayRemainderHours: number;
  lastBondGainAt: number;
};

export function resolveDecay(state: GameState, now: number): DecayResolution {
  const intervalHours = rules.timeDecay.intervalHours;
  const elapsedHours = (now - state.lastResolvedAt) / HOUR_MS;
  const accumulatedHours = state.history.decayRemainderHours + elapsedHours;
  const intervals = Math.floor(accumulatedHours / intervalHours);
  const decayRemainderHours = accumulatedHours - intervals * intervalHours;
  const metrics = { ...state.metrics };
  const metricDeltas: Partial<GameState['metrics']> = {};
  let streamSnackRequests = 0;
  let deathAt: number | null = null;

  for (let interval = 0; interval < intervals; interval += 1) {
    const foodBefore = metrics.food;
    metrics.food =
      state.activity?.type === 'stream'
        ? Math.max(
            rules.stream.snackFloor,
            metrics.food - rules.timeDecay.foodPerInterval,
          )
        : Math.max(STAT_MIN, metrics.food - rules.timeDecay.foodPerInterval);
    if (
      state.activity?.type === 'stream' &&
      foodBefore - rules.timeDecay.foodPerInterval < rules.stream.snackFloor
    )
      streamSnackRequests += 1;
    metricDeltas.food = (metricDeltas.food ?? 0) + (metrics.food - foodBefore);

    if (state.activity?.type !== 'rest') {
      const restBefore = metrics.rest;
      metrics.rest = Math.max(
        STAT_MIN,
        metrics.rest - rules.timeDecay.restPerInterval,
      );
      metricDeltas.rest =
        (metricDeltas.rest ?? 0) + (metrics.rest - restBefore);
    }
    const criticalHealthLoss = [
      metrics.food,
      metrics.rest,
      metrics.mood,
    ].reduce(
      (loss, value) =>
        loss +
        (value === STAT_MIN
          ? rules.timeDecay.criticalNeed.zeroLoss
          : value <= rules.timeDecay.criticalNeed.lowMaximum
            ? rules.timeDecay.criticalNeed.lowLoss
            : 0),
      0,
    );
    if (criticalHealthLoss) {
      const healthBefore = metrics.health;
      metrics.health = Math.max(STAT_MIN, metrics.health - criticalHealthLoss);
      metricDeltas.health =
        (metricDeltas.health ?? 0) + (metrics.health - healthBefore);
    }
    if (metrics.health <= 0) {
      deathAt =
        state.lastResolvedAt +
        (intervalHours -
          state.history.decayRemainderHours +
          interval * intervalHours) *
          HOUR_MS;
      break;
    }
  }

  const reconciliationNow = deathAt ?? now;
  const resolvedElapsedHours =
    (reconciliationNow - state.lastResolvedAt) / HOUR_MS;
  const resolvedDecayRemainderHours = deathAt ? 0 : decayRemainderHours;
  const bondIntervals = Math.floor(
    (reconciliationNow - state.history.lastBondGainAt) /
      (rules.timeDecay.bondLossHours * HOUR_MS),
  );
  if (bondIntervals > 0) {
    metrics.bond = Math.max(STAT_MIN, metrics.bond - bondIntervals);
    metricDeltas.bond = -bondIntervals;
  }

  const statusReconciliation: StatusReconciliation = deathAt
    ? {
        metrics,
        statuses: state.statuses,
        sugarCrashDueAt: state.history.sugarCrashDueAt,
        onsetEffects: [],
        recurrenceEffects: [],
        clearEffects: [],
        sugarCrash: false,
      }
    : reconcileStatusRules({ state, metrics, now: reconciliationNow });
  for (const effect of [
    ...statusReconciliation.onsetEffects,
    ...statusReconciliation.recurrenceEffects,
  ]) {
    for (const [metric, delta] of Object.entries(effect.metricDeltas)) {
      const name = metric as keyof GameState['metrics'];
      metricDeltas[name] = (metricDeltas[name] ?? 0) + (delta ?? 0);
    }
  }
  if (statusReconciliation.sugarCrash) {
    const sugarCrash = sugarCrashMetricDeltas();
    metricDeltas.mood = (metricDeltas.mood ?? 0) + sugarCrash.mood;
    metricDeltas.rest = (metricDeltas.rest ?? 0) + sugarCrash.rest;
  }
  return {
    intervals,
    metricDeltas,
    metrics,
    statusReconciliation,
    streamSnackRequests,
    bondIntervals,
    deathAt,
    reconciliationNow,
    resolvedElapsedHours,
    resolvedDecayRemainderHours,
    lastBondGainAt:
      bondIntervals > 0
        ? state.history.lastBondGainAt +
          bondIntervals * rules.timeDecay.bondLossHours * HOUR_MS
        : state.history.lastBondGainAt,
  };
}
