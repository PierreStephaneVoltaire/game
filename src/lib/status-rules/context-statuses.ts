import type {
  GameState,
  Metrics,
  StatusName,
  StatusRecord,
} from '../game-types';
import type { StatusEffectEvent } from '../status-rules';
import {
  addStatus,
  alignGameStatuses,
  clearStatus,
  isHighMood,
} from '../status-rules';
import rules from '../data/simulation-rules.json';
import { STAT_MAX, STAT_MIN } from '../game-constants';

export function overstimulationMoodDelta(): number {
  return rules.statusMetricDeltas.overstimulatedMood;
}

export function sugarCrashMetricDeltas(): { mood: number; rest: number } {
  return {
    mood: rules.statusMetricDeltas.sugarCrashMood,
    rest: rules.statusMetricDeltas.sugarCrashRest,
  };
}

export function sugarCrashDelayHours(): number {
  return rules.sugarCrash.delayHours;
}

export function kidneyStoneRecurrenceHours(): number {
  return rules.kidneyStoneRecurrenceHours;
}

export function kidneyStoneRecurrenceMetricDeltas(metrics: Metrics): {
  health: number;
  rest: number;
} {
  return {
    health: -Math.min(1, metrics.health),
    rest: -Math.min(1, metrics.rest),
  };
}

export function criticalHealthMoodDelta(): number {
  return rules.statusMetricDeltas.criticalHealthMood;
}

export function isCriticalHealthForMood(health: number): boolean {
  return (
    health >= rules.statusRules.criticalHealthMinimum &&
    health <= rules.statusRules.criticalHealthMaximum
  );
}

export function clearActionStatuses(
  statuses: GameState['statuses'],
  metrics: Metrics,
  explicit: readonly StatusName[] | undefined,
  tags: readonly string[] | undefined,
): GameState['statuses'] {
  let next = statuses;
  for (const status of explicit ?? []) {
    if (status !== 'sick' || canClearSick(metrics))
      next = clearStatus(next, status);
  }
  if (tags?.includes('apology')) next = clearStatus(next, 'annoyed');
  return next;
}

function canClearSick(metrics: Metrics): boolean {
  return (
    metrics.food <= rules.statusRules.sickClearFoodMaximum &&
    metrics.health >= rules.statusRules.sickClearHealthMinimum
  );
}

export function applyStatusOnsetEffects(
  metrics: Metrics,
  previous: Partial<Record<StatusName, StatusRecord>>,
  next: Partial<Record<StatusName, StatusRecord>>,
): { metrics: Metrics; events: StatusEffectEvent[] } {
  const result = { ...metrics };
  const events: StatusEffectEvent[] = [];
  const onset = (
    status: StatusName,
    deltas: Partial<Metrics>,
    message: string,
  ) => {
    if (previous[status] || !next[status]) return;
    for (const [metric, delta] of Object.entries(deltas)) {
      const name = metric as keyof Metrics;
      result[name] = Math.max(
        STAT_MIN,
        Math.min(STAT_MAX, result[name] + (delta ?? 0)),
      );
    }
    events.push({ status, metricDeltas: deltas, message });
  };
  onset(
    'lonely',
    { mood: rules.statusMetricDeltas.lonelyMood },
    'Companion feels lonely.',
  );
  onset(
    'creative_block',
    { mood: rules.statusMetricDeltas.creativeBlockMood },
    'Companion feels creatively blocked.',
  );
  onset(
    'low_energy',
    { creativity: rules.statusMetricDeltas.lowEnergyCreativity },
    'Companion is running low on energy.',
  );
  return { metrics: result, events };
}

export function clearRestStatuses(
  statuses: GameState['statuses'],
  metrics: Metrics,
): GameState['statuses'] {
  let next = clearStatus(statuses, 'overstimulated');
  if (canClearSick(metrics)) next = clearStatus(next, 'sick');
  return clearStatus(next, 'sugar_crash');
}

export function applyOverstimulation(
  metrics: Metrics,
  statuses: GameState['statuses'],
  source: string,
  now: number,
  eligible = false,
  applyPenalty = true,
): { metrics: Metrics; statuses: GameState['statuses']; applied: boolean } {
  if (!eligible || !isHighMood(metrics.mood))
    return { metrics, statuses, applied: false };
  return {
    metrics: {
      ...metrics,
      mood: applyPenalty
        ? Math.max(
            STAT_MIN,
            metrics.mood + rules.statusMetricDeltas.overstimulatedMood,
          )
        : metrics.mood,
    },
    statuses: addStatus(
      { metrics, statuses } as GameState,
      'overstimulated',
      source,
      now,
    ),
    applied: true,
  };
}

