import type { GameEvent, GameState, MedicalDebtBill } from './game-types';
import rules from './data/simulation-rules.json';
import { localDate } from './shop-rules';
import { finalizeFinancialOperation } from './financial-rules';

export function totalMedicalDebt(state: GameState): number {
  return state.medicalDebt.reduce(
    (total, bill) => total + bill.remainingPrincipal,
    0,
  );
}

export function discountedMedicalDebtPrice(state: GameState): number {
  return Math.ceil(
    totalMedicalDebt(state) * rules.medicalCare.fullPaymentMultiplier,
  );
}

export function createMedicalDebtBill(input: {
  activityId: string;
  createdAt: number;
  principal: number;
  insuredAtStart: boolean;
  scheduledDailyPayment: number;
}): MedicalDebtBill {
  return {
    id: `medical-bill:${input.activityId}`,
    createdAt: input.createdAt,
    originalPrincipal: input.principal,
    remainingPrincipal: input.principal,
    scheduledDailyPayment: input.scheduledDailyPayment,
    insuredAtStart: input.insuredAtStart,
  };
}

/** Resolve one local-day payment pass, oldest bill first, without overdraft. */
export function processDailyMedicalPayments(
  state: GameState,
  at: number,
): { state: GameState; eventIds: string[] } {
  const date = localDate(at, state.timezone);
  if (state.history.oncePerLocalDate.medical_debt_payment === date)
    return { state, eventIds: [] };
  let available = Math.max(0, state.balance);
  let paidTotal = 0;
  const paymentIds: string[] = [];
  const bills = [...state.medicalDebt]
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    )
    .map((bill) => {
      const due = Math.min(bill.scheduledDailyPayment, bill.remainingPrincipal);
      const paid = Math.min(due, available);
      available -= paid;
      paidTotal += paid;
      if (paid > 0) paymentIds.push(`medical-payment:${bill.id}:${date}`);
      return { ...bill, remainingPrincipal: bill.remainingPrincipal - paid };
    })
    .filter((bill) => bill.remainingPrincipal > 0);
  let next: GameState = {
    ...state,
    balance: state.balance - paidTotal,
    medicalDebt: bills,
    history: {
      ...state.history,
      oncePerLocalDate: {
        ...state.history.oncePerLocalDate,
        medical_debt_payment: date,
      },
    },
  };
  if (state.medicalDebt.length === 0) return { state: next, eventIds: [] };
  const event: GameEvent = {
    id: `event-${next.events.length + 1}`,
    type: 'medical_debt_daily_payment',
    at,
    message:
      paidTotal > 0
        ? `The daily medical payment plan paid $${paidTotal}.`
        : 'The daily medical payment was missed; the principal remains outstanding.',
    amount: -paidTotal,
    medicalPaymentIds: paymentIds,
  };
  next = { ...next, events: [...next.events, event] };
  next = finalizeFinancialOperation({
    before: state,
    state: next,
    triggerEventId: event.id,
    kind: 'medical_debt_daily_payment',
  });
  return {
    state: next,
    eventIds: next.events.slice(state.events.length).map(({ id }) => id),
  };
}
