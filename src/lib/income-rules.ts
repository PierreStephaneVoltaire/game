import type { GameState } from './game-types';
import { trace } from './telemetry/collector';

export function creditIncome(state: GameState, amount: number): GameState {
  if (amount <= 0) return state;
  const next = { ...state, balance: state.balance + amount };
  trace('income', 'creditIncome', {
    amount,
    at: state.now,
    cashBefore: state.balance,
    cashAfter: next.balance,
  });
  return next;
}
