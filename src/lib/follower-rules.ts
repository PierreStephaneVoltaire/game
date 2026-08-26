import rules from './data/simulation-rules.json';
import { creditIncome } from './income-rules';
import { STAT_MAX } from './game-constants';
import type { CareerTier, GameEvent, GameState } from './game-types';

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

export function subscriberRevenueMultiplier(state: GameState): number {
  return (
    progressionRules.milestones
      .filter(
        (milestone) =>
          milestone.subscriberRevenueMultiplier &&
          state.progression.followers >= milestone.followers,
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
  let progression = { ...state.progression };
  let metrics = state.metrics;
  for (const milestone of progressionRules.milestones) {
    if (
      progression.followers < milestone.followers ||
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
  return { ...state, metrics, progression };
}

export function streamRateFor(state: GameState): [number, number] {
  const rate = progressionRules.milestones
    .filter(
      (milestone) =>
        milestone.streamRate &&
        state.progression.followers >= milestone.followers,
    )
    .at(-1)?.streamRate;
  return (
    rate ?? [
      rules.stream.income.minimumRate,
      rules.stream.income.minimumRate + rules.stream.income.rateSlots - 1,
    ]
  );
}
