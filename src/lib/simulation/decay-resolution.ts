import type { GameState, HealthDamageSource } from '../game-types';
import type { StatusReconciliation } from '../status-rules';
import { reconcileStatusRules, sugarCrashMetricDeltas } from '../status-rules';
import rules from '../data/simulation-rules.json';
import { HOUR_MS, STAT_MIN } from '../game-constants';
import { actionRandom } from '../seeded-rng';
import {
  isHealthProtectedActivity,
  resolveHealthWindow,
} from './health-resolution';

export type DecayResolution = {
  intervals: number;
  healthIntervals: number;
  metricDeltas: Partial<GameState['metrics']>;
  metrics: GameState['metrics'];
  statusReconciliation: StatusReconciliation;
  streamSnackRequests: number;
  bondIntervals: number;
  deathAt: number | null;
  reconciliationNow: number;
  resolvedElapsedHours: number;
  resolvedDecayRemainderHours: number;
  resolvedHealthRemainderHours: number;
  pendingFoodDecayHit: boolean;
  lastBondGainAt: number;
  healthDamageSources: HealthDamageSource[];
  healthRecovery: number;
};

export function resolveDecay(
  state: GameState,
  now: number,
  options: { preventLethal?: boolean } = {},
): DecayResolution {
  const intervalHours = rules.timeDecay.intervalHours;
  const elapsedHours = (now - state.lastResolvedAt) / HOUR_MS;
  const accumulatedHours = state.history.decayRemainderHours + elapsedHours;
  const intervals = Math.floor(accumulatedHours / intervalHours);
  const decayRemainderHours = accumulatedHours - intervals * intervalHours;
  const protectedActivity = isHealthProtectedActivity(state);
  const accumulatedHealthHours =
    state.history.healthRemainderHours + (protectedActivity ? 0 : elapsedHours);
  const healthIntervals = Math.floor(accumulatedHealthHours / intervalHours);
  const healthRemainderHours =
    accumulatedHealthHours - healthIntervals * intervalHours;
  const recoveryMetrics = { ...state.metrics };
  const metrics = { ...state.metrics };
  const metricDeltas: Partial<GameState['metrics']> = {};
  let pendingFoodDecayHit = state.history.pendingFoodDecayHit;
  let streamSnackRequests = 0;
  let deathAt: number | null = null;
  let healthDamageSources: HealthDamageSource[] = [];
  let healthRecovery = 0;

  for (let interval = 0; interval < intervals; interval += 1) {
    const boundaryAt =
      state.lastResolvedAt +
      (intervalHours -
        state.history.decayRemainderHours +
        interval * intervalHours) *
        HOUR_MS;
    const foodDecayHit =
      actionRandom(
        state.seed,
        state.stateVersion,
        `food-decay:${boundaryAt}`,
        'food_decay',
        'opportunity',
      ) < rules.timeDecay.foodDecayProbability;
    if (foodDecayHit) {
      const foodBefore = metrics.food;
      const decayedFood = foodBefore - rules.timeDecay.foodPerInterval;
      metrics.food =
        state.activity?.type === 'stream'
          ? Math.max(rules.stream.snackFloor, decayedFood)
          : Math.max(STAT_MIN, decayedFood);
      if (
        state.activity?.type === 'stream' &&
        decayedFood < rules.stream.snackFloor
      )
        streamSnackRequests += 1;
      metricDeltas.food =
        (metricDeltas.food ?? 0) + (metrics.food - foodBefore);
      if (!protectedActivity) pendingFoodDecayHit = true;
    }

    if (state.activity?.type !== 'rest') {
      const restBefore = metrics.rest;
      metrics.rest = Math.max(
        STAT_MIN,
        metrics.rest - rules.timeDecay.restPerInterval,
      );
      metricDeltas.rest =
        (metricDeltas.rest ?? 0) + (metrics.rest - restBefore);
    }
  }

  for (let interval = 0; interval < healthIntervals; interval += 1) {
    const health = resolveHealthWindow({
      health: metrics.health,
      metricsAfterDecay: metrics,
      recoveryMetrics,
      foodDecayHit: pendingFoodDecayHit,
      preventLethal: options.preventLethal,
    });
    metrics.health = health.health;
    metricDeltas.health = (metricDeltas.health ?? 0) + health.delta;
    healthDamageSources = [...healthDamageSources, ...health.sources];
    healthRecovery += health.recovery;
    pendingFoodDecayHit = false;
    if (health.lethal) {
      deathAt =
        state.lastResolvedAt +
        (intervalHours -
          state.history.healthRemainderHours +
          interval * intervalHours) *
          HOUR_MS;
      break;
    }
  }

  const reconciliationNow = deathAt ?? now;
  const resolvedElapsedHours =
    (reconciliationNow - state.lastResolvedAt) / HOUR_MS;
  const bondIntervals = Math.floor(
    (reconciliationNow - state.history.lastBondGainAt) /
      (rules.timeDecay.bondLossHours * HOUR_MS),
  );
  if (bondIntervals > 0) {
    const before = metrics.bond;
    metrics.bond = Math.max(STAT_MIN, metrics.bond - bondIntervals);
    metricDeltas.bond = metrics.bond - before;
  }

  let statusReconciliation: StatusReconciliation = deathAt
    ? emptyStatusReconciliation(state, metrics)
    : reconcileStatusRules({ state, metrics, now: reconciliationNow });
  if (state.activity?.type === 'medical_care') {
    statusReconciliation = {
      ...statusReconciliation,
      metrics: {
        ...statusReconciliation.metrics,
        health: state.metrics.health,
      },
      onsetEffects: statusReconciliation.onsetEffects.map(stripHealth),
      recurrenceEffects:
        statusReconciliation.recurrenceEffects.map(stripHealth),
    };
  }
  for (const effect of [
    ...statusReconciliation.onsetEffects,
    ...statusReconciliation.recurrenceEffects,
  ])
    for (const [metric, delta] of Object.entries(effect.metricDeltas)) {
      const name = metric as keyof GameState['metrics'];
      metricDeltas[name] = (metricDeltas[name] ?? 0) + (delta ?? 0);
    }
  if (statusReconciliation.sugarCrash) {
    const sugarCrash = sugarCrashMetricDeltas();
    metricDeltas.mood = (metricDeltas.mood ?? 0) + sugarCrash.mood;
    metricDeltas.rest = (metricDeltas.rest ?? 0) + sugarCrash.rest;
  }

  return {
    intervals,
    healthIntervals,
    metricDeltas,
    metrics,
    statusReconciliation,
    streamSnackRequests,
    bondIntervals,
    deathAt,
    reconciliationNow,
    resolvedElapsedHours,
    resolvedDecayRemainderHours: decayRemainderHours,
    resolvedHealthRemainderHours: protectedActivity
      ? state.history.healthRemainderHours
      : healthRemainderHours,
    pendingFoodDecayHit,
    lastBondGainAt:
      bondIntervals > 0
        ? state.history.lastBondGainAt +
          bondIntervals * rules.timeDecay.bondLossHours * HOUR_MS
        : state.history.lastBondGainAt,
    healthDamageSources,
    healthRecovery,
  };
}

function emptyStatusReconciliation(
  state: GameState,
  metrics: GameState['metrics'],
): StatusReconciliation {
  return {
    metrics,
    statuses: state.statuses,
    sugarCrashDueAt: state.history.sugarCrashDueAt,
    onsetEffects: [],
    recurrenceEffects: [],
    clearEffects: [],
    sugarCrash: false,
  };
}

function stripHealth<T extends { metricDeltas: Partial<GameState['metrics']> }>(
  effect: T,
): T {
  const metricDeltas = { ...effect.metricDeltas };
  delete metricDeltas.health;
  return { ...effect, metricDeltas };
}
