import type { GameDefinition, ItemActionDefinition } from '../game-definition';
import type { GameCommand, GameEvent, GameState, Outcome } from '../game-types';
import {
  accepted,
  applyCriticalHealthMoodPenalty,
  appendStatusTransitionEvents,
  recordBondGain,
  recordAttempt,
  rejected,
} from '../simulation/engine-state';
import {
  actionOwnership,
  itemActionAvailable,
} from '../item-action-prerequisites';
import { actionRandom, resolveRange } from '../seeded-rng';
import {
  alignGameStatuses,
  applyOverstimulation,
  clearActionStatuses,
  overstimulationMoodDelta,
  triggersOverstimulation,
} from '../status-rules';
import { resolveAttemptEvent } from '../event-rules';
import { clampMetric, HOUR_MS, STAT_MAX, STAT_MIN } from '../game-constants';
import { healthDamageSource } from '../simulation/health-resolution';
import rules from '../data/simulation-rules.json';
import {
  actionRequirementFailure,
  startCommissionWork,
  startModelCommission,
  startFullBodyCommission,
} from './progression-actions';
import { reconcileMetricSource } from '../status-rules/metric-source-reconciliation';
import { selectItemNarration } from './item-consumption-events';
import { performClipperAction } from './clipper-action';
import { inventoryAfterConsumedUnit } from './inventory-mutations';

export type ItemActionCommandResult = {
  handled: boolean;
  state: GameState;
  outcome: Outcome;
  consumeAction?: ItemActionDefinition;
};

