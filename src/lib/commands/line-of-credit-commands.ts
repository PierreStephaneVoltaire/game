import financialRules from '../data/financial-rules.json';
import { finalizeFinancialOperation } from '../financial-rules';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import { accepted, rejected } from '../simulation/engine-state';

type LocCommand = Extract<
  GameCommand,
  { type: 'open_line_of_credit' | 'repay_line_of_credit' }
>;

export function handleLineOfCreditCommand(
  state: GameState,
  command: LocCommand,
): { state: GameState; outcome: Outcome } {
  return command.type === 'open_line_of_credit'
    ? openLineOfCredit(state, command)
    : repayLineOfCredit(state, command);
}

function openLineOfCredit(
  state: GameState,
  command: Extract<LocCommand, { type: 'open_line_of_credit' }>,
): { state: GameState; outcome: Outcome } {
  if (state.lineOfCredit.status !== 'available')
    return {
      state,
      outcome: rejected(
        'unavailable',
        'The Line of Credit is no longer available.',
      ),
    };
  const config = financialRules.lineOfCredit;
  if (state.balance < config.applicationPrice)
    return {
      state,
      outcome: rejected(
        'insufficient_funds',
        'The Line of Credit opening fee cannot be purchased on credit.',
      ),
    };
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'line_of_credit_opened',
    at: state.now,
    message: `Opened a $${config.cashAdvance.toLocaleString('en-US')} Line of Credit with ${config.repaymentUnitCount} repayment units.`,
    sourceActionId: command.commandId,
    amount: config.cashAdvance - config.applicationPrice,
  };
  const mutated: GameState = {
    ...state,
    balance: state.balance + config.cashAdvance - config.applicationPrice,
    lineOfCredit: {
      status: 'open',
      openedAt: state.now,
      remainingUnits: config.repaymentUnitCount,
      remainingClosureCost: config.totalClosureCost,
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  const next = finalizeFinancialOperation({
    before: state,
    state: mutated,
    triggerEventId: event.id,
    kind: 'loc_origination',
  });
  return {
    state: next,
    outcome: accepted('line_of_credit_opened', event.message, [event.id]),
  };
}

function repayLineOfCredit(
  state: GameState,
  command: Extract<LocCommand, { type: 'repay_line_of_credit' }>,
): { state: GameState; outcome: Outcome } {
  const loc = state.lineOfCredit;
  if (loc.status !== 'open')
    return {
      state,
      outcome: rejected('unavailable', 'There is no open Line of Credit.'),
    };
  const quantity = Math.floor(command.quantity);
  if (quantity < 1 || quantity > loc.remainingUnits)
    return {
      state,
      outcome: rejected(
        'quantity_cap',
        'That repayment quantity is unavailable.',
      ),
    };
  const price = quantity * financialRules.lineOfCredit.repaymentUnitPrice;
  if (state.balance < price)
    return {
      state,
      outcome: rejected(
        'insufficient_funds',
        'Line of Credit repayments cannot be purchased on credit.',
      ),
    };
  const remainingUnits = loc.remainingUnits - quantity;
  const remainingClosureCost = Math.max(0, loc.remainingClosureCost - price);
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'line_of_credit_repaid',
    at: state.now,
    message: `Purchased ${quantity} Line of Credit repayment unit${quantity === 1 ? '' : 's'} for $${price.toLocaleString('en-US')}.`,
    sourceActionId: command.commandId,
    amount: -price,
  };
  const mutated: GameState = {
    ...state,
    balance: state.balance - price,
    lineOfCredit:
      remainingUnits === 0
        ? {
            status: 'closed',
            openedAt: loc.openedAt,
            closedAt: state.now,
          }
        : { ...loc, remainingUnits, remainingClosureCost },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  const next = finalizeFinancialOperation({
    before: state,
    state: mutated,
    triggerEventId: event.id,
    kind: 'loc_repayment',
  });
  return {
    state: next,
    outcome: accepted('line_of_credit_repaid', event.message, [event.id]),
  };
}
