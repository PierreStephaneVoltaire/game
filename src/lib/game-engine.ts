import type { GameDefinition, ItemActionDefinition } from './game-definition';
import type { GameCommand, GameState, Outcome, Transition } from './game-types';
import {
  applyCriticalHealthMoodPenalty,
  appendStatusTransitionEvents,
  isCompanionAttempt,
  recordAttempt,
  recordDeathIfNeeded,
  rejected,
  remember,
} from './simulation/engine-state';
import { resolveAttemptEvent } from './event-rules';
import { handleRoomCommand } from './commands/room-commands';
import { handleShopCommand } from './commands/shop-commands';
import { handleActivityCommand } from './commands/activity-commands';
import { handleItemActionCommand } from './commands/item-action-commands';
import { resolveItemConsumption } from './commands/item-consumption';
import { reconcileTime } from './simulation/reconcile-time';
import { createRunState } from './simulation/run-state';
import { resetPlayerCareRescueLocks } from './autonomous-rescue-rules';
import { payMedicalDebtInFull } from './commands/medical-debt-commands';

export const startRun = createRunState;
export { reconcileTime };

export function dispatchCommand(
  state: GameState,
  command: GameCommand,
  definition: GameDefinition,
): Transition {
  const prior = state.processedCommands[command.commandId];
  if (prior)
    return {
      state,
      outcomes: [prior.outcome],
    };
  if (state.death)
    return rememberAndCompleteStreaming(
      state,
      command.commandId,
      rejected('dead', 'This run is over.'),
      definition,
    );

  const timed = reconcileTime(state, command.now, definition).state;
  if (timed.death)
    return rememberAndCompleteStreaming(
      timed,
      command.commandId,
      rejected('dead', 'This run is over.'),
      definition,
    );
  const companionAttempt = isCompanionAttempt(command.type);
  if (
    command.expectedStateVersion !== undefined &&
    command.expectedStateVersion !== timed.stateVersion
  ) {
    const staleOutcome = rejected(
      'stale',
      'This command was based on an older simulation state.',
    );
    let staleState = timed;
    if (companionAttempt) {
      staleState = resolveAttemptEvent(
        staleState,
        command.commandId,
        definition,
      );
      staleState = recordAttempt(
        staleState,
        staleOutcome,
        timed,
        command.commandId,
        command.type,
      );
    }
    return rememberAndCompleteStreaming(
      staleState,
      command.commandId,
      staleOutcome,
      definition,
    );
  }

  let consumptionAction: ItemActionDefinition | undefined;
  if (command.type === 'perform_item_action') {
    const itemActionResult = handleItemActionCommand(
      timed,
      command,
      definition,
    );
    if (itemActionResult.consumeAction) {
      consumptionAction = itemActionResult.consumeAction;
      command = { ...command, type: 'use_item' };
    } else {
      return rememberAndCompleteStreaming(
        recordDeathIfNeeded(itemActionResult.state),
        command.commandId,
        itemActionResult.outcome,
        definition,
      );
    }
  }
  let next = timed;
  let outcome: Outcome = rejected('invalid', 'Command was not understood.');
  let completionOwnsAttemptOpportunity = false;
  if (
    next.activity &&
    [
      'rest',
      'socialize',
      'play',
      'medical_care',
      'use_item',
      'perform_item_action',
    ].includes(command.type)
  )
    if (command.type === 'medical_care')
      return rememberAndCompleteStreaming(
        timed,
        command.commandId,
        rejected('activity_blocked', 'Companion is busy right now.'),
        definition,
      );
  if (
    next.activity &&
    [
      'rest',
      'socialize',
      'play',
      'medical_care',
      'use_item',
      'perform_item_action',
    ].includes(command.type)
  )
    return rememberAndCompleteStreaming(
      resolveAttemptEvent(next, command.commandId, definition),
      command.commandId,
      rejected('activity_blocked', 'Companion is busy right now.'),
      definition,
    );
  if (command.type === 'place_item' || command.type === 'unplace_item') {
    const roomResult = handleRoomCommand(next, command, definition);
    next = roomResult.state;
    outcome = roomResult.outcome;
  } else if (command.type === 'pay_medical_debt') {
    const payment = payMedicalDebtInFull(next, command.commandId);
    next = payment.state;
    outcome = payment.outcome;
  } else if (
    command.type === 'wait' ||
    command.type === 'rest' ||
    command.type === 'socialize' ||
    command.type === 'play' ||
    command.type === 'medical_care'
  ) {
    const activityResult = handleActivityCommand(
      next,
      command,
      definition,
      reconcileTime,
    );
    next = activityResult.state;
    outcome = activityResult.outcome;
    completionOwnsAttemptOpportunity =
      activityResult.completionOwnsAttemptOpportunity;
  } else if (
    command.type === 'set_cart_quantity' ||
    command.type === 'checkout_cart' ||
    command.type === 'buy_item'
  ) {
    const shopResult = handleShopCommand(next, command, definition);
    next = shopResult.state;
    outcome = shopResult.outcome;
  } else if (command.type === 'use_item') {
    const itemResult = resolveItemConsumption(next, command, definition, {
      automatic: false,
      action: consumptionAction,
    });
    next = itemResult.state;
    outcome = itemResult.outcome;
  }
  if (outcome.accepted) next = resetPlayerCareRescueLocks(timed, next);
  if (
    companionAttempt &&
    next.metrics.health > 0 &&
    !completionOwnsAttemptOpportunity
  ) {
    next = applyCriticalHealthMoodPenalty(next, timed, command.commandId);
    const beforeEvent = next;
    next = resolveAttemptEvent(next, command.commandId, definition);
    next = applyCriticalHealthMoodPenalty(next, beforeEvent, command.commandId);
  }
  if (companionAttempt)
    next = recordAttempt(next, outcome, timed, command.commandId, command.type);
  next = appendStatusTransitionEvents(next, timed.statuses, command.commandId);
  next = recordDeathIfNeeded(next);
  return rememberAndCompleteStreaming(
    next,
    command.commandId,
    outcome,
    definition,
  );
}

function rememberAndCompleteStreaming(
  state: GameState,
  commandId: string,
  outcome: Outcome,
  definition: GameDefinition,
): Transition {
  const transition = remember(state, commandId, outcome);
  let next = transition.state;
  while (next.mode === 'streaming' && next.activity && !next.death) {
    const before = next;
    next = reconcileTime(next, next.activity.endsAt, definition).state;
    if (next === before) break;
  }
  return { state: next, outcomes: transition.outcomes };
}