export function handleItemActionCommand(
  state: GameState,
  command: Extract<GameCommand, { type: 'perform_item_action' }>,
  definition: GameDefinition,
): ItemActionCommandResult {
  const item = definition.items.find(
    (candidate) => candidate.id === command.itemId,
  );
  const itemAction = item?.itemActions?.find(
    (candidate) => candidate.id === command.action,
  );
  if (!item || !itemAction)
    return unavailable(
      state,
      command,
      definition,
      'That item action is not available.',
    );
  const targetOwned =
    (state.inventory[item.id] ?? 0) > 0 ||
    Object.values(state.room).includes(item.id);
  if (!targetOwned)
    return unavailable(state, command, definition, 'That item is not owned.');
  if (itemAction.kind === 'consume')
    return {
      handled: true,
      state,
      outcome: rejected('delegated', ''),
      consumeAction: itemAction,
    };

  const ownership = actionOwnership(
    state.inventory,
    state.room,
    definition.items,
  );
  if (!itemActionAvailable(item.id, itemAction, ownership))
    return unavailable(
      state,
      command,
      definition,
      'The companion does not have the required item for that action.',
    );
  const requirementFailure = actionRequirementFailure(state, itemAction);
  if (requirementFailure)
    return unavailable(state, command, definition, requirementFailure);
  if (
    itemAction.kind === 'activity' &&
    itemAction.activity?.type === 'commission_work'
  )
    return {
      handled: true,
      ...startCommissionWork(state, command, item, itemAction, definition),
    };
  if (
    itemAction.kind === 'service' &&
    itemAction.service?.type === 'model_commission'
  )
    return {
      handled: true,
      ...startModelCommission(state, command, item, itemAction, definition),
    };
  if (
    itemAction.kind === 'service' &&
    itemAction.service?.type === 'full_body_commission'
  )
    return {
      handled: true,
      ...startFullBodyCommission(state, command, item, itemAction, definition),
    };
  if (itemAction.progressionEffect?.type === 'activate_clippers') {
    const result = performClipperAction(state, command, item, itemAction);
    return {
      handled: true,
      ...result,
    };
  }

  const actionDeltas: Partial<GameState['metrics']> = {};
  const actionMetrics = { ...state.metrics };
  for (const [metric, range] of Object.entries(itemAction.effects ?? {})) {
    const name = metric as keyof GameState['metrics'];
    const delta = resolveRange(
      range,
      actionRandom(
        state.seed,
        state.stateVersion,
        command.commandId,
        'item_action_effect',
        `${itemAction.id}:${name}`,
      ),
    );
    actionDeltas[name] = delta;
    actionMetrics[name] = clampMetric(name, actionMetrics[name] + delta);
  }
  const actionOverstimulated = triggersOverstimulation(
    state.metrics.mood,
    actionDeltas.mood ?? 0,
  );
  if (actionOverstimulated) {
    actionDeltas.mood = overstimulationMoodDelta();
    actionMetrics.mood = Math.max(
      STAT_MIN,
      Math.min(STAT_MAX, state.metrics.mood + actionDeltas.mood),
    );
  }
  let actionStatuses = alignGameStatuses(
    actionMetrics,
    state.statuses,
    state.now,
  );
  actionStatuses = clearActionStatuses(
    actionStatuses,
    actionMetrics,
    itemAction.clearsStatuses,
    itemAction.tags,
  );
  if (actionOverstimulated)
    actionStatuses = applyOverstimulation(
      actionMetrics,
      actionStatuses,
      'high_mood_item_action',
      state.now,
      true,
      false,
    ).statuses;
  if (
    state.timedEffects.hyperfocusUntil !== null &&
    state.now < state.timedEffects.hyperfocusUntil
  ) {
    actionDeltas.creativity = 10 - state.metrics.creativity;
    actionMetrics.creativity = 10;
  }

  const actionEvent: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'item_used',
    at: state.now,
    message: `${itemAction.label} performed.`,
    sourceActionId: command.commandId,
    metricDeltas: actionDeltas,
    status: itemAction.clearsStatuses?.[0],
    tags: itemAction.tags,
    cause: itemAction.id,
    itemName: item.name,
    itemNarration: selectItemNarration({
      state,
      item,
      action: itemAction,
      sourceActionId: command.commandId,
    }),
    actionLabel: itemAction.label,
    healthDamageSources:
      (actionDeltas.health ?? 0) < 0
        ? [
            healthDamageSource(
              'item',
              item.id,
              item.name,
              actionDeltas.health ?? 0,
            ),
          ]
        : undefined,
  };
  let actionState: GameState = {
    ...state,
    metrics: actionMetrics,
    statuses: actionStatuses,
    inventory:
      itemAction.consumes === true
        ? inventoryAfterConsumedUnit(state.inventory, item.id)
        : state.inventory,
    events: [...state.events, actionEvent],
    timedEffects:
      item.tags.includes('pain-relief') || item.tags.includes('pain_relief')
        ? {
            ...state.timedEffects,
            painReliefUntil:
              state.now + rules.kidneyStone.painReliefHours * HOUR_MS,
          }
        : state.timedEffects,
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
  actionState = reconcileMetricSource(state, actionState, command.commandId);
  actionState = recordBondGain(actionState, state);
  const actionOutcome = accepted('item_action_performed', actionEvent.message, [
    actionEvent.id,
  ]);
  let actionResult = actionState;
  if (actionState.metrics.health > 0) {
    actionResult = applyCriticalHealthMoodPenalty(
      actionResult,
      state,
      command.commandId,
    );
    const beforeEvent = actionResult;
    actionResult = resolveAttemptEvent(
      actionResult,
      command.commandId,
      definition,
    );
    actionResult = applyCriticalHealthMoodPenalty(
      actionResult,
      beforeEvent,
      command.commandId,
    );
  }
  actionResult = recordAttempt(
    actionResult,
    actionOutcome,
    state,
    command.commandId,
    command.type,
  );
  actionResult = appendStatusTransitionEvents(
    actionResult,
    state.statuses,
    command.commandId,
  );
  return { handled: true, state: actionResult, outcome: actionOutcome };
}

function unavailable(
  state: GameState,
  command: Extract<GameCommand, { type: 'perform_item_action' }>,
  definition: GameDefinition,
  message: string,
): ItemActionCommandResult {
  const outcome = rejected('unavailable', message);
  return { handled: true, state, outcome };
}
