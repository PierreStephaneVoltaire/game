import lifeEventData from './data/life-events.json';
import type { GameState } from './game-types';
import { lifeEventDefinitions, resolveLifeEvent } from './life-event-rules';
import { isLifeEventEligible } from './life-event-rules';
import {
  BUNDLED_GAME_DEFINITION,
  type GameDefinition,
} from './game-definition';
import { MINUTE_MS } from './game-constants';
import { actionRandom } from './seeded-rng';

export const LIFE_EVENT_INTERVAL_MS = lifeEventData.intervalMinutes * MINUTE_MS;

export function nextLifeEventBoundary(state: GameState): number {
  return (
    state.history.runStartedAt +
    (state.history.lifeEventScheduler.boundariesProcessed + 1) *
      LIFE_EVENT_INTERVAL_MS
  );
}

export function rollLifeEventIds(
  state: GameState,
  at: number,
  gameDefinition: GameDefinition = BUNDLED_GAME_DEFINITION,
): string[] {
  const stateVersion = state.stateVersion;
  const actionId = `life-events:${at}`;
  return lifeEventDefinitions
    .filter(
      (definition) =>
        isLifeEventEligible(state, definition, gameDefinition) &&
        Math.floor(
          actionRandom(
            state.seed,
            stateVersion,
            actionId,
            'life_event_roll',
            definition.id,
          ) * definition.rollDenominator,
        ) === 0,
    )
    .map(({ id }) => id);
}

export function processLifeEventBoundary(
  state: GameState,
  at: number,
  successfulEventIds: string[] | undefined = undefined,
  gameDefinition: GameDefinition = BUNDLED_GAME_DEFINITION,
): { state: GameState; eventIds: string[] } {
  if (state.ending || at !== nextLifeEventBoundary(state))
    return { state, eventIds: [] };
  // Keep injected/test rolls subject to the authored table order too. The
  // production roll list is already ordered, but resolution must not depend
  // on a caller's array ordering when several events share a boundary.
  const successfulEventSet = new Set(
    successfulEventIds ?? rollLifeEventIds(state, at, gameDefinition),
  );
  const orderedSuccessfulEventIds = lifeEventDefinitions
    .filter((definition) => successfulEventSet.has(definition.id))
    .map((definition) => definition.id);
  const successfulRolls = {
    ...state.history.lifeEventScheduler.successfulRolls,
  };
  for (const eventId of orderedSuccessfulEventIds)
    successfulRolls[eventId] = (successfulRolls[eventId] ?? 0) + 1;
  let next: GameState = {
    ...state,
    now: at,
    history: {
      ...state.history,
      lifeEventScheduler: {
        ...state.history.lifeEventScheduler,
        boundariesProcessed:
          state.history.lifeEventScheduler.boundariesProcessed + 1,
        successfulRolls,
        multiSuccessBoundaries:
          state.history.lifeEventScheduler.multiSuccessBoundaries +
          (orderedSuccessfulEventIds.length > 1 ? 1 : 0),
      },
    },
  };
  for (const eventId of orderedSuccessfulEventIds) {
    if (next.ending) break;
    if (
      eventId === 'agency_invitation' &&
      next.progression.agencyJoinedAt !== null
    ) {
      next = {
        ...next,
        history: {
          ...next.history,
          lifeEventScheduler: {
            ...next.history.lifeEventScheduler,
            suppressedAgencyInvitations:
              next.history.lifeEventScheduler.suppressedAgencyInvitations + 1,
          },
        },
      };
      continue;
    }
    const definition = lifeEventDefinitions.find(({ id }) => id === eventId);
    if (
      !definition ||
      !isLifeEventEligible(next, definition, gameDefinition)
    )
      continue;
    next = resolveLifeEvent(
      next,
      eventId,
      at,
      `life-events:${at}:${eventId}`,
      gameDefinition,
    );
  }
  return {
    state: next,
    eventIds: next.events.slice(state.events.length).map(({ id }) => id),
  };
}
