import type { NutritionResolution } from '../commands/nutrition-resolution';
import type { ItemActionDefinition, ItemDefinition } from '../game-definition';
import type { GameState } from '../game-types';
import { trace } from './collector';

export function traceNutrition(
  state: GameState,
  item: ItemDefinition,
  action: ItemActionDefinition | undefined,
  result: NutritionResolution,
): void {
  trace('nutrition_resolution', item.id, {
    at: state.now,
    stateVersion: state.stateVersion,
    metricsBefore: state.metrics,
    statusesBefore: state.statuses,
    itemEffects: item.effects,
    actionEffects: action?.effects,
    preferences: item.preferences,
    context: item.context,
    nutritionScores: item.nutritionScores,
    nutrition: item.nutrition,
    statusHooks: item.statusHooks,
    clearsStatuses: item.clearsStatuses,
    actionClearsStatuses: action?.clearsStatuses,
    result,
  });
}
