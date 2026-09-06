import type { ItemActionDefinition, ItemDefinition } from '../game-definition';
import type { GameCommand, GameState } from '../game-types';
import { simulationRules as rules } from '../runtime-definition';
import { actionRandom, resolveRange } from '../seeded-rng';
import { clearActionStatuses } from '../status-rules';
import {
  applyOverstimulation,
  overstimulationMoodDelta,
  resolveNutritionStatuses,
  triggersOverstimulation,
} from '../status-rules';
import { clampMetric, HOUR_MS } from '../game-constants';
import { resolveSugarCrashConsumption } from '../status-rules/sugar-crash';

type UseItemCommand = Extract<GameCommand, { type: 'use_item' }>;

export type NutritionResolution = {
  metrics: GameState['metrics'];
  statuses: GameState['statuses'];
  metricDeltas: Partial<GameState['metrics']>;
  itemMetricDeltas: Partial<GameState['metrics']>;
  consumptions: GameState['history']['consumptions'];
  kidneyStoneFeeds: GameState['history']['kidneyStoneFeeds'];
  effectiveSugar: number;
  sugarCrashDueAt: number | null;
  sugarCrashTransition: 'scheduled' | 'cancelled' | 'active_cleared' | null;
  fulfilledCraving: boolean;
  nutritionProfileId?: string;
  preparationRejected: boolean;
  fullFeedSuppressed: boolean;
  sicknessOnsetDeltas: Partial<GameState['metrics']>;
  sickFromFull: boolean;
  kidneyStone: boolean;
  kidneyStoneDeltas: Partial<GameState['metrics']>;
  kidneyRiskWarning: boolean;
  dizzySpell: boolean;
  dizzySpellDeltas: Partial<GameState['metrics']>;
};

