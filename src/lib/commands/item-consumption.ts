import type { GameDefinition, ItemActionDefinition } from '../game-definition';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import rules from '../data/simulation-rules.json';
import { actionRandom } from '../seeded-rng';
import { accepted, recordBondGain, rejected } from '../simulation/engine-state';
import { resolveNutritionConsumption } from './nutrition-resolution';
import { HOUR_MS } from '../game-constants';
import { sugarCrashDelayHours } from '../status-rules';
import { healthDamageSource } from '../simulation/health-resolution';
import { itemDiscoveryEvents } from './item-consumption-events';
import {
  actionOwnership,
  itemActionAvailable,
} from '../item-action-prerequisites';

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
  const refused =
    disliked &&
    actionRandom(
      state.seed,
      state.stateVersion,
      command.commandId,
      'item_refusal',
      'attempt',
    ) < (item.context?.refusalProbability ?? 0);
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
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'item_used',
    at: state.now,
    message: `${item.name} was used.`,
    sourceActionId: command.commandId,
    metricDeltas: nutrition.itemMetricDeltas,
    nutritionProfileId: nutrition.nutritionProfileId,
    tags: action.tags,
    cause: action.id,
    itemName: item.name,
    actionLabel: action.label,
    healthDamageSources:
      (nutrition.itemMetricDeltas.health ?? 0) < 0
        ? [
            healthDamageSource(
              'item',
              item.id,
              item.name,
              nutrition.itemMetricDeltas.health ?? 0,
            ),
          ]
        : undefined,
  };
  const discoveries = itemDiscoveryEvents({
    state,
    event,
    item,
    nutrition,
    sourceActionId: command.commandId,
  });
  const ruleEvents: GameEvent[] = [];
  if (nutrition.fullFeedSuppressed)
    ruleEvents.push({
      id: `event-${state.events.length + discoveries.length + ruleEvents.length + 2}`,
      type: 'full_feed_suppressed',
      at: state.now,
      message: nutrition.sickFeedingHarm
        ? `${item.name} did not increase Food because the companion was sick.`
        : `${item.name} did not increase Food because the companion was full.`,
      sourceActionId: command.commandId,
      causedBy: [event.id],
      status: 'full',
      metricDeltas: { food: 0 },
    });
  if (nutrition.sickFromFull)
    ruleEvents.push({
      id: `event-${state.events.length + discoveries.length + ruleEvents.length + 2}`,
      type: 'sickness_onset',
      at: state.now,
      message: `${item.name} caused sickness from overfeeding.`,
      sourceActionId: command.commandId,
      causedBy: [event.id],
      status: 'sick',
      metricDeltas: nutrition.sickFeedingDeltas,
      healthDamageSources: [
        healthDamageSource(
          'status',
          'sick',
          'Sickness',
          nutrition.sickFeedingDeltas.health ?? 0,
          [event.id],
        ),
      ],
    });
  if (nutrition.sickFeedingHarm)
    ruleEvents.push({
      id: `event-${state.events.length + discoveries.length + ruleEvents.length + 2}`,
      type: 'sick_feeding_harm',
      at: state.now,
      message: `${item.name} harmed the sick companion.`,
      sourceActionId: command.commandId,
      causedBy: [event.id],
      status: 'sick',
      metricDeltas: nutrition.sickFeedingDeltas,
      healthDamageSources: [
        healthDamageSource(
          'status',
          'sick',
          'Sickness',
          nutrition.sickFeedingDeltas.health ?? 0,
          [event.id],
        ),
      ],
    });
  if (nutrition.kidneyStone)
    ruleEvents.push({
      id: `event-${state.events.length + discoveries.length + ruleEvents.length + 2}`,
      type: 'kidney_stone_onset',
      at: state.now,
      message: `${item.name} triggered kidney stone symptoms.`,
      sourceActionId: command.commandId,
      causedBy: [event.id],
      status: 'kidney_stone',
      metricDeltas: nutrition.kidneyStoneDeltas,
      healthDamageSources: [
        healthDamageSource(
          'status',
          'kidney_stone',
          'Kidney stone complications',
          nutrition.kidneyStoneDeltas.health ?? 0,
          [event.id],
        ),
      ],
    });
  const cravingEvent = nutrition.fulfilledCraving
    ? {
        id: `event-${state.events.length + discoveries.length + ruleEvents.length + 2}`,
        type: 'craving_fulfilled' as const,
        at: state.now,
        message: `${item.name} fulfilled the craving.`,
        sourceActionId: command.commandId,
        cause: item.id,
        metricDeltas: { bond: 1 },
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
  const next: GameState = {
    ...state,
    metrics: nutrition.metrics,
    inventory: {
      ...state.inventory,
      [item.id]: action.consumes === true ? owned - 1 : owned,
    },
    statuses,
    history: {
      ...state.history,
      consumptions: nutrition.consumptions,
      cravingItemId: nutrition.fulfilledCraving
        ? null
        : state.history.cravingItemId,
      sugarCrashDueAt:
        nutrition.sugarServings.length >= rules.sugarCrash.servingsRequired &&
        state.history.sugarCrashDueAt === null
          ? state.now + sugarCrashDelayHours() * HOUR_MS
          : state.history.sugarCrashDueAt,
    },
    events: [
      ...state.events,
      event,
      ...discoveries,
      ...ruleEvents,
      ...(cravingEvent ? [cravingEvent] : []),
    ],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  return {
    state: recordBondGain(next, state),
    outcome: accepted('item_used', event.message, [
      event.id,
      ...discoveries.map((item) => item.id),
      ...ruleEvents.map((item) => item.id),
      ...(cravingEvent ? [cravingEvent.id] : []),
    ]),
  };
}
