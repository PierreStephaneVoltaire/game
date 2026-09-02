import type { GameDefinition, ItemActionDefinition } from '../game-definition';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import rules from '../data/simulation-rules.json';
import { actionRandom } from '../seeded-rng';
import { accepted, recordBondGain, rejected } from '../simulation/engine-state';
import { resolveNutritionConsumption } from './nutrition-resolution';
import { itemConsumptionEvents } from './item-consumption-events';
import { consumptionRuleEvents } from './consumption-rule-events';
import {
  actionOwnership,
  itemActionAvailable,
} from '../item-action-prerequisites';
import { resolveTimedEffectsAfterConsumption } from './consumption-timed-effects';
import { reconcileMetricSource } from '../status-rules/metric-source-reconciliation';
import { createItemUsedEvent } from './item-used-event';

type UseItemCommand = Extract<GameCommand, { type: 'use_item' }>;

export type ItemConsumptionResult = {
  state: GameState;
  outcome: Outcome;
};

export function resolveItemConsumption(
  state: GameState,
  command: UseItemCommand,
  definition: GameDefinition,
  context: { automatic: boolean; action?: ItemActionDefinition },
): ItemConsumptionResult {
  const item = definition.items.find(
    (candidate) => candidate.id === command.itemId,
  );
  const owned = item ? (state.inventory[item.id] ?? 0) : 0;
  const action =
    context.action ??
    item?.itemActions?.find((candidate) => candidate.kind === 'consume');
  if (!item || !item.usable || owned < 1)
    return {
      state,
      outcome: rejected('unavailable', 'That item is not available.'),
    };
  const isHyperfocusItem = item.tags.includes('hyperfocus');
  if (
    isHyperfocusItem &&
    state.timedEffects.hyperfocusUntil !== null &&
    state.timedEffects.hyperfocusUntil > state.now
  )
    return {
      state,
      outcome: rejected('unavailable', 'Hyperfocus is already active.'),
    };
  if (item.tags.includes('pain-relief') || item.tags.includes('pain_relief')) {
    if (!state.statuses.kidney_stone)
      return {
        state,
        outcome: rejected('unavailable', 'Pain Relief is not needed.'),
      };
    if (
      state.timedEffects.painReliefUntil !== null &&
      state.timedEffects.painReliefUntil > state.now
    )
      return {
        state,
        outcome: rejected('unavailable', 'Pain Relief is already active.'),
      };
  }
  if (!action)
    return {
      state,
      outcome: rejected(
        'unavailable',
        'Use this item from its authored item action.',
      ),
    };
  if (
    !itemActionAvailable(
      item.id,
      action,
      actionOwnership(state.inventory, state.room, definition.items),
    )
  )
    return {
      state,
      outcome: rejected(
        'unavailable',
        'The companion lacks the required item.',
      ),
    };

  const preparationRejected =
    item.edible &&
    item.preferences?.includes('specific_preparation') &&
    actionRandom(
      state.seed,
      state.stateVersion,
      command.commandId,
      'item_preparation',
      'acceptable',
    ) >= (item.context?.preparationAcceptance ?? 1);
  const disliked =
    item.edible &&
    (item.preferences?.includes('disliked') || preparationRejected);
  const refusalProbability = item.edible
    ? Math.min(
        1,
        (disliked ? (item.context?.refusalProbability ?? 0) : 0) +
          (state.statuses.sick ? rules.sick.refusalProbabilityBonus : 0),
      )
    : 0;
  const refused =
    item.edible &&
    actionRandom(
      state.seed,
      state.stateVersion,
      command.commandId,
      'item_refusal',
      'attempt',
    ) < refusalProbability;
  if (refused) {
    const wasted =
      actionRandom(
        state.seed,
        state.stateVersion,
        command.commandId,
        'item_refusal',
        'waste',
      ) < rules.itemRefusalWasteProbability;
    const event: GameEvent = {
      id: `event-${state.events.length + 1}`,
      type: 'item_refused',
      at: state.now,
      message: wasted
        ? `${item.name} was refused and wasted.`
        : `${item.name} was refused.`,
      sourceActionId: command.commandId,
      itemName: item.name,
    };
    const next: GameState = {
      ...state,
      inventory: {
        ...state.inventory,
        [item.id]: wasted && item.consumable !== false ? owned - 1 : owned,
      },
      events: [...state.events, event],
      history: context.automatic
        ? state.history
        : { ...state.history, lastCareAttemptAt: state.now },
      stateVersion: state.stateVersion + 1,
      actionOrdinal: state.actionOrdinal + 1,
    };
    return { state: next, outcome: rejected('refused', event.message) };
  }

  const nutrition = resolveNutritionConsumption(state, command, item, action);
  const event = createItemUsedEvent({
    state,
    item,
    action,
    sourceActionId: command.commandId,
    itemMetricDeltas: nutrition.itemMetricDeltas,
    nutritionProfileId: nutrition.nutritionProfileId,
    automatic: context.automatic,
  });
  const consumptionEvents = itemConsumptionEvents({
    state,
    event,
    item,
    nutrition,
    sourceActionId: command.commandId,
  });
  const ruleEvents = consumptionRuleEvents({
    state,
    item,
    nutrition,
    sourceActionId: command.commandId,
    precedingEventCount: consumptionEvents.length,
    event,
  });
  const cravingEvent = nutrition.fulfilledCraving
    ? {
        id: `event-${state.events.length + consumptionEvents.length + ruleEvents.length + 2}`,
        type: 'craving_fulfilled' as const,
        at: state.now,
        message: `${item.name} fulfilled the craving.`,
        sourceActionId: command.commandId,
        cause: item.id,
        metricDeltas: { bond: 1 },
      }
    : undefined;
  const sugarEvent: GameEvent | undefined = nutrition.sugarCrashTransition
    ? {
        id: `event-${state.events.length + consumptionEvents.length + ruleEvents.length + (cravingEvent ? 3 : 2)}`,
        type:
          nutrition.sugarCrashTransition === 'scheduled'
            ? 'sugar_crash_warning'
            : 'sugar_crash_averted',
        at: state.now,
        message:
          nutrition.sugarCrashTransition === 'scheduled'
            ? 'That is a lot of sugar in a short period. A sugar crash may be coming.'
            : 'The rolling nutrition balance improved and the sugar crash was averted.',
        sourceActionId: command.commandId,
        status: 'sugar_crash',
      }
    : undefined;
  const kidneyOnsetEvent = ruleEvents.find(
    (ruleEvent) => ruleEvent.type === 'kidney_stone_onset',
  );
  const statuses = kidneyOnsetEvent
    ? {
        ...nutrition.statuses,
        kidney_stone: {
          ...nutrition.statuses.kidney_stone!,
          causalEventIds: [kidneyOnsetEvent.id],
        },
      }
    : nutrition.statuses;
  const timedEffects = resolveTimedEffectsAfterConsumption(
    state,
    item,
    nutrition,
    command.now,
  );
  const hyperfocusActive =
    timedEffects.hyperfocusUntil !== null &&
    command.now < timedEffects.hyperfocusUntil;
  if (hyperfocusActive) {
    nutrition.metrics.creativity = 10;
    event.metricDeltas = {
      ...event.metricDeltas,
      creativity: 10 - state.metrics.creativity,
    };
  }
  const next: GameState = {
    ...state,
    metrics: {
      ...nutrition.metrics,
      ...(hyperfocusActive ? { creativity: 10 } : {}),
    },
    inventory: {
      ...state.inventory,
      [item.id]: action.consumes === true ? owned - 1 : owned,
    },
    statuses,
    history: {
      ...state.history,
      consumptions: nutrition.consumptions,
      kidneyStoneFeeds: nutrition.kidneyStoneFeeds,
      cravingItemId: nutrition.fulfilledCraving
        ? null
        : state.history.cravingItemId,
      cravingStartedAt: nutrition.fulfilledCraving
        ? null
        : state.history.cravingStartedAt,
      cravingRefreshCount: nutrition.fulfilledCraving
        ? 0
        : state.history.cravingRefreshCount,
      sugarCrashDueAt: nutrition.sugarCrashDueAt,
    },
    timedEffects,
    events: [
      ...state.events,
      event,
      ...consumptionEvents,
      ...ruleEvents,
      ...(cravingEvent ? [cravingEvent] : []),
      ...(sugarEvent ? [sugarEvent] : []),
    ],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return {
    state: recordBondGain(
      reconcileMetricSource(state, next, command.commandId),
      state,
    ),
    outcome: accepted('item_used', event.message, [
      event.id,
      ...consumptionEvents.map((item) => item.id),
      ...ruleEvents.map((item) => item.id),
      ...(sugarEvent ? [sugarEvent.id] : []),
      ...(cravingEvent ? [cravingEvent.id] : []),
    ]),
  };
}
