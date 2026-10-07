import { recordStreamEnd } from '../audience-growth-rules';
import { completeStreamEconomy } from '../economy-rules';
import { HOUR_MS, MINUTE_MS, STAT_MAX, STAT_MIN } from '../game-constants';
import type { Activity, GameEvent, GameState, Metrics } from '../game-types';
import { simulationRules as rules } from '../runtime-definition';
import { actionRandom } from '../seeded-rng';

/** Settle one stream end and record the evidence used by drought protection. */
export function settleStreamCompletion(input: {
  state: GameState;
  activity: Activity;
  completedAt: number;
  elapsedMs: number;
  interrupted: boolean;
  streamMetrics: Metrics;
  completionEventId: string;
}): GameState {
  const {
    activity,
    completedAt,
    elapsedMs,
    interrupted,
    streamMetrics,
    completionEventId,
  } = input;
  let next = recordStreamEnd(input.state, elapsedMs, interrupted);
  const economy = completeStreamEconomy(
    { ...next, metrics: streamMetrics },
    activity.sourceActionId,
    elapsedMs / HOUR_MS,
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
          next.metrics.mood + (economy.state.metrics.mood - streamMetrics.mood),
        ),
      ),
    },
    progression: economy.state.progression,
    events: [...next.events, ...economy.events],
  };
  const ordinaryStream = Boolean(activity.payload?.ordinaryStream);
  const midnightCapped = Boolean(activity.payload?.midnightCapped);
  const droughtResetQualified =
    ordinaryStream && !interrupted && !midnightCapped && elapsedMs >= MINUTE_MS;
  next = rollLostVoice(next, activity, completedAt, elapsedMs);
  if (droughtResetQualified)
    next = {
      ...next,
      progression: {
        ...next.progression,
        lastQualifyingOrdinaryStreamStartedAt: activity.startedAt,
      },
    };
  return {
    ...next,
    events: next.events.map((event) =>
      event.id === completionEventId
        ? {
            ...event,
            ordinaryStream,
            queuedStreamType:
              activity.payload?.queuedStreamType === 'tournament' ||
              activity.payload?.queuedStreamType === 'model_debut'
                ? activity.payload.queuedStreamType
                : undefined,
            intendedDurationMs: Number(
              activity.payload?.intendedDurationMs ?? elapsedMs,
            ),
            actualDurationMs: elapsedMs,
            midnightCapped,
            interrupted,
            droughtResetQualified,
            droughtResetAnchorAt: droughtResetQualified
              ? activity.startedAt
              : undefined,
          }
        : event,
    ),
  };
}

function rollLostVoice(
  state: GameState,
  activity: Activity,
  completedAt: number,
  elapsedMs: number,
): GameState {
  const lostVoice = rules.lostVoice;
  if (
    state.statuses.lost_voice ||
    elapsedMs <= lostVoice.minimumStreamHours * HOUR_MS ||
    actionRandom(
      state.seed,
      state.stateVersion,
      activity.sourceActionId,
      'lost_voice',
      'onset',
    ) >= lostVoice.probability
  )
    return state;
  const { min, max } = lostVoice.naturalPassHours;
  const passHours =
    min +
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        activity.sourceActionId,
        'lost_voice',
        'natural_pass',
      ) *
        (max - min + 1),
    );
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'lost_voice_onset',
    at: completedAt,
    message: "The long stream took the companion's voice with it.",
    sourceActionId: activity.sourceActionId,
    status: 'lost_voice',
  };
  return {
    ...state,
    statuses: {
      ...state.statuses,
      lost_voice: {
        since: completedAt,
        source: 'long_stream',
        naturalPassAt: completedAt + passHours * HOUR_MS,
        causalEventIds: [event.id],
      },
    },
    events: [...state.events, event],
  };
}
