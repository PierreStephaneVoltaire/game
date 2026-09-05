import { actionRandom } from './seeded-rng';
import type { GameEvent, GameState, StatusName } from './game-types';
import { localDate, nextLocalMidnight } from './shop-rules';
import { simulationRules as rules } from './runtime-definition';
import { HOUR_MS } from './game-constants';
import { criticalMetrics } from './simulation/health-resolution';
import { streamRateFor } from './economy-rules';
import { registerStreamStart } from './audience-growth-rules';

export type StreamWeightDiagnostics = {
  streamEligible: boolean;
  streamBlockers: StatusName[];
  streamBlockedByActivity: boolean;
  streamRawWeight: number;
  streamFinalWeight: number;
  streamDroughtHours: number;
  streamFlatBonus: number;
  streamDroughtBonus: number;
  streamPostRecoveryMultiplier: number;
};

export function streamWeightDiagnostics(
  state: GameState,
  commandId: string,
): StreamWeightDiagnostics {
  const streamBlockers = rules.stream.blockers.filter(
    (status: string) => state.statuses[status as StatusName],
  ) as StatusName[];
  const streamBlockedByActivity = Boolean(state.activity);
  const droughtHours = Math.max(
    0,
    (state.now - state.progression.lastQualifyingOrdinaryStreamStartedAt) /
      HOUR_MS,
  );
  const droughtBonus = Math.min(
    rules.stream.weight.drought.maximumBonus,
    Math.max(0, droughtHours - rules.stream.weight.drought.graceHours) *
      rules.stream.weight.drought.weightPerHour,
  );
  const shared = {
    streamBlockers,
    streamBlockedByActivity,
    streamDroughtHours: droughtHours,
    streamFlatBonus: rules.stream.weight.flatBonus,
    streamDroughtBonus: droughtBonus,
    streamPostRecoveryMultiplier: 1,
  };
  if (streamBlockedByActivity || streamBlockers.length)
    return {
      ...shared,
      streamEligible: false,
      streamRawWeight: 0,
      streamFinalWeight: 0,
    };
  if (state.progression.queuedEventStreams.length) {
    const hour = Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: state.timezone,
        hour: '2-digit',
        hour12: false,
      })
        .formatToParts(new Date(state.now))
        .find((part) => part.type === 'hour')?.value ?? 0,
    );
    const weight = hour >= 13 && hour < 19 ? 1_000_000 : 0;
    return {
      ...shared,
      streamEligible: weight > 0,
      streamRawWeight: weight,
      streamFinalWeight: weight,
    };
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: state.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(state.now));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const hourOfDay = hour;
  const multiplier =
    rules.stream.dayparts.find(
      (part: { fromHour: number; toHour: number; multiplier: number }) =>
        hourOfDay >= part.fromHour && hourOfDay <= part.toHour,
    )?.multiplier ?? 1;
  const [month, day] = localDate(state.now, state.timezone)
    .slice(5)
    .split('-')
    .map(Number);
  const specialDate = rules.specialDates.find(
    (special: { month: number; day: number; streamWeightMultiplier?: number }) =>
      special.month === month && special.day === day,
  );
  const nutritionCutoff =
    state.now - rules.nutrition.rollingWindowHours * HOUR_MS;
  const recent = state.history.consumptions.filter(
    (consumption) => consumption.at >= nutritionCutoff,
  );
  const salt = recent.reduce(
    (total, consumption) => total + consumption.salt,
    0,
  );
  const water = recent.reduce(
    (total, consumption) => total + consumption.water,
    0,
  );
  const managedNutrition = salt >= 5 && water >= 4;
  const roll = actionRandom(
    state.seed,
    state.stateVersion,
    commandId,
    'autonomous_event',
    'stream',
  );
  const rawWeight =
    rules.stream.weight.base * roll +
    rules.stream.weight.flatBonus +
    rules.stream.weight.moodCoefficient *
      ((state.metrics.mood - rules.stream.weight.metricCenter) /
        rules.stream.weight.metricScale) +
    rules.stream.weight.creativityCoefficient *
      ((state.metrics.creativity - rules.stream.weight.metricCenter) /
        rules.stream.weight.metricScale) +
    (managedNutrition ? rules.stream.weight.managedNutritionBonus : 0) +
    droughtBonus;
  return {
    ...shared,
    streamEligible: true,
    streamRawWeight: rawWeight,
    streamFinalWeight:
      Math.max(0, rawWeight) *
      multiplier *
      (specialDate?.streamWeightMultiplier ?? 1),
  };
}

export function streamWeight(state: GameState, commandId: string): number {
  return streamWeightDiagnostics(state, commandId).streamFinalWeight;
}

