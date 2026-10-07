import type {
  GameDefinition,
  ItemActionDefinition,
  ItemDefinition,
} from '../game-definition';
import type {
  CreatorVenture,
  GameCommand,
  GameEvent,
  GameState,
  Outcome,
} from '../game-types';
import { accepted, recordAttempt, rejected } from '../simulation/engine-state';
import { resolveAttemptEvent } from '../event-rules';
import { actionRandom } from '../seeded-rng';
import { nextLocalMidnight } from '../shop-rules';
import { simulationRules as rules } from '../runtime-definition';
import { clampMetric } from '../game-constants';
import { creditIncome } from '../income-rules';
import { finalizeFinancialOperation } from '../financial-rules';
import { settleFollowerChange } from '../follower-rules';
import { reconcileMetricSource } from '../status-rules/metric-source-reconciliation';
import { inventoryAfterConsumedUnit } from './inventory-mutations';

type ItemActionCommand = Extract<GameCommand, { type: 'perform_item_action' }>;
type ServiceResult = { state: GameState; outcome: Outcome };
type MerchRun = Extract<CreatorVenture, { type: 'merch_run' }>;
type ConventionTrip = Extract<
  CreatorVenture,
  { type: 'convention_appearance' }
>;

export function activeVentures(state: GameState): CreatorVenture[] {
  return state.ventures ?? [];
}

export function nextVentureBoundaries(state: GameState): number[] {
  return activeVentures(state).map(ventureBoundary);
}

export function startMerchRun(
  state: GameState,
  command: ItemActionCommand,
  item: ItemDefinition,
  action: ItemActionDefinition,
  definition: GameDefinition,
): ServiceResult {
  if (activeVentures(state).some((venture) => venture.type === 'merch_run'))
    return unavailable(
      state,
      command,
      definition,
      'A merch run is already in progress.',
    );
  const service = action.service;
  const range = service?.payoutMultiplier ?? { min: 1, max: 1 };
  const roll = (rollId: string) =>
    actionRandom(
      state.seed,
      state.stateVersion,
      command.commandId,
      'merch_run',
      rollId,
    );
  const flopped = roll('flop') < (service?.flopChance ?? 0);
  const flopMood = flopped ? rules.creatorServices.merchRun.flopMood : 0;
  const multiplier = flopped
    ? rules.creatorServices.merchRun.flopPayoutMultiplier
    : range.min + roll('multiplier') * (range.max - range.min);
  const venture: MerchRun = {
    id: ventureId(state, 'merch_run'),
    type: 'merch_run',
    itemId: item.id,
    startedAt: state.now,
    sourceActionId: command.commandId,
    flopped,
    totalPayout: Math.round(item.price * multiplier),
    paidOut: 0,
    payoutDays: Math.max(1, service?.payoutDays ?? 1),
    daysPaid: 0,
    nextPayoutAt: nextLocalMidnight(state.now, state.timezone),
  };
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: flopped ? 'merch_run_flopped' : 'merch_run_started',
    at: state.now,
    message: flopped
      ? `${action.label} started, but preorders came in weak.`
      : `${action.label} started.`,
    sourceActionId: command.commandId,
    itemName: item.name,
    amount: venture.totalPayout,
    metricDeltas: flopped ? { mood: flopMood } : undefined,
  };
  return acceptVenture(state, command, definition, action, venture, event, {
    metrics: {
      ...state.metrics,
      mood: clampMetric('mood', state.metrics.mood + flopMood),
    },
  });
}

export function startConventionAppearance(
  state: GameState,
  command: ItemActionCommand,
  item: ItemDefinition,
  action: ItemActionDefinition,
  definition: GameDefinition,
): ServiceResult {
  if (
    activeVentures(state).some(
      (venture) => venture.type === 'convention_appearance',
    )
  )
    return unavailable(
      state,
      command,
      definition,
      'A convention trip is already booked.',
    );
  const venture: ConventionTrip = {
    id: ventureId(state, 'convention_appearance'),
    type: 'convention_appearance',
    itemId: item.id,
    tier: action.service?.tier ?? 'low',
    startedAt: state.now,
    sourceActionId: command.commandId,
    completesAt: nextLocalMidnight(state.now, state.timezone),
  };
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'convention_trip_started',
    at: state.now,
    message: `${action.label} is booked.`,
    sourceActionId: command.commandId,
    itemName: item.name,
  };
  return acceptVenture(state, command, definition, action, venture, event);
}

