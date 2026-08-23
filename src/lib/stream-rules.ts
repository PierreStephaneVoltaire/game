import { actionRandom } from './seeded-rng';
import type { GameEvent, GameState } from './game-types';
import { nextLocalMidnight } from './shop-rules';
import rules from './data/simulation-rules.json';
import { HOUR_MS } from './game-constants';
import { criticalMetrics } from './simulation/health-resolution';

export function streamWeight(state: GameState, commandId: string): number {
  if (
    state.activity ||
    rules.stream.blockers.some(
      (status) => state.statuses[status as keyof GameState['statuses']],
    )
  )
    return 0;
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
      (part) => hourOfDay >= part.fromHour && hourOfDay <= part.toHour,
    )?.multiplier ?? 1;
  const roll = actionRandom(
    state.seed,
    state.stateVersion,
    commandId,
    'autonomous_event',
    'stream',
  );
  return Math.max(
    0,
    (rules.stream.weight.base * roll +
      rules.stream.weight.moodCoefficient *
        ((state.metrics.mood - rules.stream.weight.metricCenter) /
          rules.stream.weight.metricScale) +
      rules.stream.weight.creativityCoefficient *
        ((state.metrics.creativity - rules.stream.weight.metricCenter) /
          rules.stream.weight.metricScale)) *
      multiplier,
  );
}

/** Starts a stream after the event pool selected the autonomous candidate. */
export function startAutonomousStream(
  state: GameState,
  commandId: string,
): GameState {
  if (streamWeight(state, commandId) <= 0) return state;
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
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'stream_candidate',
    at: state.now,
    message:
      hours <= 0
        ? 'Companion is too tired to stream.'
        : 'Companion started streaming.',
    activityType: 'stream',
  };
  if (hours <= 0)
    return {
      ...state,
      events: [...state.events, event],
      stateVersion: state.stateVersion + 1,
    };
  const rate =
    rules.stream.income.minimumRate +
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        commandId,
        'stream_income',
        'hourly_rate',
      ) * rules.stream.income.rateSlots,
    );
  return {
    ...state,
    activity: {
      id: `activity-${state.actionOrdinal + 1}`,
      type: 'stream',
      startedAt: state.now,
      endsAt: state.now + hours * HOUR_MS,
      sourceActionId: commandId,
      payload: {
        hourlyRate: rate,
        startingCriticalMetrics: criticalMetrics(state.metrics).join(','),
      },
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
}

function hoursUntilLocalMidnight(state: GameState): number {
  return (nextLocalMidnight(state.now, state.timezone) - state.now) / HOUR_MS;
}
