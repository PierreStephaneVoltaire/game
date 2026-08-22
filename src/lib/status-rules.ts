import type {
  GameState,
  Metrics,
  StatusName as GameStatusName,
  StatusRecord as GameStatusRecord,
} from './game-types';
import rules from './data/simulation-rules.json';
import { resolveStatusFixedPoint } from './status-rules/fixed-point';
import { HOUR_MS, STAT_MAX, STAT_MIN } from './game-constants';
import { STATUS_NAMES } from './status-rules/names';
export { STATUS_NAMES, isStatusName } from './status-rules/names';
export { nextStatusBoundary } from './status-rules/boundaries';
import { applyStatusOnsetEffects } from './status-rules/context-statuses';
import { statusTransitionMessage } from './event-messages';
export { applyStatusOnsetEffects };
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

const LOW_STATUS_RULES: ReadonlyArray<{
  status: GameStatusName;
  metric: keyof Metrics;
  onsetMaximum: number;
  clearMinimum: number;
}> = [
  {
    status: 'starving',
    metric: 'food',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
  {
    status: 'sleep_deprived',
    metric: 'rest',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
  {
    status: 'depressed',
    metric: 'mood',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
  {
    status: 'lonely',
    metric: 'bond',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
  {
    status: 'creative_block',
    metric: 'creativity',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
];

export type StatusEffectEvent = {
  status: GameStatusName;
  metricDeltas: Partial<Metrics>;
  message: string;
  at?: number;
};

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

export function applyLowStatusRecurrences(
  state: GameState,
  at: number,
): { statuses: GameState['statuses']; effects: StatusEffectEvent[] } {
  const statuses = { ...state.statuses };
  const effects: StatusEffectEvent[] = [];
  for (const [status, metric] of [
    ['lonely', 'bond'],
    ['creative_block', 'creativity'],
  ] as const) {
    if (state.metrics[metric] > rules.statusRules.lowMetricOnsetMaximum)
      continue;
    const record = statuses[status];
    if (!record) continue;
    const lastPenaltyAt = record.lastPenaltyAt ?? record.since;
    const recurrenceMs = rules.statusRules.recurrenceHours * HOUR_MS;
    const occurrences = Math.floor((at - lastPenaltyAt) / recurrenceMs);
    if (occurrences < 1) continue;
    statuses[status] = {
      ...record,
      lastPenaltyAt: lastPenaltyAt + occurrences * recurrenceMs,
    };
    for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
      effects.push({
        status,
        metricDeltas: {
          mood: rules.statusMetricDeltas.lowStatusRecurrenceMood,
        },
        at: lastPenaltyAt + (occurrence + 1) * recurrenceMs,
        message:
          status === 'lonely'
            ? 'Companion is still feeling lonely.'
            : 'Companion is still creatively blocked.',
      });
    }
  }
  return { statuses, effects };
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
  const { state, metrics, now } = input;
  let statuses = alignGameStatuses(metrics, state.statuses, now);
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
  const nextMetrics = { ...onset.metrics };
  for (const effect of recurrence.effects) {
    for (const [metric, delta] of Object.entries(effect.metricDeltas)) {
      const name = metric as keyof Metrics;
      nextMetrics[name] = Math.max(
        STAT_MIN,
        Math.min(STAT_MAX, nextMetrics[name] + (delta ?? 0)),
      );
    }
  }

  statuses = recurrence.statuses;
  const clearEffects = STATUS_NAMES.filter(
    (status) => state.statuses[status] && !statuses[status],
  ).map((status) => ({
    status,
    metricDeltas: {},
    message: statusTransitionMessage(status, false),
    at: now,
  }));
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
  return {
    metrics: nextMetrics,
    statuses,
    sugarCrashDueAt,
    onsetEffects: onset.events,
    recurrenceEffects: recurrence.effects,
    clearEffects,
    sugarCrash,
  };
}
