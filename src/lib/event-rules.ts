import type { GameDefinition } from './game-definition';
import type { GameEvent, GameState } from './game-types';
import { actionRandom } from './seeded-rng';
import { localDate } from './shop-rules';
import { startAutonomousStream, streamWeight } from './stream-rules';
import rules from './data/simulation-rules.json';
import { messageFor, type BuiltInEventType } from './event-messages';

import { DAY_MS, HOUR_MS, STAT_MAX, STAT_MIN } from './game-constants';
import { startFullBodyProject } from './project-rules';
import {
  chooseCarePackageFoods,
  chooseCravingFood,
  resolveAutonomousNap,
} from './event-autonomous-actions';
import { applyAutomaticHook } from './event-hook-application';
import { eventCandidates, localDateOrdinal } from './event-candidate-pool';
import { reconcileMetricSource } from './status-rules/metric-source-reconciliation';
import { resolveOffStreamSupport } from './off-stream-support-rules';

/** Resolves exactly one weighted autonomous opportunity for one companion attempt. */
export function resolveAttemptEvent(
  state: GameState,
  commandId: string,
  definition: GameDefinition,
): GameState {
  const date = localDate(state.now, state.timezone);
  const resolvedStreamWeight = streamWeight(state, commandId);
  const candidates = eventCandidates(
    state,
    definition,
    date,
    resolvedStreamWeight,
  );
  const total = candidates.reduce(
    (sum, candidate) => sum + candidate.weight,
    0,
  );
  let remaining =
    actionRandom(
      state.seed,
      state.stateVersion,
      commandId,
      'autonomous_event',
      'pool',
    ) * total;
  const selected =
    state.progression.queuedEventStreams.length > 0 && resolvedStreamWeight > 0
      ? 'stream'
      : (candidates.find((candidate) => {
          remaining -= candidate.weight;
          return remaining < 0;
        })?.type ?? 'none');
  const opportunityEvent: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'random_event_opportunity',
    at: state.now,
    message: 'A random event opportunity occurred.',
    sourceActionId: commandId,
    cause: selected,
  };
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
  if (selected === 'autonomous_nap') {
    return resolveAutonomousNap(state, commandId, opportunityEvent);
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
      ? selectedHook.hook.message
      : messageFor(selected as BuiltInEventType),
    sourceActionId: commandId,
  };
  const metrics = { ...state.metrics };
  let inventory = state.inventory;
  const cooldowns = { ...state.history.eventCooldowns };
  const oncePerLocalDate = { ...state.history.oncePerLocalDate };
  let cravingItemId = state.history.cravingItemId;
  let cravingStartedAt = state.history.cravingStartedAt;
  let cravingRefreshCount = state.history.cravingRefreshCount;
  if (selectedHook) {
    applyAutomaticHook({
      state,
      commandId,
      itemId: selectedHook.itemId,
      hook: selectedHook.hook,
      metrics,
      event,
      cooldowns,
    });
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
  const normalized = reconcileMetricSource(
    state,
    {
      ...state,
      metrics,
      inventory,
      history: {
        ...state.history,
        eventCooldowns: cooldowns,
        oncePerLocalDate,
        cravingItemId,
        cravingStartedAt,
        cravingRefreshCount,
      },
      events: [...state.events, opportunityEvent, event],
      stateVersion: state.stateVersion + 2,
    },
    commandId,
  );
  return {
    ...normalized,
    history: {
      ...normalized.history,
      lastBondGainAt:
        normalized.metrics.bond > state.metrics.bond
          ? state.now
          : normalized.history.lastBondGainAt,
    },
  };
}
