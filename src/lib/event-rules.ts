import type { GameDefinition } from './game-definition';
import type { GameEvent, GameState } from './game-types';
import { actionRandom } from './seeded-rng';
import { localDate } from './shop-rules';
import { startAutonomousStream } from './stream-rules';
import rules from './data/simulation-rules.json';
import { messageFor, type BuiltInEventType } from './event-messages';

import { DAY_MS, HOUR_MS, STAT_MAX, STAT_MIN } from './game-constants';
import { startFullBodyProject } from './project-rules';
import {
  chooseCarePackageFoods,
  chooseCravingFood,
} from './event-autonomous-actions';
import { applyAutomaticHook } from './event-hook-application';
import { localDateOrdinal } from './event-candidate-pool';
import { resolveOffStreamSupport } from './off-stream-support-rules';
import { healthDamageSource } from './simulation/health-resolution';
import { selectAttemptEvent } from './event-selection';
import { finalizeBuiltInEvent } from './event-resolution-finalizer';

/** Resolves exactly one weighted autonomous opportunity for one companion attempt. */
export function resolveAttemptEvent(
  state: GameState,
  commandId: string,
  definition: GameDefinition,
): GameState {
  const date = localDate(state.now, state.timezone);
  const { selected, opportunityEvent } = selectAttemptEvent(
    state,
    commandId,
    definition,
  );
  if (selected === 'none')
    return {
      ...state,
      events: [...state.events, opportunityEvent],
      stateVersion: state.stateVersion + 1,
    };
  if (selected === 'stream') {
    const ordinarySelection = state.progression.queuedEventStreams.length === 0;
    const started = startAutonomousStream(state, commandId);
    const generated = started.events
      .slice(state.events.length)
      .map((event) => ({
        ...event,
        id: `event-${state.events.length + 2}`,
      }));
    return {
      ...started,
      progression: ordinarySelection
        ? {
            ...started.progression,
            lastAutonomousStreamSelectedAt: state.now,
          }
        : started.progression,
      events: [...state.events, opportunityEvent, ...generated],
      stateVersion: state.stateVersion + 2,
    };
  }
  if (selected === 'off_stream_support') {
    return resolveOffStreamSupport(state, commandId, opportunityEvent);
  }
  if (selected === 'full_body_commission') {
    const withOpportunity: GameState = {
      ...state,
      events: [...state.events, opportunityEvent],
      stateVersion: state.stateVersion + 1,
      history: {
        ...state.history,
        eventCooldowns: {
          ...state.history.eventCooldowns,
          full_body_commission:
            localDateOrdinal(date) +
            rules.events.cooldowns.fullBodyCommissionLocalDays * DAY_MS,
        },
      },
    };
    return startFullBodyProject(withOpportunity, commandId);
  }
  const selectedHook = selected.startsWith('item_hook:')
    ? definition.items
        .flatMap((item) =>
          (item.automaticEventHooks ?? []).map((hook) => ({
            itemId: item.id,
            hook,
          })),
        )
        .find(
          ({ itemId, hook }) => `item_hook:${itemId}:${hook.id}` === selected,
        )
    : undefined;
  if (selected.startsWith('item_hook:') && !selectedHook)
    return {
      ...state,
      events: [...state.events, opportunityEvent],
      stateVersion: state.stateVersion + 1,
    };
  const event: GameEvent = {
    id: `event-${state.events.length + 2}`,
    type: selected.startsWith('item_hook:') ? 'item_automatic_hook' : selected,
    at: state.now,
    message: selectedHook
      ? (selectedHook.hook.message ?? 'Companion used an owned item.')
      : messageFor(selected as BuiltInEventType),
    sourceActionId: commandId,
  };
  const metrics = { ...state.metrics };
  let inventory = state.inventory;
  let balanceDelta = 0;
  const cooldowns = { ...state.history.eventCooldowns };
  const oncePerLocalDate = { ...state.history.oncePerLocalDate };
  let cravingItemId = state.history.cravingItemId;
  let cravingStartedAt = state.history.cravingStartedAt;
  let cravingRefreshCount = state.history.cravingRefreshCount;
  if (selectedHook) {
    balanceDelta = applyAutomaticHook({
      state,
      commandId,
      itemId: selectedHook.itemId,
      hook: selectedHook.hook,
      metrics,
      event,
      cooldowns,
    }).balanceDelta;
  }
  if (selected === 'low_money_stress') {
    metrics.mood = Math.max(
      STAT_MIN,
      metrics.mood + rules.events.effects.lowMoneyMood,
    );
    event.metricDeltas = { mood: rules.events.effects.lowMoneyMood };
    oncePerLocalDate.low_money_stress = date;
  }
  if (selected === 'creative_inspiration') {
    metrics.creativity = Math.min(
      STAT_MAX,
      metrics.creativity + rules.events.effects.creativeInspirationCreativity,
    );
    event.metricDeltas = {
      creativity: rules.events.effects.creativeInspirationCreativity,
    };
    cooldowns.inspiration =
      state.now + rules.events.cooldowns.creativeInspirationHours * HOUR_MS;
  }
  if (selected === 'socks') {
    const socksEffects = rules.events.effects.socksMood;
    const delta =
      socksEffects[
        Math.floor(
          actionRandom(
            state.seed,
            state.stateVersion,
            commandId,
            'socks',
            'mood',
          ) * socksEffects.length,
        )
      ];
    metrics.mood = Math.max(STAT_MIN, Math.min(STAT_MAX, metrics.mood + delta));
    event.metricDeltas = { mood: delta };
    cooldowns.socks = state.now + rules.events.cooldowns.socksHours * HOUR_MS;
  }
  if (selected === 'benign_room_event')
    cooldowns.room =
      state.now + rules.events.cooldowns.benignRoomHours * HOUR_MS;
  if (selected === 'rest_snoring') {
    event.message = 'The companion snored through the rest of the room.';
    cooldowns[`rest_snoring:${state.activity?.id ?? commandId}`] = state.now;
  }
  if (selected === 'moms_care_package') {
    const foods = chooseCarePackageFoods(state, definition, commandId);
    inventory = { ...state.inventory };
    for (const food of foods)
      inventory[food.id] = (inventory[food.id] ?? 0) + 1;
    event.message = foods.length
      ? `Mom's Care Package arrived with ${foods.map((food) => food.name).join(' and ')}.`
      : "Mom's Care Package arrived.";
    event.metricDeltas = { mood: rules.events.effects.carePackageMood };
    metrics.mood = Math.min(
      STAT_MAX,
      metrics.mood + rules.events.effects.carePackageMood,
    );
    cooldowns.moms_care_package =
      state.now + rules.events.cooldowns.momsCarePackageHours * HOUR_MS;
  }
  if (selected === 'self_entertainment') {
    metrics.mood = Math.min(STAT_MAX, metrics.mood + 1);
    event.metricDeltas = { mood: 1 };
    cooldowns.self_entertainment =
      state.now + rules.events.cooldowns.selfEntertainmentHours * HOUR_MS;
  }
  if (selected === 'stood_up_too_fast') {
    const roll = actionRandom(
      state.seed,
      state.stateVersion,
      commandId,
      'stood_up_too_fast',
      'outcome',
    );
    const outcome = roll < 0.75 ? 'brief' : roll < 0.95 ? 'rough' : 'stumble';
    event.selectedOutcomeId = outcome;
    if (outcome === 'rough') {
      metrics.rest = Math.max(STAT_MIN, metrics.rest - 1);
      event.metricDeltas = { rest: -1 };
    }
    if (outcome === 'stumble') {
      metrics.health = Math.max(STAT_MIN, metrics.health - 1);
      event.metricDeltas = { health: -1 };
      event.healthDamageSources = [
        healthDamageSource(
          'event',
          'stood_up_too_fast',
          'Stumble after standing too fast',
          1,
        ),
      ];
      event.message =
        'Companion stood up too fast, got lightheaded, and stumbled.';
    }
    cooldowns.stood_up_too_fast =
      state.now + rules.events.cooldowns.stoodUpTooFastHours * HOUR_MS;
  }
  if (selected === 'tiny_walk') {
    metrics.mood = Math.min(STAT_MAX, metrics.mood + 1);
    event.metricDeltas = { mood: 1 };
    oncePerLocalDate.movement_event = date;
  }
  if (selected === 'barely_moved_today') {
    metrics.mood = Math.max(STAT_MIN, metrics.mood - 1);
    event.metricDeltas = { mood: -1 };
    oncePerLocalDate.movement_event = date;
  }
  if (selected === 'food_craving') {
    const food = chooseCravingFood(state, definition, commandId);
    if (!food)
      return {
        ...state,
        events: [...state.events, opportunityEvent],
        stateVersion: state.stateVersion + 1,
      };
    cravingItemId = food.id;
    cravingStartedAt = state.now;
    cravingRefreshCount = 0;
    event.message = `Companion is craving ${food.name}.`;
    event.cause = cravingItemId;
  }
  if (
    state.timedEffects.hyperfocusUntil !== null &&
    state.now < state.timedEffects.hyperfocusUntil &&
    event.metricDeltas?.creativity !== undefined
  )
    event.metricDeltas = { ...event.metricDeltas, creativity: 0 };
  return finalizeBuiltInEvent({
    state,
    commandId,
    selected,
    opportunityEvent,
    event,
    metrics,
    inventory,
    balanceDelta,
    cooldowns,
    oncePerLocalDate,
    cravingItemId,
    cravingStartedAt,
    cravingRefreshCount,
  });
}
