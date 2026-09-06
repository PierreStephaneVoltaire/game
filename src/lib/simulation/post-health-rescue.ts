import type { GameDefinition } from '../game-definition';
import type { GameEvent, GameState, HealthDamageSource } from '../game-types';
import { simulationRules as rules } from '../runtime-definition';
import { actionRandom } from '../seeded-rng';
import { resolveItemConsumption } from '../commands/item-consumption';
import { appendStatusTransitionEvents } from './engine-state';
import { chooseDuration } from '../activity-rules';
import { criticalMetrics } from './health-resolution';

export function resolvePostHealthRescues(input: {
  state: GameState;
  definition: GameDefinition;
  damageSources: HealthDamageSource[];
  damageEventId: string;
}): { state: GameState; eventIds: string[] } {
  let next = input.state;
  const eventIds: string[] = [];
  if (input.damageSources.some((source) => source.id === 'starving')) {
    const result = resolveFoodRescue(
      next,
      input.definition,
      input.damageEventId,
    );
    next = result.state;
    eventIds.push(...result.eventIds);
  }
  if (input.damageSources.some((source) => source.id === 'sleep_deprived')) {
    const result = resolveRestRescue(next, input.damageEventId);
    next = result.state;
    eventIds.push(...result.eventIds);
  }
  return { state: next, eventIds };
}

function resolveFoodRescue(
  state: GameState,
  definition: GameDefinition,
  damageEventId: string,
): { state: GameState; eventIds: string[] } {
  const blocked = foodBlockedReason(state);
  const foods = blocked ? [] : eligibleFoods(state, definition);
  if (blocked || foods.length === 0)
    return blockedRescue(
      state,
      'food',
      blocked ?? 'no_eligible_owned_food',
      damageEventId,
    );
  const bestTier = Math.min(
    ...foods.map((item) => preferenceTier(state, item)),
  );
  const preferred = foods
    .filter((item) => preferenceTier(state, item) === bestTier)
    .sort((left, right) => left.id.localeCompare(right.id));
  const commandId = `autonomous-food-rescue:${state.now}`;
  const roll = actionRandom(
    state.seed,
    state.stateVersion,
    commandId,
    'autonomous_food_rescue',
    'food_selection',
  );
  const item = preferred[Math.floor(roll * preferred.length)];
  const beforeEvents = state.events.length;
  const beforeStatuses = state.statuses;
  const beforeFood = state.metrics.food;
  let next = resolveItemConsumption(
    state,
    {
      type: 'use_item',
      commandId,
      itemId: item.id,
      now: state.now,
    },
    definition,
    { automatic: true },
  ).state;
  if (next.metrics.food <= beforeFood)
    return blockedRescue(
      state,
      'food',
      'ordinary_consumption_did_not_raise_food',
      damageEventId,
    );
  next = appendStatusTransitionEvents(next, beforeStatuses, commandId);
  const event: GameEvent = {
    id: `event-${next.events.length + 1}`,
    type: 'autonomous_food_rescue',
    at: next.now,
    message: `Companion finally grabbed ${item.name} after letting herself get way too hungry.`,
    sourceActionId: commandId,
    cause: item.id,
    causedBy: [damageEventId],
    rescueMetric: 'food',
    itemName: item.name,
  };
  next = {
    ...next,
    history: {
      ...next.history,
      autonomousRescue: {
        ...next.history.autonomousRescue,
        foodLocked: true,
      },
    },
    events: [...next.events, event],
  };
  return {
    state: next,
    eventIds: [
      ...next.events.slice(beforeEvents, -1).map((itemEvent) => itemEvent.id),
      event.id,
    ],
  };
}

function resolveRestRescue(
  state: GameState,
  damageEventId: string,
): { state: GameState; eventIds: string[] } {
  const reason = restBlockedReason(state);
  if (reason) return blockedRescue(state, 'rest', reason, damageEventId);
  const commandId = `autonomous-rest-rescue:${state.now}`;
  const duration = chooseDuration('rest', state, commandId);
  if (duration <= 0)
    return blockedRescue(state, 'rest', 'rest_refused', damageEventId);
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'activity_started',
    at: state.now,
    message: 'Companion is exhausted and decided she is going to bed.',
    sourceActionId: commandId,
    activityType: 'rest',
    causedBy: [damageEventId],
    rescueMetric: 'rest',
  };
  return {
    state: {
      ...state,
      activity: {
        id: `activity-${state.actionOrdinal + 1}`,
        type: 'rest',
        startedAt: state.now,
        endsAt: state.now + duration,
        sourceActionId: commandId,
        payload: {
          autonomous: true,
          startingRest: state.metrics.rest,
          startingCriticalMetrics: criticalMetrics(state.metrics).join(','),
        },
      },
      history: {
        ...state.history,
        autonomousRescue: {
          ...state.history.autonomousRescue,
          restLocked: true,
        },
      },
      events: [...state.events, event],
      actionOrdinal: state.actionOrdinal + 1,
      stateVersion: state.stateVersion + 1,
    },
    eventIds: [event.id],
  };
}

function eligibleFoods(state: GameState, definition: GameDefinition) {
  if (state.statuses.sick || state.statuses.full) return [];
  return definition.items.filter(
    (item) =>
      item.edible &&
      item.usable !== false &&
      (state.inventory[item.id] ?? 0) > 0 &&
      (item.effects?.food?.max ?? 0) > 0 &&
      (item.preferences?.includes('liked') ||
        item.preferences?.includes('variable')) &&
      item.itemActions?.some((action) => action.kind === 'consume'),
  );
}

function preferenceTier(
  state: GameState,
  item: GameDefinition['items'][number],
): number {
  const shelf = Object.values(state.room).includes('snack-shelf');
  const fridge = Object.values(state.room).includes('mini-fridge');
  if (shelf && item.tags.includes('snack')) return 0;
  if (
    fridge &&
    (item.tags.includes('drink') || item.tags.includes('refrigerated'))
  )
    return 0;
  return 1;
}

function foodBlockedReason(state: GameState): string | null {
  if (state.ending || state.metrics.health <= 0) return 'dead';
  if (state.metrics.food > rules.timeDecay.criticalNeed.lowMaximum)
    return 'food_above_rescue_threshold';
  if (state.activity) return 'busy';
  if (state.history.autonomousRescue.foodLocked) return 'rescue_locked';
  return null;
}

function restBlockedReason(state: GameState): string | null {
  if (state.ending || state.metrics.health <= 0) return 'dead';
  if (state.metrics.rest > rules.timeDecay.criticalNeed.lowMaximum)
    return 'rest_above_rescue_threshold';
  if (state.activity) return 'busy';
  if (state.history.autonomousRescue.restLocked) return 'rescue_locked';
  return null;
}

function blockedRescue(
  state: GameState,
  metric: 'food' | 'rest',
  reason: string,
  damageEventId: string,
): { state: GameState; eventIds: string[] } {
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'autonomous_rescue_blocked',
    at: state.now,
    message: `Autonomous ${metric} rescue was blocked: ${reason}.`,
    causedBy: [damageEventId],
    rescueMetric: metric,
    rescueBlockedReason: reason,
  };
  return {
    state: { ...state, events: [...state.events, event] },
    eventIds: [event.id],
  };
}
