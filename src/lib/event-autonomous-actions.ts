import type { GameDefinition } from './game-definition';
import type { GameEvent, GameState } from './game-types';
import { chooseDuration } from './activity-rules';
import { criticalMetrics } from './simulation/health-resolution';
import { actionRandom } from './seeded-rng';

export function resolveAutonomousNap(
  state: GameState,
  commandId: string,
  opportunityEvent: GameEvent,
): GameState {
  const duration = chooseDuration('rest', state, commandId);
  if (duration <= 0)
    return {
      ...state,
      events: [
        ...state.events,
        opportunityEvent,
        {
          id: `event-${state.events.length + 2}`,
          type: 'autonomous_nap_refused',
          at: state.now,
          message: 'The companion was too tired to settle into a nap.',
          sourceActionId: commandId,
        },
      ],
      stateVersion: state.stateVersion + 2,
    };
  const nap: GameEvent = {
    id: `event-${state.events.length + 2}`,
    type: 'activity_started',
    at: state.now,
    message: 'The companion settled into an autonomous nap.',
    sourceActionId: commandId,
    activityType: 'rest',
  };
  return {
    ...state,
    activity: {
      id: `activity-${state.actionOrdinal + 1}`,
      type: 'rest',
      startedAt: state.now,
      endsAt: state.now + duration,
      sourceActionId: commandId,
      payload: {
        startingRest: state.metrics.rest,
        startingCriticalMetrics: criticalMetrics(state.metrics).join(','),
      },
    },
    events: [...state.events, opportunityEvent, nap],
    stateVersion: state.stateVersion + 2,
    actionOrdinal: state.actionOrdinal + 1,
  };
}

export function chooseCravingFood(
  state: GameState,
  definition: GameDefinition,
  commandId: string,
): GameDefinition['items'][number] | undefined {
  const foods = definition.items.filter(
    (item) =>
      item.edible &&
      item.preferences?.includes('liked') &&
      ((state.inventory[item.id] ?? 0) > 0 ||
        (state.shop.itemIds.includes(item.id) &&
          (state.shop.stock[item.id] ?? 0) > 0)),
  );
  return [...foods].sort(
    (a, b) =>
      actionRandomFor(state, commandId, a.id) -
      actionRandomFor(state, commandId, b.id),
  )[0];
}

export function chooseCarePackageFoods(
  state: GameState,
  definition: GameDefinition,
  commandId: string,
): GameDefinition['items'] {
  const foods = definition.items.filter(
    (item) =>
      item.edible &&
      item.preferences?.includes('liked') &&
      (item.usable !== false || item.consumable !== false),
  );
  return [...foods]
    .sort(
      (a, b) =>
        actionRandomFor(state, commandId, `care:${a.id}`) -
        actionRandomFor(state, commandId, `care:${b.id}`),
    )
    .slice(0, Math.min(2, foods.length));
}

function actionRandomFor(state: GameState, commandId: string, itemId: string) {
  return actionRandom(
    state.seed,
    state.stateVersion,
    commandId,
    'craving',
    itemId,
  );
}
