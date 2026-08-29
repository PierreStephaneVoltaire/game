import { finalizeFinancialOperation } from '../financial-rules';
import type { Activity, GameEvent, GameState } from '../game-types';

/** Finalize activity cash/debt changes and collect their causal ledger ids. */
export function settleActivityFinances(input: {
  before: GameState;
  state: GameState;
  activity: Activity;
  completionEvent: GameEvent;
}): { state: GameState; eventIds: string[] } {
  let next = input.state;
  if (
    input.activity.type !== 'medical_care' &&
    next.balance !== input.before.balance
  )
    next = finalizeFinancialOperation({
      before: input.before,
      state: next,
      triggerEventId: input.completionEvent.id,
      kind: `${input.activity.type}_income`,
    });
  const derivedIds = next.events
    .slice(input.before.events.length + 1)
    .filter(
      (event) =>
        event.type === 'medical_debt_created' ||
        event.type === 'debt_status_entered' ||
        event.type === 'debt_status_recovered' ||
        event.type === 'run_ended',
    )
    .map(({ id }) => id);
  return {
    state: next,
    eventIds: [input.completionEvent.id, ...derivedIds],
  };
}

export function appendCommissionPayoutEvent(
  state: GameState,
  activity: Activity,
  at: number,
  amount: number,
): GameState {
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'full_body_project_completed',
    at,
    message: `Commission Work paid out $${amount}.`,
    sourceActionId: activity.sourceActionId,
    amount,
  };
  return { ...state, events: [...state.events, event] };
}
