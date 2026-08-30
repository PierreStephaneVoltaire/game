import rules from './data/simulation-rules.json';
import { finalizeFinancialOperation } from './financial-rules';
import { subscriberRevenueMultiplier } from './follower-rules';
import { HOUR_MS } from './game-constants';
import type { GameEvent, GameState } from './game-types';
import { creditIncome } from './income-rules';

export function processSubscriberRevenue(
  state: GameState,
  at: number,
): { state: GameState; eventIds: string[] } {
  const interval = rules.progression.subscriberRevenue.intervalHours * HOUR_MS;
  if ((at - state.history.runStartedAt) % interval !== 0)
    return { state, eventIds: [] };
  const revenueMultiplier = subscriberRevenueMultiplier(state);
  const legacyRevenueAmount = Math.round(
    rules.progression.subscriberRevenue.baseAmount * revenueMultiplier,
  );
  const progressionFollowers = Math.max(
    state.progression.followers,
    state.progression.peakFollowers,
  );
  const subscriberRevenueFloor =
    rules.progression.subscriberRevenue.minimumAmountBands
      .filter((band) => progressionFollowers >= band.minimumPeakSubscribers)
      .at(-1)?.amount ?? 0;
  const amount = Math.max(legacyRevenueAmount, subscriberRevenueFloor);
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'subscriber_revenue',
    at,
    message: `Subscriber Revenue paid $${amount}.`,
    amount,
    revenueMultiplier,
    legacyRevenueAmount,
    subscriberRevenueFloor,
  };
  const credited: GameState = {
    ...creditIncome(state, amount),
    events: [...state.events, event],
  };
  const next = finalizeFinancialOperation({
    before: state,
    state: credited,
    triggerEventId: event.id,
    kind: 'subscriber_revenue_income',
  });
  return {
    state: next,
    eventIds: next.events.slice(state.events.length).map(({ id }) => id),
  };
}
