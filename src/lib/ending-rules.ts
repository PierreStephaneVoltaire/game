import type {
  EndingRiskClock,
  EndingRiskClocks,
  GameEvent,
  GameState,
} from './game-types';
import rules from './data/simulation-rules.json';
import { HOUR_MS } from './game-constants';
import { recordDeath } from './simulation/death-resolution';
import {
  endingRiskRecoveryMessage,
  endingWarningMessage,
  runEndingMessage,
} from './ending-rules/messages';

const config = rules.endings.quitStreaming;

export function emptyEndingRiskClocks(): EndingRiskClocks {
  return {
    quit_streaming: {
      triggerStartedAt: null,
      warningStages: [],
      warningEventIds: [],
    },
  };
}

export function nextEndingBoundary(state: GameState): number | undefined {
  if (state.ending) return undefined;
  const clock = state.endingRisks.quit_streaming;
  if (clock.triggerStartedAt === null) return undefined;
  const boundaries = [
    clock.triggerStartedAt + config.durationHours * HOUR_MS,
    ...config.warningHours
      .filter((stage) => !clock.warningStages.includes(stage))
      .map((stage) => clock.triggerStartedAt! + stage * HOUR_MS),
  ].filter((boundary) => boundary > state.now);
  return boundaries.length ? Math.min(...boundaries) : undefined;
}

export function reconcileRunEnding(state: GameState): GameState {
  if (state.ending) return state;
  if (state.metrics.health <= 0) return recordDeath(state);
  const next = syncQuitStreamingRisk(state);
  const clock = next.endingRisks.quit_streaming;
  if (
    clock.triggerStartedAt !== null &&
    next.now >= clock.triggerStartedAt + config.durationHours * HOUR_MS
  )
    return recordQuitStreaming(next, clock);
  return next;
}

function syncQuitStreamingRisk(state: GameState): GameState {
  const active = state.metrics.mood === 0;
  const clock = state.endingRisks.quit_streaming;
  let next = state;
  if (active && clock.triggerStartedAt === null)
    next = {
      ...state,
      endingRisks: {
        quit_streaming: {
          triggerStartedAt: state.now,
          warningStages: [],
          warningEventIds: [],
        },
      },
    };
  else if (!active && clock.triggerStartedAt !== null) {
    const event: GameEvent = {
      id: `event-${state.events.length + 1}`,
      type: 'ending_risk_recovered',
      at: state.now,
      message: endingRiskRecoveryMessage('quit_streaming'),
      causedBy: clock.warningEventIds,
      endingKind: 'quit_streaming',
    };
    return {
      ...state,
      endingRisks: emptyEndingRiskClocks(),
      events: [...state.events, event],
      stateVersion: state.stateVersion + 1,
    };
  }
  const activeClock = next.endingRisks.quit_streaming;
  if (!active || activeClock.triggerStartedAt === null) return next;
  for (const stage of config.warningHours)
    if (
      !next.endingRisks.quit_streaming.warningStages.includes(stage) &&
      next.now >= activeClock.triggerStartedAt + stage * HOUR_MS
    )
      next = appendWarning(next, stage);
  return next;
}

function appendWarning(state: GameState, stage: number): GameState {
  const clock = state.endingRisks.quit_streaming;
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'ending_risk_warning',
    at: (clock.triggerStartedAt ?? state.now) + stage * HOUR_MS,
    message: endingWarningMessage('quit_streaming', stage),
    endingKind: 'quit_streaming',
    endingStage: stage,
  };
  return {
    ...state,
    endingRisks: {
      quit_streaming: {
        ...clock,
        warningStages: [...clock.warningStages, stage],
        warningEventIds: [...clock.warningEventIds, event.id],
      },
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
}

function recordQuitStreaming(
  state: GameState,
  clock: EndingRiskClock,
): GameState {
  if (clock.triggerStartedAt === null) return state;
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'run_ended',
    at: state.now,
    message: runEndingMessage('quit_streaming'),
    causedBy: clock.warningEventIds,
    endingKind: 'quit_streaming',
  };
  return {
    ...state,
    ending: {
      kind: 'quit_streaming',
      at: state.now,
      triggerStartedAt: clock.triggerStartedAt,
      durationHours: config.durationHours,
      endingMetricValue: state.metrics.mood,
      eventIds: [...clock.warningEventIds, event.id],
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
}
