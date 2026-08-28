import type {
  GameState,
  Metrics,
  StatusName as GameStatusName,
  StatusRecord as GameStatusRecord,
} from './game-types';
import rules from './data/simulation-rules.json';
import financialRules from './data/financial-rules.json';
import { resolveStatusFixedPoint } from './status-rules/fixed-point';
import { clampMetric, HOUR_MS, STAT_MIN } from './game-constants';
import { STATUS_NAMES } from './status-rules/names';
import { LOW_STATUS_RULES } from './status-rules/low-metric-rules';
export { STATUS_NAMES, isStatusName } from './status-rules/names';
export { nextStatusBoundary } from './status-rules/boundaries';
import { applyStatusOnsetEffects } from './status-rules/context-statuses';
import { statusTransitionMessage } from './event-messages';
import { resolveNaturalStatusPassage } from './status-rules/natural-resolution';
import {
  applyLowStatusRecurrences,
  type StatusEffectEvent,
} from './status-rules/low-status-recurrences';
export { applyStatusOnsetEffects };
export {
  applyLowStatusRecurrences,
  type StatusEffectEvent,
} from './status-rules/low-status-recurrences';
export {
  applyOverstimulation,
  clearActionStatuses,
  clearRestStatuses,
  criticalHealthMoodDelta,
  isCriticalHealthForMood,
  kidneyStoneRecurrenceHours,
  kidneyStoneRecurrenceMetricDeltas,
  overstimulationMoodDelta,
  resolveAttemptStatus,
  resolveNutritionStatuses,
  sugarCrashDelayHours,
  sugarCrashMetricDeltas,
} from './status-rules/context-statuses';

export function isHighMood(mood: number): boolean {
  return mood >= rules.statusRules.overstimulatedMoodMinimum;
}

export function triggersOverstimulation(
  mood: number,
  moodDelta: number,
): boolean {
  return isHighMood(mood) && moodDelta > 0;
}

export function alignGameStatuses(
  metrics: Metrics,
  previous: Partial<Record<GameStatusName, GameStatusRecord>>,
  now: number,
): Partial<Record<GameStatusName, GameStatusRecord>> {
  const next = { ...previous };
  const set = (status: GameStatusName, active: boolean, source: string) => {
    if (active && !next[status]) next[status] = { since: now, source };
    if (!active) delete next[status];
  };

  set(
    'starving',
    metrics.food <= rules.statusRules.lowMetricOnsetMaximum,
    'food',
  );
  set(
    'hungry',
    metrics.food > rules.statusRules.lowMetricOnsetMaximum &&
      metrics.food < rules.statusRules.lowMetricClearMinimum,
    'food',
  );
  for (const rule of LOW_STATUS_RULES.slice(1)) {
    const current = metrics[rule.metric];
    const wasActive = Boolean(previous[rule.status]);
    set(
      rule.status,
      wasActive ? current < rule.clearMinimum : current <= rule.onsetMaximum,
      rule.metric,
    );
  }

  const foodAndRest = metrics.food + metrics.rest;
  set(
    'low_energy',
    previous.low_energy
      ? foodAndRest < rules.statusRules.lowEnergyClearSum
      : foodAndRest < rules.statusRules.lowEnergyOnsetSum,
    'food+rest',
  );
  set(
    'full',
    previous.full
      ? metrics.food > rules.statusRules.fullClearMaximum
      : metrics.food >= rules.statusRules.fullOnsetMinimum,
    'food',
  );
  return next;
}

export function addStatus(
  state: GameState,
  status: GameStatusName,
  source: string,
  at = state.now,
): GameState['statuses'] {
  return state.statuses[status]
    ? state.statuses
    : { ...state.statuses, [status]: { since: at, source } };
}

export function alignFinancialStatus(
  previous: GameState['statuses'],
  totalDebt: number,
  now: number,
): {
  statuses: GameState['statuses'];
  entered: boolean;
  cleared: boolean;
} {
  const active = totalDebt >= financialRules.debt.statusThreshold;
  const wasActive = Boolean(previous.in_debt);
  if (active === wasActive)
    return { statuses: previous, entered: false, cleared: false };
  if (active)
    return {
      statuses: {
        ...previous,
        in_debt: { since: now, source: 'total_debt' },
      },
      entered: true,
      cleared: false,
    };
  const statuses = { ...previous };
  delete statuses.in_debt;
  return { statuses, entered: false, cleared: true };
}

