import financialRules from '../data/financial-rules.json';
import { finalizeFinancialOperation } from '../financial-rules';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import { localDate } from '../shop-rules';
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
      outcome: rejected('unavailable', 'The Line of Credit is no longer available.'),
    };
  const config = financialRules.lineOfCredit;
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
      lastOpenChargeDate: localDate(state.now, state.timezone),
      remainingUnits: config.repaymentUnitCount,
      remainingClosureCost: config.totalClosureCost,
      cumulativeOpenCharges: 0,
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
      outcome: rejected('quantity_cap', 'That repayment quantity is unavailable.'),
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
  const remainingClosureCost = Math.max(
    0,
    loc.remainingClosureCost - price,
  );
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
            cumulativeOpenCharges: loc.cumulativeOpenCharges,
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

export function processLineOfCreditOpenCharge(
  state: GameState,
  at: number,
): { state: GameState; eventIds: string[] } {
  const loc = state.lineOfCredit;
  if (loc.status !== 'open' || at <= loc.openedAt)
    return { state, eventIds: [] };
  const date = localDate(at, state.timezone);
  if (date === loc.lastOpenChargeDate) return { state, eventIds: [] };
  const amount = financialRules.lineOfCredit.dailyOpenCharge;
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'loc_open_charge',
    at,
    message: `The open Line of Credit charged $${amount.toLocaleString('en-US')}.`,
    amount: -amount,
  };
  const mutated: GameState = {
    ...state,
    balance: state.balance - amount,
    lineOfCredit: {
      ...loc,
      lastOpenChargeDate: date,
      cumulativeOpenCharges: loc.cumulativeOpenCharges + amount,
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
  const next = finalizeFinancialOperation({
    before: state,
    state: mutated,
    triggerEventId: event.id,
    kind: 'loc_open_charge',
  });
  return {
    state: next,
    eventIds: next.events.slice(state.events.length).map((item) => item.id),
  };
}
