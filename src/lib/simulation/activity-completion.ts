import type { Activity, GameEvent, GameState, Metrics } from '../game-types';
import type { GameDefinition } from '../game-definition';
import rules from '../data/simulation-rules.json';
import activityRules from '../data/activity-rules.json';
import { actionRandom } from '../seeded-rng';
import { activityPrimaryMetric, completionDelta } from '../activity-rules';
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
import { clampMetric, HOUR_MS, STAT_MAX, STAT_MIN } from '../game-constants';
import {
  completeStreamEconomy,
  resolveCommissionWorkPayout,
} from '../economy-rules';
import { reconcileMetricSource } from '../status-rules/metric-source-reconciliation';
import { localDate } from '../shop-rules';
import { creditIncome } from '../income-rules';
import { recordStreamEnd } from '../audience-growth-rules';
import { resetPlayerCareRescueLocks } from '../autonomous-rescue-rules';
import { completeMedicalCare } from './medical-care-completion';
import {
  appendCommissionPayoutEvent,
  settleActivityFinances,
} from './activity-financial-settlement';
import { activityCompletionNarration } from './activity-completion-message';

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
  const delta: Partial<Metrics> = (
    activity.type === 'medical_care'
      ? rules.medicalCare.completion
      : interrupted && activity.type !== 'rest'
        ? {}
        : activity.type === 'stream'
          ? {
              creativity: rules.stream.completion.creativity,
              rest: rules.stream.completion.rest,
              mood: Number(
                rules.stream.completion.mood[
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
              ),
            }
          : activity.type === 'commission_work'
            ? {
                rest: activityRules.commissionWork.completion.rest,
                creativity: activityRules.commissionWork.completion.creativity,
                mood: activityRules.commissionWork.completion.mood[
                  Math.floor(
                    actionRandom(
                      state.seed,
                      state.stateVersion,
                      activity.sourceActionId,
                      'commission_completion',
                      'mood',
                    ) * activityRules.commissionWork.completion.mood.length,
                  )
                ],
              }
            : completionDelta(
                activity.type as 'rest' | 'socialize' | 'play',
                elapsed,
                state.metrics.rest,
                activity.payload?.activityOutcome === 'strong'
                  ? 'strong'
                  : 'normal',
              )
  ) as Partial<Metrics>;
  if (
    (activity.type === 'socialize' || activity.type === 'play') &&
    state.history.repeatAction === activity.type &&
    state.history.repeatCount > 1
  )
    delta[activityPrimaryMetric(activity.type)] = 0;
  if (activity.payload?.suppressMoodGain) delete delta.mood;
  const beforeActivityMetrics = { ...state.metrics };
  const completedMetrics = { ...state.metrics };
  for (const [name, value] of Object.entries(delta)) {
    const metric = name as keyof typeof completedMetrics;
    completedMetrics[metric] = clampMetric(
      metric,
      completedMetrics[metric] + (value ?? 0),
    );
  }
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: interrupted ? 'activity_interrupted' : 'activity_completed',
    at: completedAt,
    message: activityCompletionNarration(state, activity, interrupted),
    sourceActionId: activity.sourceActionId,
    metricDeltas: delta,
    activityType: activity.type,
    activityNarration:
      typeof activity.payload?.activityNarration === 'string'
        ? activity.payload.activityNarration
        : undefined,
    activityOutcome:
      activity.type === 'socialize' || activity.type === 'play'
        ? activity.payload?.activityOutcome === 'strong'
          ? 'strong'
          : 'normal'
        : undefined,
  };
  const activityOverstimulated = triggersOverstimulation(
    Number(activity.payload?.startingMood ?? beforeActivityMetrics.mood),
    delta.mood ?? 0,
  );
  if (activityOverstimulated) {
    delta.mood = overstimulationMoodDelta();
    completedMetrics.mood = Math.max(
      STAT_MIN,
      Math.min(STAT_MAX, beforeActivityMetrics.mood + delta.mood),
    );
  }
  if (
    state.timedEffects.hyperfocusUntil !== null &&
    completedAt < state.timedEffects.hyperfocusUntil
  ) {
    delta.creativity = 10 - beforeActivityMetrics.creativity;
    completedMetrics.creativity = 10;
  }
  const beforeActivityStatuses = state.statuses;
  let statuses = {
    ...alignGameStatuses(completedMetrics, state.statuses, reconciliationNow),
  };
  if (activityOverstimulated) {
    statuses = applyOverstimulation(
      {
        ...completedMetrics,
        mood: Number(
          activity.payload?.startingMood ?? beforeActivityMetrics.mood,
        ),
      },
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
  const commissionPayout =
    activity.type === 'commission_work' && !interrupted
      ? resolveCommissionWorkPayout({
          ...state,
          metrics: {
            ...state.metrics,
            creativity: Number(
              activity.payload?.startingCreativity ?? state.metrics.creativity,
            ),
          },
        })
      : 0;
  let next: GameState = {
    ...creditIncome(state, commissionPayout),
    metrics: completedMetrics,
    statuses,
    activity: null,
    history:
      activity.type === 'commission_work' && !interrupted
        ? {
            ...state.history,
            lastCommissionWorkDate: localDate(completedAt, state.timezone),
          }
        : state.history,
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
  if (activity.type === 'medical_care' && !interrupted)
    next = completeMedicalCare(next, activity, completedAt);
  if (activity.type === 'stream') {
    next = recordStreamEnd(next, elapsed, interrupted);
    const economy = completeStreamEconomy(
      { ...next, metrics: state.metrics },
      activity.sourceActionId,
      elapsed / HOUR_MS,
      completedAt,
      Number(activity.payload?.hourlyRate ?? rules.stream.income.minimumRate),
      Number(activity.payload?.donationMultiplier ?? 1),
    );
    next = {
      ...next,
      balance: economy.state.balance,
      metrics: {
        ...next.metrics,
        mood: Math.max(
          STAT_MIN,
          Math.min(
            STAT_MAX,
            next.metrics.mood +
              (economy.state.metrics.mood - state.metrics.mood),
          ),
        ),
      },
      progression: economy.state.progression,
      events: [...next.events, ...economy.events],
    };
  }
  if (activity.type === 'commission_work' && !interrupted)
    next = appendCommissionPayoutEvent(
      next,
      activity,
      completedAt,
      commissionPayout,
    );
  next = reconcileMetricSource(state, next, activity.sourceActionId);
  if (!activity.payload?.autonomous)
    next = resetPlayerCareRescueLocks(state, next);
  next = recordBondGain(next, state, completedAt);
  next = appendStatusTransitionEvents(
    next,
    beforeActivityStatuses,
    activity.sourceActionId,
  );
  const financial = settleActivityFinances({
    before: state,
    state: next,
    activity,
    completionEvent: event,
  });
  next = financial.state;
  const eventIds = financial.eventIds;
  if (activity.type !== 'medical_care' && activity.type !== 'commission_work') {
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
      activity.type === 'play' ||
      activity.type === 'commission_work')
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