export function resolveAttemptStatus(
  state: GameState,
  accepted: boolean,
): {
  statuses: GameState['statuses'];
  careAttemptStreak: number;
  moodDelta: number;
} {
  const careAttemptStreak = accepted ? 0 : state.history.careAttemptStreak + 1;
  if (
    careAttemptStreak < state.history.annoyanceThreshold ||
    state.statuses.annoyed
  )
    return { statuses: state.statuses, careAttemptStreak, moodDelta: 0 };
  return {
    statuses: addStatus(
      state,
      'annoyed',
      'repeated_unwanted_attempts',
      state.now,
    ),
    careAttemptStreak: 0,
    moodDelta: rules.statusMetricDeltas.annoyedMood,
  };
}

export type NutritionStatusResolution = {
  metrics: Metrics;
  statuses: GameState['statuses'];
  metricDeltas: Partial<Metrics>;
  sickFeedingHarm: boolean;
  sickFeedingDeltas: Partial<Metrics>;
  sickFromFull: boolean;
  kidneyStone: boolean;
  kidneyStoneDeltas: Partial<Metrics>;
};

export function resolveNutritionStatuses(input: {
  metrics: Metrics;
  statuses: GameState['statuses'];
  now: number;
  wasSick: boolean;
  wasFull: boolean;
  fullFeedRoll: number;
  priorSalt: number;
  priorWater: number;
  kidneyStoneRoll: number;
}): NutritionStatusResolution {
  const result = { ...input.metrics };
  const metricDeltas: Partial<Metrics> = {};
  const addMetric = (metric: keyof Metrics, delta: number) => {
    result[metric] = Math.max(
      STAT_MIN,
      Math.min(STAT_MAX, result[metric] + delta),
    );
    metricDeltas[metric] = (metricDeltas[metric] ?? 0) + delta;
  };
  if (input.wasSick) {
    addMetric('health', rules.statusMetricDeltas.sickHealth);
    addMetric('mood', rules.statusMetricDeltas.sickMood);
  }
  const sickFromFull =
    input.wasFull &&
    !input.wasSick &&
    input.fullFeedRoll < rules.fullFeedSicknessProbability;
  if (sickFromFull) {
    addMetric('health', rules.statusMetricDeltas.fullHealth);
    addMetric('mood', rules.statusMetricDeltas.fullMood);
  }
  const kidneyStone =
    !input.statuses.kidney_stone &&
    input.priorSalt >= rules.kidneyStone.saltThreshold &&
    input.priorWater <= rules.kidneyStone.waterThreshold &&
    input.kidneyStoneRoll < rules.kidneyStone.probability;
  if (kidneyStone) {
    addMetric('mood', rules.statusMetricDeltas.kidneyStoneMood);
    addMetric('health', rules.statusMetricDeltas.kidneyStoneHealth);
    addMetric('rest', rules.statusMetricDeltas.kidneyStoneRest);
  }
  let statuses = alignGameStatuses(result, input.statuses, input.now);
  if (sickFromFull)
    statuses = addStatus(
      { metrics: result, statuses } as GameState,
      'sick',
      'feeding',
      input.now,
    );
  if (kidneyStone)
    statuses = addStatus(
      { metrics: result, statuses } as GameState,
      'kidney_stone',
      'rolling_nutrition',
      input.now,
    );
  return {
    metrics: result,
    statuses,
    metricDeltas,
    sickFeedingHarm: input.wasSick,
    sickFeedingDeltas: input.wasSick
      ? {
          health: rules.statusMetricDeltas.sickHealth,
          mood: rules.statusMetricDeltas.sickMood,
        }
      : sickFromFull
        ? {
            health: rules.statusMetricDeltas.fullHealth,
            mood: rules.statusMetricDeltas.fullMood,
          }
        : {},
    sickFromFull,
    kidneyStone,
    kidneyStoneDeltas: kidneyStone
      ? {
          mood: rules.statusMetricDeltas.kidneyStoneMood,
          health: rules.statusMetricDeltas.kidneyStoneHealth,
          rest: rules.statusMetricDeltas.kidneyStoneRest,
        }
      : {},
  };
}
