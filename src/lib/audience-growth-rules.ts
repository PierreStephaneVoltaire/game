import rules from './data/simulation-rules.json';
import { HOUR_MS } from './game-constants';
import type { CareerTier, GameEvent, GameState } from './game-types';
import { applyFollowerMilestones } from './follower-rules';
import { CAREER_TIERS } from './progression-types';

const audienceRules = rules.progression.naturalAudience;
const clipperRules = rules.progression.clippers;

function tierRate(tier: CareerTier): number {
  return audienceRules.tierRates[tier];
}

function appendFollowers(
  state: GameState,
  at: number,
  amount: number,
  type: 'natural_audience_growth' | 'clipper_audience_growth',
  message: string,
): { state: GameState; eventIds: string[] } {
  if (amount <= 0) return { state, eventIds: [] };
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type,
    at,
    message,
    followerDelta: amount,
  };
  const events = [event];
  let next: GameState = {
    ...state,
    progression: {
      ...state.progression,
      followers: state.progression.followers + amount,
    },
    events: [...state.events, event],
  };
  next = applyFollowerMilestones(next, type, at, events);
  next = { ...next, events: [...state.events, ...events] };
  return { state: next, eventIds: events.map((item) => item.id) };
}

/** Register one real stream start and snapshot its career and Creativity. */
export function registerStreamStart(
  state: GameState,
  streamId: string,
): GameState {
  const expiresAt = state.now + audienceRules.streamBoostDays * 24 * HOUR_MS;
  return {
    ...state,
    progression: {
      ...state.progression,
      activeAudienceBoosts: [
        ...state.progression.activeAudienceBoosts.filter(
          (boost) => boost.expiresAt > state.now,
        ),
        {
          streamId,
          startedAt: state.now,
          expiresAt,
          careerTier: state.progression.careerTier,
          creativity: state.metrics.creativity,
        },
      ],
      streamStats: {
        ...state.progression.streamStats,
        started: state.progression.streamStats.started + 1,
      },
    },
  };
}

/** Record exact elapsed stream time and its terminal outcome. */
export function recordStreamEnd(
  state: GameState,
  elapsedMs: number,
  interrupted: boolean,
): GameState {
  return {
    ...state,
    progression: {
      ...state.progression,
      streamStats: {
        ...state.progression.streamStats,
        completed:
          state.progression.streamStats.completed + (interrupted ? 0 : 1),
        interrupted:
          state.progression.streamStats.interrupted + (interrupted ? 1 : 0),
        elapsedMs:
          state.progression.streamStats.elapsedMs + Math.max(0, elapsedMs),
      },
    },
  };
}

/** Activate one Clipper. An inactive effect pays immediately; renewal stacks it. */
export function activateClippers(state: GameState): {
  state: GameState;
  eventIds: string[];
} {
  const active =
    state.timedEffects.clippers &&
    state.timedEffects.clippers.expiresAt > state.now
      ? state.timedEffects.clippers
      : null;
  const timedEffects = {
    ...state.timedEffects,
    clippers: {
      stacks: (active?.stacks ?? 0) + 1,
      expiresAt: state.now + clipperRules.durationHours * HOUR_MS,
      nextClipAt:
        active?.nextClipAt ?? state.now + clipperRules.intervalHours * HOUR_MS,
    },
  };
  const next = { ...state, timedEffects };
  if (active) return { state: next, eventIds: [] };
  const amount = clipperFollowerAmount(next);
  return appendFollowers(
    next,
    state.now,
    amount,
    'clipper_audience_growth',
    `Clippers published fresh clips and gained ${amount} subscribers.`,
  );
}

/** Resolve the deterministic two-hour audience tick and any due daily clips. */
export function resolveAudienceGrowth(
  state: GameState,
  at: number,
): { state: GameState; eventIds: string[] } {
  let next = state;
  const eventIds: string[] = [];
  const naturalInterval = audienceRules.intervalHours * HOUR_MS;
  if ((at - state.history.runStartedAt) % naturalInterval === 0) {
    const activeBoosts = next.progression.activeAudienceBoosts.filter(
      (boost) => boost.expiresAt > at,
    );
    const amount = Math.round(
      tierRate(next.progression.careerTier) +
        activeBoosts.reduce(
          (sum, boost) =>
            sum +
            tierRate(boost.careerTier) *
              (1 + boost.creativity * audienceRules.creativityPerPoint),
          0,
        ),
    );
    next = {
      ...next,
      progression: { ...next.progression, activeAudienceBoosts: activeBoosts },
    };
    const growth = appendFollowers(
      next,
      at,
      amount,
      'natural_audience_growth',
      `Natural audience growth added ${amount} subscribers.`,
    );
    next = growth.state;
    eventIds.push(...growth.eventIds);
  }

  let clippers = next.timedEffects.clippers;
  while (
    clippers &&
    clippers.nextClipAt <= at &&
    clippers.nextClipAt < clippers.expiresAt
  ) {
    const clipAt = clippers.nextClipAt;
    const amount = clipperFollowerAmount(next);
    const growth = appendFollowers(
      next,
      clipAt,
      amount,
      'clipper_audience_growth',
      `Clippers published fresh clips and gained ${amount} subscribers.`,
    );
    next = growth.state;
    eventIds.push(...growth.eventIds);
    clippers = {
      ...clippers,
      nextClipAt: clipAt + clipperRules.intervalHours * HOUR_MS,
    };
    next = { ...next, timedEffects: { ...next.timedEffects, clippers } };
  }
  if (clippers && clippers.expiresAt <= at)
    next = { ...next, timedEffects: { ...next.timedEffects, clippers: null } };
  return { state: next, eventIds };
}

function clipperFollowerAmount(state: GameState): number {
  const tier = CAREER_TIERS.indexOf(state.progression.careerTier) + 1;
  return (
    clipperRules.followersPerTierPerStack *
    tier *
    (state.timedEffects.clippers?.stacks ?? 0)
  );
}
