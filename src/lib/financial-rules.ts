import financialRules from './data/financial-rules.json';
import type { DebtBreakdown, FinancialEffect } from './financial-types';
import type { GameEvent, GameState } from './game-types';
import { alignFinancialStatus } from './status-rules';
import { financialRuinCause, runEndingMessage } from './ending-rules/messages';

export function debtBreakdown(state: GameState): DebtBreakdown {
  const negativeCash = Math.max(0, -state.balance);
  const hospitalPrincipal = state.medicalDebt.reduce(
    (sum, bill) => sum + bill.remainingPrincipal,
    0,
  );
  const locClosureCost =
    state.lineOfCredit.status === 'open'
      ? state.lineOfCredit.remainingClosureCost
      : 0;
  const otherFinancedPrincipal = state.financedObligations.reduce(
    (sum, obligation) => sum + obligation.remainingPrincipal,
    0,
  );
  return {
    negativeCash,
    hospitalPrincipal,
    locClosureCost,
    otherFinancedPrincipal,
    total:
      negativeCash +
      hospitalPrincipal +
      locClosureCost +
      otherFinancedPrincipal,
  };
}

/**
 * Finalize one complete cash/debt operation. The caller supplies the already
 * mutated state and its trigger event; this module owns derived debt evidence,
 * status alignment, and immediate insolvency.
 */
export function finalizeFinancialOperation(input: {
  before: GameState;
  state: GameState;
  triggerEventId: string;
  kind: string;
  purchaseCategory?: string;
}): GameState {
  const beforeDebt = debtBreakdown(input.before);
  const afterDebt = debtBreakdown(input.state);
  const effect: FinancialEffect = {
    kind: input.kind,
    cashDelta: input.state.balance - input.before.balance,
    before: beforeDebt,
    after: afterDebt,
    purchaseCategory: input.purchaseCategory,
  };
  let next = patchTriggerEvent(input.state, input.triggerEventId, effect);
  const aligned = alignFinancialStatus(next.statuses, next.balance, next.now);
  if (aligned.entered || aligned.cleared) {
    const event: GameEvent = {
      id: `event-${next.events.length + 1}`,
      type: aligned.entered ? 'debt_status_entered' : 'debt_status_recovered',
      at: next.now,
      message: aligned.entered
        ? 'Balance fell below $0.'
        : 'Balance returned to $0 or above.',
      sourceActionId: next.events.find(
        (candidate) => candidate.id === input.triggerEventId,
      )?.sourceActionId,
      status: 'in_debt',
      causedBy: [input.triggerEventId],
      financialEffect: effect,
    };
    next = {
      ...next,
      statuses: aligned.statuses,
      events: [...next.events, event],
      stateVersion: next.stateVersion + 1,
    };
  } else next = { ...next, statuses: aligned.statuses };

  if (
    next.ending ||
    next.metrics.health <= 0 ||
    input.before.balance <= -financialRules.debt.financialRuinBalance ||
    next.balance > -financialRules.debt.financialRuinBalance
  )
    return next;
  const causedBy = [
    input.triggerEventId,
    ...next.events
      .filter(
        (event) =>
          event.type === 'debt_status_entered' &&
          event.causedBy?.includes(input.triggerEventId),
      )
      .map((event) => event.id),
  ];
  const event: GameEvent = {
    id: `event-${next.events.length + 1}`,
    type: 'run_ended',
    at: next.now,
    message: runEndingMessage('financial_ruin'),
    causedBy,
    endingKind: 'financial_ruin',
    cause: financialRuinCause(),
    financialEffect: effect,
  };
  return {
    ...next,
    ending: {
      kind: 'financial_ruin',
      at: next.now,
      cause: financialRuinCause(),
      endingBalance: next.balance,
      triggerEventId: input.triggerEventId,
      eventIds: [...causedBy, event.id],
    },
    events: [...next.events, event],
    stateVersion: next.stateVersion + 1,
  };
}

function patchTriggerEvent(
  state: GameState,
  triggerEventId: string,
  financialEffect: FinancialEffect,
): GameState {
  const index = state.events.findIndex((event) => event.id === triggerEventId);
  if (index < 0) return state;
  const events = [...state.events];
  events[index] = { ...events[index], financialEffect };
  return { ...state, events };
}
