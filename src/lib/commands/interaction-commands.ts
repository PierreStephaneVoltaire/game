import type { GameDefinition } from '../game-definition';
import type { GameState, Outcome } from '../game-types';
import type { InteractionCooldowns } from '../game-history-types';
import {
  chooseActivityOutcome,
  chooseDuration,
  refusalProbability,
} from '../activity-rules';
import { actionRandom } from '../seeded-rng';
import { accepted, rejected } from '../simulation/engine-state';
import { criticalMetrics } from '../simulation/health-resolution';
import { completeActivity } from '../simulation/activity-completion';

export type InteractionType = keyof InteractionCooldowns;

export function interactionAvailableAt(
  state: GameState,
  type: InteractionType,
): number | null {
  const until = state.history.interactionCooldowns?.[type] ?? null;
  return until !== null && state.now < until ? until : null;
}

export function resolveInteraction(
  state: GameState,
  command: { type: InteractionType; commandId: string },
  definition: GameDefinition,
): { state: GameState; outcome: Outcome } {
  if (
    actionRandom(
      state.seed,
      state.stateVersion,
      command.commandId,
      'refusal',
      'attempt',
    ) < refusalProbability(state)
  )
    return {
      state,
      outcome: rejected('refused', 'Companion refused that interaction.'),
    };
  const duration = chooseDuration(command.type, state, command.commandId);
  const activityOutcome = chooseActivityOutcome(
    command.type,
    state,
    command.commandId,
  );
  const { history } = state;
  const completion = completeActivity({
    state: {
      ...state,
      history: {
        ...history,
        repeatAction: command.type,
        repeatCount:
          history.repeatAction === command.type ? history.repeatCount + 1 : 1,
      },
    },
    activity: {
      id: `activity-${state.actionOrdinal + 1}`,
      type: command.type,
      startedAt: state.now,
      endsAt: state.now,
      sourceActionId: command.commandId,
      payload: {
        activityOutcome,
        startingRest: state.metrics.rest,
        startingMood: state.metrics.mood,
        startingCriticalMetrics: criticalMetrics(state.metrics).join(','),
      },
    },
    reconciliationNow: state.now,
    definition,
  });
  const completed = completion.state;
  return {
    state: {
      ...completed,
      actionOrdinal: completed.actionOrdinal + 1,
      history: {
        ...completed.history,
        repeatAction: history.repeatAction,
        repeatCount: history.repeatCount,
        interactionCooldowns: {
          socialize: null,
          play: null,
          ...history.interactionCooldowns,
          [command.type]: state.now + duration,
        },
      },
    },
    outcome: accepted(
      'activity_completed',
      completed.events.find((event) => event.id === completion.eventIds[0])
        ?.message ?? '',
      completion.eventIds,
    ),
  };
}
