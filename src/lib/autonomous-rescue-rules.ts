import type { GameState } from './game-types';
import { simulationRules as rules } from './runtime-definition';

export function resetPlayerCareRescueLocks(
  before: GameState,
  after: GameState,
): GameState {
  const threshold = rules.timeDecay.autonomousRescueResetMinimum;
  const foodReset =
    after.metrics.food > before.metrics.food && after.metrics.food >= threshold;
  const restReset =
    after.metrics.rest > before.metrics.rest && after.metrics.rest >= threshold;
  if (!foodReset && !restReset) return after;
  return {
    ...after,
    history: {
      ...after.history,
      autonomousRescue: {
        foodLocked: foodReset
          ? false
          : after.history.autonomousRescue.foodLocked,
        restLocked: restReset
          ? false
          : after.history.autonomousRescue.restLocked,
      },
    },
  };
}
