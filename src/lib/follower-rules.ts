import rules from './data/simulation-rules.json';
import endingRules from './data/ending-rules.json';
import { madeItUnlockedMessage } from './ending-rules/messages';
import { creditIncome } from './income-rules';
import { STAT_MAX } from './game-constants';
import type { CareerTier, GameEvent, GameState } from './game-types';
import { finalizeFinancialOperation } from './financial-rules';
import { stateTextContext } from './seeded-text';

const progressionRules = rules.progression as {
  milestones: Array<{
    id: CareerTier;
    followers: number;
    streamRate?: [number, number];
    mood?: number;
    unlockModelTier?: 1 | 2 | 3 | 4;
    appearanceFee?: number;
    subscriberRevenueMultiplier?: number;
  }>;
};

type FollowerChange = {
  amount: number;
  at: number;
  sourceActionId: string;
  eventType: string;
  message: string;
};

export function subscriberRevenueMultiplier(state: GameState): number {
  const progressionFollowers = Math.max(
    state.progression.followers,
    state.progression.peakFollowers,
  );
  return (
    progressionRules.milestones
      .filter(
        (milestone) =>
          milestone.subscriberRevenueMultiplier &&
          progressionFollowers >= milestone.followers,
      )
      .at(-1)?.subscriberRevenueMultiplier ?? 1
  );
}

export function applyFollowerMilestones(
  state: GameState,
  sourceActionId: string,
  at: number,
  events: GameEvent[],
): GameState {
  let progression = {
    ...state.progression,
    peakFollowers: Math.max(
      state.progression.peakFollowers,
      state.progression.followers,
    ),
  };
  let metrics = state.metrics;
  for (const milestone of progressionRules.milestones) {
    if (
      progression.peakFollowers < milestone.followers ||
      progression.awardedMilestones.includes(milestone.id)
    )
      continue;
    progression = {
      ...progression,
      careerTier: milestone.id,
      awardedMilestones: [...progression.awardedMilestones, milestone.id],
      unlockedModelTiers: milestone.unlockModelTier
        ? [
            ...new Set([
              ...progression.unlockedModelTiers,
              milestone.unlockModelTier,
            ]),
          ]
        : progression.unlockedModelTiers,
    };
    if (milestone.mood)
      metrics = {
        ...metrics,
        mood: Math.min(STAT_MAX, metrics.mood + milestone.mood),
      };
    if (milestone.appearanceFee)
      state = creditIncome(state, milestone.appearanceFee);
    if (
      milestone.id === 'tournament_appearance' &&
      !progression.queuedEventStreams.some(
        (stream) => stream.type === 'tournament',
      )
    )
      progression.queuedEventStreams = [
        ...progression.queuedEventStreams,
        {
          id: `tournament-${at}`,
          type: 'tournament',
          queuedAt: at,
          durationHours: rules.projects.tournamentHours,
          donationMultiplier: rules.stream.donations.tournamentMultiplier,
        },
      ];
    events.push({
      id: `event-${state.events.length + events.length + 1}`,
      type: 'career_milestone',
      at,
      message: `${milestone.id.replaceAll('_', ' ')} milestone reached.`,
      sourceActionId,
      cause: milestone.id,
      followerDelta: milestone.followers,
      revenueMultiplier: milestone.subscriberRevenueMultiplier,
    });
  }
  const existingUnlock = state.endingUnlocks.made_it;
  if (
    !existingUnlock &&
    progression.followers >= endingRules.madeIt.followers
  ) {
    const triggerEventId = events[0]?.id ?? sourceActionId;
    const event: GameEvent = {
      id: `event-${state.events.length + events.length + 1}`,
      type: 'ending_unlocked',
      at,
      message: madeItUnlockedMessage(
        endingRules.madeIt.followers,
        stateTextContext(state, sourceActionId),
      ),
      sourceActionId,
      endingKind: 'made_it',
      causedBy: events[0] ? [events[0].id] : undefined,
    };
    events.push(event);
    return {
      ...state,
      metrics,
      progression,
      endingUnlocks: {
        ...state.endingUnlocks,
        made_it: {
          kind: 'made_it',
          at,
          followers: progression.followers,
          peakFollowers: progression.peakFollowers,
          triggerEventId,
          eventIds: [triggerEventId, event.id],
        },
      },
    };
  }
  return { ...state, metrics, progression };
}

/** Apply one signed audience change and preserve its complete causal record. */
export function settleFollowerChange(
  state: GameState,
  change: FollowerChange,
): { state: GameState; eventIds: string[] } {
  const followers = Math.max(0, state.progression.followers + change.amount);
  const applied = followers - state.progression.followers;
  if (!applied) return { state, eventIds: [] };
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: change.eventType,
    at: change.at,
    message: change.message,
    sourceActionId: change.sourceActionId,
    followerDelta: applied,
  };
  const events = [event];
  let next: GameState = {
    ...state,
    progression: { ...state.progression, followers },
    events: [...state.events, event],
  };
  next = applyFollowerMilestones(
    next,
    change.sourceActionId,
    change.at,
    events,
  );
  next = { ...next, events: [...state.events, ...events] };
  if (next.balance !== state.balance)
    next = finalizeFinancialOperation({
      before: state,
      state: next,
      triggerEventId: event.id,
      kind: 'career_milestone_income',
    });
  return {
    state: next,
    eventIds: next.events.slice(state.events.length).map(({ id }) => id),
  };
}

export function streamRateFor(state: GameState): [number, number] {
  const progressionFollowers = Math.max(
    state.progression.followers,
    state.progression.peakFollowers,
  );
  const rate = progressionRules.milestones
    .filter(
      (milestone) =>
        milestone.streamRate && progressionFollowers >= milestone.followers,
    )
    .at(-1)?.streamRate;
  return (
    rate ?? [
      rules.stream.income.minimumRate,
      rules.stream.income.minimumRate + rules.stream.income.rateSlots - 1,
    ]
  );
}
