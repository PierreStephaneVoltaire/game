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
import { STAT_MAX, STAT_MIN } from '../game-constants';

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
    actionMetrics[name] = Math.max(
      STAT_MIN,
      Math.min(STAT_MAX, actionMetrics[name] + delta),
    );
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
  };
  let actionState: GameState = {
    ...state,
    metrics: actionMetrics,
    statuses: actionStatuses,
    inventory:
      itemAction.consumes === true
        ? {
            ...state.inventory,
            [item.id]: Math.max(0, (state.inventory[item.id] ?? 0) - 1),
          }
        : state.inventory,
    events: [...state.events, actionEvent],
    stateVersion: state.stateVersion + 1,
    actionOrdinal: state.actionOrdinal + 1,
  };
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
  const attempted = recordAttempt(
    resolveAttemptEvent(state, command.commandId, definition),
    outcome,
    state,
    command.commandId,
    command.type,
  );
  return { handled: true, state: attempted, outcome };
}
