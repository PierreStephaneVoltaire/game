import type { GameDefinition } from '../game-definition';
import type { GameEvent, GameState } from '../game-types';
import rules from '../data/simulation-rules.json';
import { HOUR_MS } from '../game-constants';
import { localDate, rotateShop } from '../shop-rules';
import { resolveAttemptEvent } from '../event-rules';

export function resolveTimelineOpportunities(input: {
  state: GameState;
  definition: GameDefinition;
  at: number;
  autonomous: boolean;
}): { state: GameState; eventIds: string[] } {
  let next = input.state;
  const eventIds: string[] = [];
  if (input.autonomous) {
    const commandId = `autonomous:${input.at}`;
    const beforeVersion = next.stateVersion;
    next = resolveAttemptEvent(next, commandId, input.definition);
    const opportunity = next.events[next.events.length - 1];
    if (
      opportunity?.type === 'random_event_opportunity' &&
      opportunity.cause === 'none'
    )
      next = { ...next, stateVersion: beforeVersion };
    next = {
      ...next,
      history: {
        ...next.history,
        nextAutonomousAt:
          input.at + rules.events.autonomous.intervalHours * HOUR_MS,
      },
    };
    eventIds.push(
      ...next.events.slice(input.state.events.length).map((event) => event.id),
    );
  }
  if (
    next.history.cravingItemId !== null &&
    next.history.cravingStartedAt !== null &&
    input.at - next.history.cravingStartedAt >=
      rules.craving.expiryHours * HOUR_MS
  ) {
    const event: GameEvent = {
      id: `event-${next.events.length + 1}`,
      type: 'craving_expired',
      at: input.at,
      message: 'The craving faded before it could be fulfilled.',
    };
    next = {
      ...next,
      history: {
        ...next.history,
        cravingItemId: null,
        cravingStartedAt: null,
        cravingRefreshCount: 0,
      },
      events: [...next.events, event],
    };
    eventIds.push(event.id);
  }
  const date = localDate(input.at, next.timezone);
  if (date !== next.shop.localDate) {
    const refreshCount = next.history.cravingItemId
      ? next.history.cravingRefreshCount + 1
      : next.history.cravingRefreshCount;
    const refreshExpires = refreshCount >= rules.craving.refreshLimit;
    next = {
      ...next,
      shop: rotateShop(next, input.definition, date),
      history: {
        ...next.history,
        ...(refreshExpires
          ? {
              cravingItemId: null,
              cravingStartedAt: null,
              cravingRefreshCount: 0,
            }
          : { cravingRefreshCount: refreshCount }),
      },
      stateVersion: next.stateVersion + 1,
    };
    const event: GameEvent = {
      id: `event-${next.events.length + 1}`,
      type: 'shop_rotated',
      at: input.at,
      message: 'The shop refreshed for a new local day.',
      shopItemIds: next.shop.itemIds,
    };
    next = { ...next, events: [...next.events, event] };
    eventIds.push(event.id);
    if (refreshExpires) {
      const expiry: GameEvent = {
        id: `event-${next.events.length + 1}`,
        type: 'craving_expired',
        at: input.at,
        message: 'The craving faded after the shop changed twice.',
      };
      next = { ...next, events: [...next.events, expiry] };
      eventIds.push(expiry.id);
    }
  }
  return { state: next, eventIds };
}
