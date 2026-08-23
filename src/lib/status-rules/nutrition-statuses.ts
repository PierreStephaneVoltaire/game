import type { GameState, Metrics } from '../game-types';
import { addStatus, alignGameStatuses } from '../status-rules';
import rules from '../data/simulation-rules.json';
import { HOUR_MS, STAT_MAX, STAT_MIN } from '../game-constants';

export type NutritionStatusResolution = {
  metrics: Metrics;
  statuses: GameState['statuses'];
  metricDeltas: Partial<Metrics>;
  sickFeedingHarm: boolean;
  sickFeedingDeltas: Partial<Metrics>;
  sickFromFull: boolean;
  kidneyStone: boolean;
  kidneyStoneDeltas: Partial<Metrics>;
  dizzySpell: boolean;
  dizzySpellDeltas: Partial<Metrics>;
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
  naturalPassRoll?: number;
  currentSalt?: number;
  currentWater?: number;
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
    statuses = {
      ...addStatus(
        { metrics: result, statuses } as GameState,
        'sick',
        'feeding',
        input.now,
      ),
      sick: {
        since: input.now,
        source: 'feeding',
        naturalPassAt: input.now + rules.sick.naturalPassHours * HOUR_MS,
      },
    };
  if (kidneyStone)
    statuses = {
      ...addStatus(
        { metrics: result, statuses } as GameState,
        'kidney_stone',
        'rolling_nutrition',
        input.now,
      ),
      kidney_stone: {
        since: input.now,
        source: 'rolling_nutrition',
        naturalPassAt:
          input.now +
          rules.kidneyStone.naturalPassHours[
            Math.min(
              rules.kidneyStone.naturalPassHours.length - 1,
              Math.floor(
                (input.naturalPassRoll ?? input.kidneyStoneRoll) *
                  rules.kidneyStone.naturalPassHours.length,
              ),
            )
          ] *
            HOUR_MS,
      },
    };
  if (
    input.statuses.dizzy_spell &&
    input.priorSalt + (input.currentSalt ?? 0) >=
      rules.dizzySpell.clearSaltMinimum &&
    input.priorWater + (input.currentWater ?? 0) >=
      rules.dizzySpell.clearWaterMinimum
  )
    delete statuses.dizzy_spell;
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
    dizzySpell: false,
    dizzySpellDeltas: {},
  };
}