export function clearStatus(
  statuses: GameState['statuses'],
  status: GameStatusName,
): GameState['statuses'] {
  const next = { ...statuses };
  delete next[status];
  return next;
}

export type StatusReconciliation = {
  metrics: Metrics;
  statuses: GameState['statuses'];
  sugarCrashDueAt: number | null;
  onsetEffects: StatusEffectEvent[];
  recurrenceEffects: StatusEffectEvent[];
  clearEffects: StatusEffectEvent[];
  sugarCrash: boolean;
};

/** Apply all status transitions caused by elapsed time at one chronological boundary. */
export function reconcileStatusRules(input: {
  state: GameState;
  metrics: Metrics;
  now: number;
}): StatusReconciliation {
  const { state, now } = input;
  let metrics = input.metrics;
  let statuses = alignGameStatuses(metrics, state.statuses, now);
  const natural = resolveNaturalStatusPassage(
    { ...state, statuses },
    metrics,
    now,
  );
  statuses = natural.statuses;
  metrics = natural.metrics;
  if (
    now - state.history.lastCareAttemptAt >=
    rules.statusRules.overstimulatedClearHours * HOUR_MS
  )
    statuses = clearStatus(statuses, 'overstimulated');
  if (
    now - state.history.lastCareAttemptAt >=
    rules.statusRules.annoyedClearHours * HOUR_MS
  )
    statuses = clearStatus(statuses, 'annoyed');
  const onsetPrevious = { ...state.statuses };
  if (statuses.kidney_stone && state.statuses.kidney_stone)
    onsetPrevious.kidney_stone = statuses.kidney_stone;
  for (const effect of natural.effects) delete onsetPrevious[effect.status];
  if (!statuses.overstimulated) delete onsetPrevious.overstimulated;
  if (!statuses.annoyed) delete onsetPrevious.annoyed;

  const onset = resolveStatusFixedPoint({
    metrics,
    previous: onsetPrevious,
    now,
    align: alignGameStatuses,
    applyOnset: applyStatusOnsetEffects,
  });
  statuses = onset.statuses;
  const recurrence = applyLowStatusRecurrences(
    { ...state, metrics: onset.metrics, statuses },
    now,
  );
  let nextMetrics = { ...onset.metrics };
  for (const effect of recurrence.effects) {
    for (const [metric, delta] of Object.entries(effect.metricDeltas)) {
      const name = metric as keyof Metrics;
      nextMetrics[name] = clampMetric(name, nextMetrics[name] + (delta ?? 0));
    }
  }

  statuses = recurrence.statuses;
  let sugarCrashDueAt = state.history.sugarCrashDueAt;
  let sugarCrash = false;
  if (sugarCrashDueAt !== null && sugarCrashDueAt <= now) {
    nextMetrics.mood = Math.max(
      STAT_MIN,
      nextMetrics.mood + rules.statusMetricDeltas.sugarCrashMood,
    );
    nextMetrics.rest = Math.max(
      STAT_MIN,
      nextMetrics.rest + rules.statusMetricDeltas.sugarCrashRest,
    );
    statuses = addStatus(
      { ...state, statuses },
      'sugar_crash',
      'sugar_servings',
      now,
    );
    sugarCrashDueAt = null;
    sugarCrash = true;
  }
  const finalOnset = resolveStatusFixedPoint({
    metrics: nextMetrics,
    previous: statuses,
    now,
    align: alignGameStatuses,
    applyOnset: applyStatusOnsetEffects,
  });
  nextMetrics = finalOnset.metrics;
  statuses = finalOnset.statuses;
  const naturalStatusSet = new Set(
    natural.effects.map((effect) => effect.status),
  );
  const clearEffects: StatusEffectEvent[] = STATUS_NAMES.filter(
    (status) =>
      state.statuses[status] &&
      !statuses[status] &&
      !naturalStatusSet.has(status),
  ).map((status) => ({
    status,
    metricDeltas: {},
    message: statusTransitionMessage(status, false),
    at: now,
  }));
  clearEffects.push(...natural.effects);
  return {
    metrics: nextMetrics,
    statuses,
    sugarCrashDueAt,
    onsetEffects: [...onset.events, ...finalOnset.events],
    recurrenceEffects: recurrence.effects,
    clearEffects,
    sugarCrash,
  };
}
