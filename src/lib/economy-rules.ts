import rules from './data/simulation-rules.json';
import { weightedDonation } from './donation-rules';
import { applyFollowerMilestones, followerGain } from './follower-rules';
import { HOUR_MS } from './game-constants';
import type { GameEvent, GameState } from './game-types';
import { localDate } from './shop-rules';

export { applyFollowerMilestones, streamRateFor } from './follower-rules';

type StreamResult = { state: GameState; events: GameEvent[] };

/** Resolve stream income, followers, donations, and career milestones together. */
export function completeStreamEconomy(
  state: GameState,
  sourceActionId: string,
  elapsedHours: number,
  completedAt: number,
  hourlyRate: number,
  donationMultiplier = 1,
  normallyCompleted = true,
): StreamResult {
  const wholeHours = Math.max(0, Math.floor(elapsedHours));
  const startedAt = completedAt - elapsedHours * HOUR_MS;
  const followers = normallyCompleted
    ? followerGain(state, completedAt - elapsedHours * HOUR_MS, elapsedHours)
    : 0;
  const income = Math.round(
    hourlyRate *
      elapsedHours *
      (rules.stream.income.baseMultiplier +
        state.metrics.creativity / rules.stream.income.creativityDivisor),
  );
  const donations = Array.from({ length: wholeHours }, (_, hourIndex) => {
    const at = startedAt + (hourIndex + 1) * HOUR_MS;
    const dateParts = localDate(at - 1, state.timezone)
      .slice(5)
      .split('-')
      .map(Number);
    const special = rules.specialDates.find(
      (item) => item.month === dateParts[0] && item.day === dateParts[1],
    );
    return {
      hourIndex,
      at,
      donation: weightedDonation(
        state,
        sourceActionId,
        hourIndex,
        (special?.donationChanceMultiplier ?? 1) * donationMultiplier,
      ),
    };
  }).filter(
    (
      result,
    ): result is typeof result & {
      donation: NonNullable<typeof result.donation>;
    } => Boolean(result.donation),
  );
  const donationFollowers = donations.reduce(
    (sum, result) => sum + result.donation.followers,
    0,
  );
  let next: GameState = {
    ...state,
    balance: state.balance + income,
    progression: {
      ...state.progression,
      followers: state.progression.followers + followers + donationFollowers,
    },
  };
  const events: GameEvent[] = [];
  for (const { at, donation } of donations) {
    const event: GameEvent = {
      id: `event-${state.events.length + events.length + 1}`,
      type: 'donation_received',
      at,
      message: `A ${donation.tier.replaceAll('_', ' ')} donated $${donation.amount}.`,
      sourceActionId,
      donationTier: donation.tier,
      amount: donation.amount,
      followerDelta: donation.followers,
    };
    next = { ...next, balance: next.balance + donation.amount };
    events.push(event);
  }
  if (followers + donationFollowers > 0)
    events.push({
      id: `event-${state.events.length + events.length + 1}`,
      type: 'followers_gained',
      at: completedAt,
      message: `The channel gained ${followers + donationFollowers} followers.`,
      sourceActionId,
      followerDelta: followers + donationFollowers,
    });
  next = applyFollowerMilestones(next, sourceActionId, completedAt, events);
  return { state: next, events };
}

export function resolveCommissionWorkPayout(state: GameState): number {
  const work = rules.activities.commissionWork;
  return work.basePayout + state.metrics.creativity * work.creativityPayout;
}
