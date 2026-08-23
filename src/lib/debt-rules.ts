import rules from './data/simulation-rules.json';

/**
 * Returns the periodic Health-recovery penalty caused by outstanding medical
 * debt. Health resolution owns the final recovery calculation; the time
 * reconciler can subtract this value from its recovery score at each boundary.
 */
export function recoveryPenaltyForDebt(balance: number): number {
  if (balance >= 0) return 0;
  return Math.min(
    rules.debt.maximumRecoveryPenalty,
    Math.floor(Math.abs(balance) / rules.debt.recoveryPenaltyDivisor),
  );
}
