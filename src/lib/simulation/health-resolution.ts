import rules from '../data/simulation-rules.json';
import { HEALTH_MAX, STAT_MIN } from '../game-constants';
import type { GameState, HealthDamageSource, MetricName } from '../game-types';

const CRITICAL_METRICS = ['food', 'rest', 'mood'] as const;

export type CriticalMetric = (typeof CRITICAL_METRICS)[number] | 'health';

export type HealthResolution = {
  health: number;
  recovery: number;
  damage: number;
  delta: number;
  sources: HealthDamageSource[];
  lethal: boolean;
};

export function criticalMetrics(
  metrics: GameState['metrics'],
): CriticalMetric[] {
  const critical: CriticalMetric[] = [];
  if (metrics.health <= rules.statusRules.criticalHealthMaximum)
    critical.push('health');
  for (const metric of CRITICAL_METRICS)
    if (metrics[metric] <= rules.timeDecay.criticalNeed.lowMaximum)
      critical.push(metric);
  return critical;
}

export function isCriticalState(state: GameState): boolean {
  return criticalMetrics(state.metrics).length > 0;
}

export function isHealthProtectedActivity(state: GameState): boolean {
  return (
    state.activity?.type === 'rest' ||
    state.activity?.type === 'socialize' ||
    state.activity?.type === 'play' ||
    state.activity?.type === 'stream' ||
    state.activity?.type === 'medical_care'
  );
}

export function recoveryForMetrics(
  metrics: GameState['metrics'],
  scorePenalty = 0,
): number {
  const baseline = rules.timeDecay.healthRecovery.metricBaseline;
  const score = Math.max(
    0,
    CRITICAL_METRICS.reduce(
      (total, metric) => total + Math.max(metrics[metric] - baseline, 0),
      0,
    ) - scorePenalty,
  );
  return (
    [...rules.timeDecay.healthRecovery.buckets]
      .sort((left, right) => right.minimumScore - left.minimumScore)
      .find((bucket) => score >= bucket.minimumScore)?.health ?? 0
  );
}

export function resolveHealthWindow(input: {
  health: number;
  metricsAfterDecay: GameState['metrics'];
  recoveryMetrics: GameState['metrics'];
  foodDecayHit: boolean;
  preventLethal?: boolean;
  recoveryPenalty?: number;
}): HealthResolution {
  const sources: HealthDamageSource[] = [];
  for (const metric of CRITICAL_METRICS) {
    if (metric === 'food' && !input.foodDecayHit) continue;
    const value = input.metricsAfterDecay[metric];
    const amount =
      value === STAT_MIN
        ? rules.timeDecay.criticalNeed.zeroLoss
        : value <= rules.timeDecay.criticalNeed.lowMaximum
          ? rules.timeDecay.criticalNeed.lowLoss
          : 0;
    if (amount > 0) sources.push(sourceForCriticalMetric(metric, amount));
  }
  const recovery = Math.max(
    0,
    recoveryForMetrics(input.recoveryMetrics, input.recoveryPenalty ?? 0),
  );
  const damage = sources.reduce((total, source) => total + source.amount, 0);
  const intendedHealth = Math.min(
    HEALTH_MAX,
    Math.max(STAT_MIN, input.health + recovery - damage),
  );
  const lethal =
    intendedHealth <= STAT_MIN && damage >= recovery + input.health;
  const health = input.preventLethal && lethal ? 1 : intendedHealth;
  return {
    health,
    recovery,
    damage,
    delta: health - input.health,
    sources,
    lethal: lethal && !input.preventLethal,
  };
}

export function healthDamageSource(
  kind: HealthDamageSource['kind'],
  id: string,
  name: string,
  amount: number,
  eventIds: string[] = [],
): HealthDamageSource {
  return { kind, id, name, amount: Math.abs(amount), eventIds };
}

function sourceForCriticalMetric(
  metric: Extract<MetricName, 'food' | 'rest' | 'mood'>,
  amount: number,
): HealthDamageSource {
  if (metric === 'food')
    return healthDamageSource('status', 'starving', 'Starvation', amount);
  if (metric === 'rest')
    return healthDamageSource(
      'status',
      'sleep_deprived',
      'Sleep deprivation',
      amount,
    );
  return healthDamageSource('status', 'depressed', 'Depression', amount);
}
