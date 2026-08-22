import type { ItemActionDefinition, ItemDefinition } from '../game-definition';
import type { GameCommand, GameState } from '../game-types';
import rules from '../data/simulation-rules.json';
import { actionRandom, resolveRange } from '../seeded-rng';
import { clearActionStatuses } from '../status-rules';
import {
  applyOverstimulation,
  overstimulationMoodDelta,
  resolveNutritionStatuses,
  triggersOverstimulation,
} from '../status-rules';
import { HOUR_MS, STAT_MAX, STAT_MIN } from '../game-constants';

type UseItemCommand = Extract<GameCommand, { type: 'use_item' }>;

export type NutritionResolution = {
  metrics: GameState['metrics'];
  statuses: GameState['statuses'];
  metricDeltas: Partial<GameState['metrics']>;
  itemMetricDeltas: Partial<GameState['metrics']>;
  consumptions: GameState['history']['consumptions'];
  sugarServings: GameState['history']['consumptions'];
  fulfilledCraving: boolean;
  nutritionProfileId?: string;
  preparationRejected: boolean;
  fullFeedSuppressed: boolean;
  sickFeedingHarm: boolean;
  sickFeedingDeltas: Partial<GameState['metrics']>;
  sickFromFull: boolean;
  kidneyStone: boolean;
  kidneyStoneDeltas: Partial<GameState['metrics']>;
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
  if (wasSick || wasFull) delete metricDeltas.food;
  const fulfilledCraving = state.history.cravingItemId === item.id;
  if (fulfilledCraving) metricDeltas.bond = (metricDeltas.bond ?? 0) + 1;
  for (const [metric, delta] of Object.entries(metricDeltas)) {
    const name = metric as keyof GameState['metrics'];
    metrics[name] = Math.max(
      STAT_MIN,
      Math.min(STAT_MAX, metrics[name] + (delta ?? 0)),
    );
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
            sugarTagged: (nutritionScores.sugar ?? 0) > 0,
            nutritionProfileId: profile?.id,
          },
        ]
      : state.history.consumptions;
  const sugarServings = consumptions.filter(
    (consumption) =>
      consumption.at >=
        state.now - rules.nutrition.sugarWindowHours * HOUR_MS &&
      consumption.sugarTagged,
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
    kidneyStoneRoll: actionRandom(
      state.seed,
      state.stateVersion,
      command.commandId,
      'kidney_stone',
      'onset',
    ),
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
  if ((nutritionScores.protein ?? 0) >= rules.sugarCrash.proteinClearMinimum)
    statuses = clearActionStatuses(
      statuses,
      resolvedMetrics,
      ['sugar_crash'],
      undefined,
    );
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
    sugarServings,
    fulfilledCraving,
    nutritionProfileId: profile?.id,
    preparationRejected,
    fullFeedSuppressed: wasFull,
    sickFeedingHarm: nutritionResolution.sickFeedingHarm,
    sickFeedingDeltas: nutritionResolution.sickFeedingDeltas,
    sickFromFull: nutritionResolution.sickFromFull,
    kidneyStone: nutritionResolution.kidneyStone,
    kidneyStoneDeltas: nutritionResolution.kidneyStoneDeltas,
  };
}