/** Starts a stream after the event pool selected the autonomous candidate. */
export function startAutonomousStream(
  state: GameState,
  commandId: string,
): GameState {
  const queued = state.progression.queuedEventStreams[0];
  if (streamWeight(state, commandId) <= 0) return state;
  if (queued) return startQueuedStream(state, commandId, queued);
  const durationRoll = actionRandom(
    state.seed,
    state.stateVersion,
    commandId,
    'stream_duration',
    'base',
  );
  const base =
    durationRoll < rules.stream.duration.shortCutoff
      ? rules.stream.duration.shortBase +
        Math.floor(durationRoll / rules.stream.duration.shortStep)
      : rules.stream.duration.longBase +
        Math.floor(
          (durationRoll - rules.stream.duration.shortCutoff) /
            ((1 - rules.stream.duration.shortCutoff) /
              rules.stream.duration.longSlots),
        );
  const intendedHours =
    Math.min(rules.stream.duration.maximumHours, base) -
    (rules.stream.restCost.maximumRest - state.metrics.rest);
  const hours = Math.min(intendedHours, hoursUntilLocalMidnight(state));
  const intendedDurationMs = intendedHours * HOUR_MS;
  const midnightCapped = hours > 0 && hours < intendedHours;
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'stream_candidate',
    at: state.now,
    message:
      hours <= 0
        ? 'Companion is too tired to stream.'
        : 'Companion started streaming.',
    activityType: 'stream',
    ordinaryStream: true,
    streamActivityStarted: hours > 0,
    intendedDurationMs,
    actualDurationMs: Math.max(0, hours) * HOUR_MS,
    midnightCapped,
  };
  if (hours <= 0)
    return {
      ...state,
      events: [...state.events, event],
      stateVersion: state.stateVersion + 1,
    };
  const rateRange = streamRateFor(state);
  const rate =
    rateRange[0] +
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        commandId,
        'stream_income',
        'hourly_rate',
      ) *
        (rateRange[1] - rateRange[0] + 1),
    );
  return registerStreamStart(
    {
      ...state,
      activity: {
        id: `activity-${state.actionOrdinal + 1}`,
        type: 'stream',
        startedAt: state.now,
        endsAt: state.now + hours * HOUR_MS,
        sourceActionId: commandId,
        payload: {
          ordinaryStream: true,
          intendedDurationMs,
          midnightCapped,
          hourlyRate: rate,
          startingCriticalMetrics: criticalMetrics(state.metrics).join(','),
        },
      },
      events: [...state.events, event],
      stateVersion: state.stateVersion + 1,
    },
    `activity-${state.actionOrdinal + 1}`,
  );
}

function startQueuedStream(
  state: GameState,
  commandId: string,
  queued: GameState['progression']['queuedEventStreams'][number],
): GameState {
  const hours = Math.min(queued.durationHours, hoursUntilLocalMidnight(state));
  const intendedDurationMs = queued.durationHours * HOUR_MS;
  const midnightCapped = hours > 0 && hours < queued.durationHours;
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type:
      queued.type === 'tournament' ? 'tournament_stream' : 'model_debut_stream',
    at: state.now,
    message:
      queued.type === 'tournament'
        ? 'Tournament stream started.'
        : 'Model debut stream started.',
    sourceActionId: commandId,
    activityType: 'stream',
    queuedStreamType: queued.type,
    streamActivityStarted: hours > 0,
    intendedDurationMs,
    actualDurationMs: Math.max(0, hours) * HOUR_MS,
    midnightCapped,
  };
  const remaining = state.progression.queuedEventStreams.slice(1);
  if (hours <= 0)
    return {
      ...state,
      progression: { ...state.progression, queuedEventStreams: remaining },
      events: [...state.events, event],
      stateVersion: state.stateVersion + 1,
    };
  const rateRange = streamRateFor(state);
  const rate =
    rateRange[0] +
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        commandId,
        'queued_stream_income',
        queued.id,
      ) *
        (rateRange[1] - rateRange[0] + 1),
    );
  return registerStreamStart(
    {
      ...state,
      progression: { ...state.progression, queuedEventStreams: remaining },
      activity: {
        id: `activity-${state.actionOrdinal + 1}`,
        type: 'stream',
        startedAt: state.now,
        endsAt: state.now + hours * HOUR_MS,
        sourceActionId: commandId,
        payload: {
          ordinaryStream: false,
          intendedDurationMs,
          midnightCapped,
          hourlyRate: rate,
          donationMultiplier: queued.donationMultiplier,
          queuedStreamType: queued.type,
          startingCriticalMetrics: criticalMetrics(state.metrics).join(','),
        },
      },
      events: [...state.events, event],
      stateVersion: state.stateVersion + 1,
    },
    `activity-${state.actionOrdinal + 1}`,
  );
}

function hoursUntilLocalMidnight(state: GameState): number {
  return (nextLocalMidnight(state.now, state.timezone) - state.now) / HOUR_MS;
}