export function resolveNutritionConsumption(
  state: GameState,
  command: UseItemCommand,
  item: ItemDefinition,
  action?: ItemActionDefinition,
): NutritionResolution {
  const profiles = item.nutrition?.fictionalProfiles ?? [];
  const profile = profiles.length
    ? profiles[
        Math.floor(
          actionRandom(
            state.seed,
            state.stateVersion,
            command.commandId,
            'nutrition_profile',
            item.id,
          ) * profiles.length,
        )
      ]
    : undefined;
  const nutritionScores = profile?.nutritionScores ?? {
    salt: item.nutritionScores?.salt ?? item.properties?.salt ?? 0,
    water: item.nutritionScores?.water ?? item.properties?.water ?? 0,
    protein: item.nutritionScores?.protein ?? item.properties?.protein ?? 0,
    sugar: item.nutritionScores?.sugar ?? item.properties?.sugar ?? 0,
    caffeine: item.nutritionScores?.caffeine ?? item.properties?.caffeine ?? 0,
  };
  const metricDeltas: Partial<GameState['metrics']> = {};
  for (const [metric, range] of Object.entries(item.effects ?? {}))
    metricDeltas[metric as keyof GameState['metrics']] = resolveRange(
      range,
      actionRandom(
        state.seed,
        state.stateVersion,
        command.commandId,
        'item_effect',
        metric,
      ),
    );
  for (const [metric, range] of Object.entries(action?.effects ?? {})) {
    const name = metric as keyof GameState['metrics'];
    metricDeltas[name] =
      (metricDeltas[name] ?? 0) +
      resolveRange(
        range,
        actionRandom(
          state.seed,
          state.stateVersion,
          command.commandId,
          'item_action_effect',
          `${action?.id}:${metric}`,
        ),
      );
  }
  const preparationRejected = Boolean(
    item.edible &&
    item.preferences?.includes('specific_preparation') &&
    actionRandom(
      state.seed,
      state.stateVersion,
      command.commandId,
      'item_preparation',
      'acceptable',
    ) >= (item.context?.preparationAcceptance ?? 1),
  );
  const disliked =
    item.edible &&
    (item.preferences?.includes('disliked') || preparationRejected);
  if (disliked) {
    for (const [metric, range] of Object.entries(
      item.context?.dislikedEffects ?? {},
    )) {
      const name = metric as keyof GameState['metrics'];
      metricDeltas[name] =
        (metricDeltas[name] ?? 0) +
        resolveRange(
          range,
          actionRandom(
            state.seed,
            state.stateVersion,
            command.commandId,
            'disliked_effect',
            metric,
          ),
        );
    }
  }
  if (item.edible && item.preferences?.includes('liked'))
    metricDeltas.mood = Math.max(metricDeltas.mood ?? 0, 1);
  const itemOverstimulated = triggersOverstimulation(
    state.metrics.mood,
    metricDeltas.mood ?? 0,
  );
  if (itemOverstimulated) metricDeltas.mood = overstimulationMoodDelta();

  const metrics = { ...state.metrics };
  const wasSick = item.edible && Boolean(state.statuses.sick);
  const wasFull = item.edible && Boolean(state.statuses.full);
  if (wasFull) delete metricDeltas.food;
  const fulfilledCraving = state.history.cravingItemId === item.id;
  if (fulfilledCraving) metricDeltas.bond = (metricDeltas.bond ?? 0) + 1;
  for (const [metric, delta] of Object.entries(metricDeltas)) {
    const name = metric as keyof GameState['metrics'];
    metrics[name] = clampMetric(name, metrics[name] + (delta ?? 0));
  }

  const consumptions =
    item.edible || item.statusHooks?.includes('rolling_salt')
      ? [
          ...state.history.consumptions.filter(
            (consumption) =>
              consumption.at >=
              state.now - rules.nutrition.rollingWindowHours * HOUR_MS,
          ),
          {
            at: state.now,
            itemId: item.id,
            salt: nutritionScores.salt ?? 0,
            water: nutritionScores.water ?? 0,
            protein: nutritionScores.protein ?? 0,
            sugar: nutritionScores.sugar ?? 0,
            caffeine: nutritionScores.caffeine ?? 0,
            sugarServings:
              item.sugarServings ?? ((nutritionScores.sugar ?? 0) > 0 ? 1 : 0),
            sugarTagged: (nutritionScores.sugar ?? 0) > 0,
            nutritionProfileId: profile?.id,
          },
        ]
      : state.history.consumptions;
  const currentFeed = item.edible ? consumptions.at(-1) : undefined;
  const kidneyStoneFeeds = currentFeed
    ? [...state.history.kidneyStoneFeeds, currentFeed].slice(
        -rules.kidneyStone.feedWindowSize,
      )
    : state.history.kidneyStoneFeeds;
  const previousKidneySalt = state.history.kidneyStoneFeeds.reduce(
    (total, consumption) => total + consumption.salt,
    0,
  );
  const previousKidneyWater = state.history.kidneyStoneFeeds.reduce(
    (total, consumption) => total + consumption.water,
    0,
  );
  const kidneySalt = kidneyStoneFeeds.reduce(
    (total, consumption) => total + consumption.salt,
    0,
  );
  const kidneyWater = kidneyStoneFeeds.reduce(
    (total, consumption) => total + consumption.water,
    0,
  );
  const priorNutrition = state.history.consumptions.filter(
    (consumption) =>
      consumption.at >=
      state.now - rules.nutrition.rollingWindowHours * HOUR_MS,
  );
  const nutritionResolution = resolveNutritionStatuses({
    metrics,
    statuses: state.statuses,
    now: state.now,
    wasSick,
    wasFull,
    fullFeedRoll: actionRandom(
      state.seed,
      state.stateVersion,
      command.commandId,
      'full_feed',
      'sick',
    ),
    priorSalt: priorNutrition.reduce(
      (total, consumption) => total + consumption.salt,
      0,
    ),
    priorWater: priorNutrition.reduce(
      (total, consumption) => total + consumption.water,
      0,
    ),
    kidneySalt,
    kidneyWater,
    kidneyStoneRoll: actionRandom(
      state.seed,
      state.stateVersion,
      command.commandId,
      'kidney_stone',
      'onset',
    ),
    currentSalt: nutritionScores.salt ?? 0,
    currentWater: nutritionScores.water ?? 0,
  });
  const itemMetricDeltas = { ...metricDeltas };
  for (const [metric, delta] of Object.entries(
    nutritionResolution.metricDeltas,
  )) {
    const name = metric as keyof GameState['metrics'];
    metricDeltas[name] = (metricDeltas[name] ?? 0) + (delta ?? 0);
  }
  let resolvedMetrics = nutritionResolution.metrics;
  let statuses = nutritionResolution.statuses;
  const sugarCrash = resolveSugarCrashConsumption({
    consumptions,
    statuses,
    dueAt: state.history.sugarCrashDueAt,
    now: state.now,
  });
  statuses = sugarCrash.statuses;
  if (itemOverstimulated)
    resolvedMetrics = applyOverstimulation(
      resolvedMetrics,
      statuses,
      'high_mood_item_action',
      state.now,
      true,
      false,
    ).metrics;
  statuses = clearActionStatuses(
    statuses,
    resolvedMetrics,
    [...(item.clearsStatuses ?? []), ...(action?.clearsStatuses ?? [])],
    action?.tags,
  );
  return {
    metrics: resolvedMetrics,
    statuses,
    metricDeltas,
    itemMetricDeltas,
    consumptions,
    kidneyStoneFeeds,
    effectiveSugar: sugarCrash.effectiveSugar,
    sugarCrashDueAt: sugarCrash.dueAt,
    sugarCrashTransition: sugarCrash.transition,
    fulfilledCraving,
    nutritionProfileId: profile?.id,
    preparationRejected,
    fullFeedSuppressed: wasFull,
    sicknessOnsetDeltas: nutritionResolution.sicknessOnsetDeltas,
    sickFromFull: nutritionResolution.sickFromFull,
    kidneyStone: nutritionResolution.kidneyStone,
    kidneyStoneDeltas: nutritionResolution.kidneyStoneDeltas,
    kidneyRiskWarning:
      kidneySalt >= rules.kidneyStone.warningSaltThreshold &&
      kidneyWater <= rules.kidneyStone.waterThreshold &&
      !(
        previousKidneySalt >= rules.kidneyStone.warningSaltThreshold &&
        previousKidneyWater <= rules.kidneyStone.waterThreshold
      ),
    dizzySpell: nutritionResolution.dizzySpell,
    dizzySpellDeltas: nutritionResolution.dizzySpellDeltas,
  };
}