export function settleDueVentures(state: GameState, now: number): GameState {
  let next = state;
  for (;;) {
    const due = activeVentures(next)
      .filter((venture) => ventureBoundary(venture) <= now)
      .sort((left, right) => ventureBoundary(left) - ventureBoundary(right))[0];
    if (!due) return next;
    next =
      due.type === 'merch_run'
        ? payMerchDay(next, due)
        : completeConvention(next, due);
  }
}

function ventureBoundary(venture: CreatorVenture): number {
  return venture.type === 'merch_run'
    ? venture.nextPayoutAt
    : venture.completesAt;
}

function payMerchDay(state: GameState, run: MerchRun): GameState {
  const at = run.nextPayoutAt;
  const daysPaid = run.daysPaid + 1;
  const cumulative = Math.floor((run.totalPayout * daysPaid) / run.payoutDays);
  const amount = cumulative - run.paidOut;
  const finished = daysPaid >= run.payoutDays;
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: finished ? 'merch_run_completed' : 'merch_run_payout',
    at,
    message: finished
      ? `The merch run wrapped up after earning $${cumulative} in total.`
      : `Merch sales brought in $${amount}.`,
    sourceActionId: run.sourceActionId,
    amount: finished ? cumulative : amount,
  };
  const remaining = activeVentures(state).filter(({ id }) => id !== run.id);
  const ventures = finished
    ? remaining
    : [
        ...remaining,
        {
          ...run,
          daysPaid,
          paidOut: cumulative,
          nextPayoutAt: nextLocalMidnight(at, state.timezone),
        },
      ];
  const mutated: GameState = {
    ...creditIncome(state, amount),
    ventures,
    events: [...state.events, event],
  };
  return finalizeFinancialOperation({
    before: state,
    state: mutated,
    triggerEventId: event.id,
    kind: 'merch_income',
  });
}

function completeConvention(state: GameState, trip: ConventionTrip): GameState {
  const tierRules = rules.creatorServices.convention.tiers[trip.tier];
  const completion = rules.creatorServices.convention.completion;
  const followers = Math.max(
    tierRules.minimumFollowers,
    Math.round(state.progression.peakFollowers * tierRules.peakFollowerShare),
  );
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'convention_completed',
    at: trip.completesAt,
    message: 'The convention appearance is over.',
    sourceActionId: trip.sourceActionId,
    metricDeltas: { mood: completion.mood, rest: completion.rest },
  };
  const afterTrip: GameState = {
    ...state,
    metrics: {
      ...state.metrics,
      mood: clampMetric('mood', state.metrics.mood + completion.mood),
      rest: clampMetric('rest', state.metrics.rest + completion.rest),
    },
    ventures: activeVentures(state).filter(({ id }) => id !== trip.id),
    events: [...state.events, event],
  };
  const grown = settleFollowerChange(afterTrip, {
    amount: followers,
    at: trip.completesAt,
    sourceActionId: trip.sourceActionId,
    eventType: 'convention_audience_growth',
    message: `The convention brought in ${followers} subscribers.`,
  }).state;
  return reconcileMetricSource(state, grown, trip.sourceActionId);
}

function ventureId(state: GameState, type: CreatorVenture['type']): string {
  return `${type}-${state.actionOrdinal + activeVentures(state).length + 1}`;
}

function acceptVenture(
  state: GameState,
  command: ItemActionCommand,
  definition: GameDefinition,
  action: ItemActionDefinition,
  venture: CreatorVenture,
  event: GameEvent,
  overrides: Partial<GameState> = {},
): ServiceResult {
  const next: GameState = {
    ...state,
    ...overrides,
    inventory:
      action.consumes === true
        ? inventoryAfterConsumedUnit(state.inventory, venture.itemId)
        : state.inventory,
    ventures: [...activeVentures(state), venture],
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  const outcome = accepted(event.type, event.message, [event.id]);
  return settleAttempt(state, next, command, definition, outcome);
}

function unavailable(
  state: GameState,
  command: ItemActionCommand,
  definition: GameDefinition,
  message: string,
): ServiceResult {
  const outcome = rejected('unavailable', message);
  return settleAttempt(state, state, command, definition, outcome);
}

function settleAttempt(
  before: GameState,
  next: GameState,
  command: ItemActionCommand,
  definition: GameDefinition,
  outcome: Outcome,
): ServiceResult {
  return {
    state: recordAttempt(
      resolveAttemptEvent(next, command.commandId, definition),
      outcome,
      before,
      command.commandId,
      command.type,
    ),
    outcome,
  };
}
