import type { GameDefinition } from '../game-definition';
import type { GameState } from '../game-types';
import { simulationRules as rules } from '../runtime-definition';
import { HOUR_MS } from '../game-constants';
import type { NutritionResolution } from './nutrition-resolution';

export function resolveTimedEffectsAfterConsumption(
  state: GameState,
  item: GameDefinition['items'][number],
  nutrition: NutritionResolution,
  at: number,
): GameState['timedEffects'] {
  const caffeine =
    nutrition.consumptions[nutrition.consumptions.length - 1]?.caffeine ??
    item.nutritionScores?.caffeine ??
    item.properties?.caffeine ??
    0;
  const deferredRestLossAt =
    caffeine >= rules.caffeine.minimumScore &&
    state.timedEffects.deferredRestLossAt === null
      ? at +
        (rules.timeDecay.intervalHours -
          state.history.decayRemainderHours +
          rules.caffeine.deferHours) *
          HOUR_MS
      : state.timedEffects.deferredRestLossAt;
  const hyperfocus = item.tags.includes('hyperfocus');
  return {
    ...state.timedEffects,
    deferredRestLossAt,
    hyperfocusUntil: hyperfocus
      ? at + rules.hyperfocus.durationHours * HOUR_MS
      : state.timedEffects.hyperfocusUntil,
    painReliefUntil:
      item.tags.includes('pain-relief') || item.tags.includes('pain_relief')
        ? at + rules.kidneyStone.painReliefHours * HOUR_MS
        : state.timedEffects.painReliefUntil,
  };
}
