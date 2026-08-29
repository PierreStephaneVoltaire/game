import type { GameEvent, GameState, Outcome } from '../game-types';
import { accepted, rejected } from '../simulation/engine-state';
import {
  discountedMedicalDebtPrice,
  totalMedicalDebt,
} from '../medical-debt-rules';
import { finalizeFinancialOperation } from '../financial-rules';

export function payMedicalDebtInFull(
  state: GameState,
  commandId: string,
): { state: GameState; outcome: Outcome } {
  const principal = totalMedicalDebt(state);
  if (principal <= 0)
    return {
      state,
      outcome: rejected('unavailable', 'There is no medical debt to pay.'),
    };
  const price = discountedMedicalDebtPrice(state);
  if (state.balance < price)
    return {
      state,
      outcome: rejected(
        'insufficient_funds',
        'Not enough money to pay every medical bill in full.',
      ),
    };
  const paymentIds = state.medicalDebt.map(
    (bill) => `medical-full-payment:${bill.id}:${state.now}`,
  );
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'medical_debt_paid_in_full',
    at: state.now,
    message: `Paid all $${principal} of medical principal for the discounted price of $${price}.`,
    sourceActionId: commandId,
    amount: -price,
    medicalPaymentIds: paymentIds,
  };
  const mutated: GameState = {
    ...state,
    balance: state.balance - price,
    medicalDebt: [],
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return {
    state: finalizeFinancialOperation({
      before: state,
      state: mutated,
      triggerEventId: event.id,
      kind: 'medical_debt_full_payment',
    }),
    outcome: accepted('medical_debt_paid', event.message, [event.id]),
  };
}
