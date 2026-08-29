import type { GameState } from './game-types';

export function creditIncome(state: GameState, amount: number): GameState {
  if (amount <= 0) return state;
  return { ...state, balance: state.balance + amount };
}
