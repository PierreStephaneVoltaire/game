import rules from '../data/simulation-rules.json';
import type { GameState } from '../game-types';

export function purchaseMetrics(state: GameState): GameState['metrics'] {
  if (state.balance >= 0) return state.metrics;
  return {
    ...state.metrics,
    mood: Math.max(0, state.metrics.mood + rules.debt.purchaseMood),
  };
}
