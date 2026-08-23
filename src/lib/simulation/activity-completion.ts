import type { Activity, GameEvent, GameState, Metrics } from '../game-types';
import type { GameDefinition } from '../game-definition';
import rules from '../data/simulation-rules.json';
import { actionRandom } from '../seeded-rng';
import { completionDelta } from '../activity-rules';
import { alignGameStatuses, triggersOverstimulation } from '../status-rules';
import {
  applyCriticalHealthMoodPenalty,
  appendStatusTransitionEvents,
  recordBondGain,
} from './engine-state';
import {
  applyOverstimulation,
  clearRestStatuses,
  overstimulationMoodDelta,
} from '../status-rules';
import { resolveAttemptEvent } from '../event-rules';
import { HOUR_MS } from '../game-constants';
import { STAT_MAX, STAT_MIN } from '../game-constants';
import { activityCompletionMessage } from '../event-messages';

export type ActivityCompletionInput = {
  state: GameState;
  activity: Activity;
  reconciliationNow: number;
  definition: GameDefinition;
  interrupted?: boolean;
};

export type ActivityCompletionResult = {
  state: GameState;
  eventIds: string[];
};

export function completeActivity({
  state,
  activity,
  reconciliationNow,
  definition,
  interrupted = false,
}: ActivityCompletionInput): ActivityCompletionResult {
  const completedAt = interrupted ? reconciliationNow : activity.endsAt;
  const elapsed = Math.max(0, completedAt - activity.startedAt);
  const delta: Partial<Metrics> =
    activity.type === 'medical_care'
      ? rules.medicalCare.completion
      : interrupted && activity.type !== 'rest'
        ? {}
        : activity.type === 'stream'
          ? {
              creativity: rules.stream.completion.creativity,
              rest: rules.stream.completion.rest,
              mood: rules.stream.completion.mood[
                Math.floor(
                  actionRandom(
                    state.seed,
                    state.stateVersion,
                    activity.sourceActionId,
                    'stream_completion',
                    'mood',
                  ) * rules.stream.completion.mood.length,
                )
              ],
            }
          : completionDelta(
              activity.type as 'rest' | 'socialize' | 'play',
              elapsed,
              state.metrics.rest,
            );
  if (activity.payload?.suppressMoodGain) delete delta.mood;
  const beforeActivityMetrics = { ...state.metrics };
  const completedMetrics = { ...state.metrics };
  for (const [name, value] of Object.entries(delta)) {
    const metric = name as keyof typeof completedMetrics;
    completedMetrics[metric] = Math.max(
      STAT_MIN,
      Math.min(STAT_MAX, completedMetrics[metric] + (value ?? 0)),
    );
  }
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: interrupted ? 'activity_interrupted' : 'activity_completed',
    at: completedAt,
    message: interrupted
      ? `${activityCompletionMessage(activity.type).replace(/ finished\.$/, '')} ended early.`
      : activityCompletionMessage(activity.type),
    sourceActionId: activity.sourceActionId,
    metricDeltas: delta,
    activityType: activity.type,
  };
  const activityOverstimulated = triggersOverstimulation(
    beforeActivityMetrics.mood,
    delta.mood ?? 0,
  );
  if (activityOverstimulated) {
    delta.mood = overstimulationMoodDelta();
    completedMetrics.mood = Math.max(
      STAT_MIN,
      Math.min(STAT_MAX, beforeActivityMetrics.mood + delta.mood),
    );
  }
  const beforeActivityStatuses = state.statuses;
  let statuses = {
    ...alignGameStatuses(completedMetrics, state.statuses, reconciliationNow),
  };
  if (activityOverstimulated) {
    statuses = applyOverstimulation(
      completedMetrics,
      statuses,
      'high_mood_activity',
      activity.endsAt,
      true,
      false,
    ).statuses;
  }
  if (activity.type === 'medical_care') {
    delete statuses.kidney_stone;
    delete statuses.sick;
  }
  if (activity.type === 'rest')
    statuses = clearRestStatuses(statuses, completedMetrics);
  const income =
    activity.type === 'stream'
      ? Math.round(
          Number(
            activity.payload?.hourlyRate ?? rules.stream.income.minimumRate,
          ) *
            (elapsed / HOUR_MS) *
            (rules.stream.income.baseMultiplier +
              state.metrics.creativity / rules.stream.income.creativityDivisor),
        )
      : 0;
  let next: GameState = {
    ...state,
    metrics: completedMetrics,
    statuses,
    activity: null,
    balance: state.balance + income,
    history: state.history,
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
  next = recordBondGain(next, state, completedAt);
  next = appendStatusTransitionEvents(
    next,
    beforeActivityStatuses,
    activity.sourceActionId,
  );
  const eventIds = [event.id];
  if (activity.type !== 'medical_care') {
    const beforePenaltyCount = next.events.length;
    next = applyCriticalHealthMoodPenalty(
      next,
      { ...next, metrics: beforeActivityMetrics },
      activity.sourceActionId,
    );
    eventIds.push(
      ...next.events.slice(beforePenaltyCount).map((item) => item.id),
    );
  }
  if (
    !interrupted &&
    (activity.type === 'rest' ||
      activity.type === 'socialize' ||
      activity.type === 'play')
  ) {
    const beforeEventCount = next.events.length;
    const beforeEventState = next;
    next = resolveAttemptEvent(next, activity.sourceActionId, definition);
    next = applyCriticalHealthMoodPenalty(
      next,
      beforeEventState,
      activity.sourceActionId,
    );
    eventIds.push(
      ...next.events.slice(beforeEventCount).map((item) => item.id),
    );
  }
  return { state: next, eventIds };
}
