import { financialRules } from '$lib/runtime-definition';
import { debtBreakdown } from '$lib/financial-rules';
import type { GameState } from '$lib/game-types';
import {
  discountedMedicalDebtPrice,
  totalMedicalDebt,
} from '$lib/medical-debt-rules';

export type FinancialViewModel = ReturnType<typeof financialPresentation>;

/** Project financial domain state without leaking settlement rules into Svelte. */
export function financialPresentation(state: GameState) {
  const breakdown = debtBreakdown(state);
  return {
    medicalDebt: {
      total: totalMedicalDebt(state),
      nextScheduledPayment: state.medicalDebt.reduce(
        (sum, bill) =>
          sum + Math.min(bill.scheduledDailyPayment, bill.remainingPrincipal),
        0,
      ),
      discountedFullPayment: discountedMedicalDebtPrice(state),
    },
    debt: {
      active: state.balance < 0,
      amount: Math.max(0, -state.balance),
      ...breakdown,
    },
    lineOfCredit: {
      status: state.lineOfCredit.status,
      remainingUnits:
        state.lineOfCredit.status === 'open'
          ? state.lineOfCredit.remainingUnits
          : 0,
      remainingClosureCost:
        state.lineOfCredit.status === 'open'
          ? state.lineOfCredit.remainingClosureCost
          : 0,
      repaymentUnitPrice: financialRules.lineOfCredit.repaymentUnitPrice,
      applicationPrice: financialRules.lineOfCredit.applicationPrice,
      cashAdvance: financialRules.lineOfCredit.cashAdvance,
      totalUnits: financialRules.lineOfCredit.repaymentUnitCount,
      totalClosureCost: financialRules.lineOfCredit.totalClosureCost,
    },
  };
}
