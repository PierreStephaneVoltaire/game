import type { GameDefinition } from './game-definition';
import type { GameEvent, GameState } from './game-types';
import { actionRandom } from './seeded-rng';
import { localDate } from './shop-rules';
import { startAutonomousStream, streamWeight } from './stream-rules';
import { alignGameStatuses, applyStatusOnsetEffects } from './status-rules';
import rules from './data/simulation-rules.json';
import { messageFor, type BuiltInEventType } from './event-messages';

type Candidate =
  | 'none'
  | 'low_money_stress'
  | 'food_craving'
  | 'creative_inspiration'
  | 'socks'
  | 'benign_room_event'
  | 'stream'
  | `item_hook:${string}`;

import { HOUR_MS, STAT_MAX, STAT_MIN } from './game-constants';
import { resolveAutomaticEventHook } from './simulation/event-hook-resolution';

/** Resolves exactly one weighted autonomous opportunity for one companion attempt. */
export function resolveAttemptEvent(
  state: GameState,
  commandId: string,
  definition: GameDefinition,
): GameState {
  const date = localDate(state.now, state.timezone);
  const cravingEligible = definition.items.some(
    (item) =>
      item.edible &&
      item.preferences?.includes('liked') &&
      ((state.inventory[item.id] ?? 0) > 0 ||
        (state.shop.itemIds.includes(item.id) &&
          (state.shop.stock[item.id] ?? 0) > 0)),
  );
  const itemHooks = definition.items.flatMap((item) => {
    const placed = Object.values(state.room).includes(item.id);
    const owned = (state.inventory[item.id] ?? 0) > 0 || placed;
    return (item.automaticEventHooks ?? [])
      .filter(
        (hook) =>
          (hook.eligibility === 'owned' ? owned : placed) &&
          (state.history.eventCooldowns[`item_hook:${item.id}:${hook.id}`] ??
            0) <= state.now,
      )
      .map((hook) => ({ itemId: item.id, hook }));
  });
  const candidates: Array<{ type: Candidate; weight: number }> = [
    { type: 'none', weight: rules.events.weights.none },
    {
      type: 'low_money_stress',
      weight:
        state.balance < rules.events.weights.lowMoneyBalanceThreshold &&
        state.history.oncePerLocalDate.low_money_stress !== date
          ? rules.events.weights.lowMoneyStress
          : 0,
    },
    {
      type: 'food_craving',
      weight: state.history.cravingItemId
        ? 0
        : cravingEligible
          ? rules.events.weights.foodCraving
          : 0,
    },
    {
      type: 'creative_inspiration',
      weight:
        (state.history.eventCooldowns.inspiration ?? 0) <= state.now
          ? rules.events.weights.creativeInspiration
          : 0,
    },
    {
      type: 'socks',
      weight:
        (state.history.eventCooldowns.socks ?? 0) <= state.now
          ? rules.events.weights.socks
          : 0,
    },
    {
      type: 'benign_room_event',
      weight:
        (state.history.eventCooldowns.room ?? 0) <= state.now
          ? rules.events.weights.benignRoom
          : 0,
    },
    { type: 'stream', weight: streamWeight(state, commandId) },
    ...itemHooks.map(({ itemId, hook }) => ({
      type: `item_hook:${itemId}:${hook.id}` as const,
      weight: hook.weight,
    })),
  ];
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
    candidates.find((candidate) => {
      remaining -= candidate.weight;
      return remaining < 0;
    })?.type ?? 'none';
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
    const started = startAutonomousStream(state, commandId);
    const generated = started.events
      .slice(state.events.length)
      .map((event) => ({
        ...event,
        id: `event-${state.events.length + 2}`,
      }));
    return {
      ...started,
      events: [...state.events, opportunityEvent, ...generated],
      stateVersion: state.stateVersion + 2,
    };
  }

  const selectedHook = selected.startsWith('item_hook:')
    ? itemHooks.find(
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
  const cooldowns = { ...state.history.eventCooldowns };
  const oncePerLocalDate = { ...state.history.oncePerLocalDate };
  let cravingItemId = state.history.cravingItemId;
  if (selectedHook) {
    const hook = selectedHook.hook;
    const resolution = resolveAutomaticEventHook({
      state,
      commandId,
      itemId: selectedHook.itemId,
      hook,
    });
    Object.assign(metrics, resolution.metrics);
    if (Object.keys(resolution.metricDeltas).length)
      event.metricDeltas = resolution.metricDeltas;
    event.healthDamageSources = resolution.healthDamageSources;
    if (resolution.cooldownAt)
      cooldowns[`item_hook:${selectedHook.itemId}:${hook.id}`] =
        resolution.cooldownAt;
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
  if (selected === 'food_craving') {
    const foods = definition.items.filter(
      (item) =>
        item.edible &&
        item.preferences?.includes('liked') &&
        ((state.inventory[item.id] ?? 0) > 0 ||
          (state.shop.itemIds.includes(item.id) &&
            (state.shop.stock[item.id] ?? 0) > 0)),
    );
    if (!foods.length)
      return {
        ...state,
        events: [...state.events, opportunityEvent],
        stateVersion: state.stateVersion + 1,
      };
    const ordered = [...foods].sort(
      (a, b) =>
        actionRandom(
          state.seed,
          state.stateVersion,
          commandId,
          'craving',
          a.id,
        ) -
        actionRandom(
          state.seed,
          state.stateVersion,
          commandId,
          'craving',
          b.id,
        ),
    );
    cravingItemId = ordered[0].id;
    event.message = `Companion is craving ${ordered[0].name}.`;
    event.cause = cravingItemId;
  }
  const aligned = alignGameStatuses(metrics, state.statuses, state.now);
  const statusEffects = applyStatusOnsetEffects(
    metrics,
    state.statuses,
    aligned,
  );
  const statusEvents = statusEffects.events.map((effect, index) => ({
    id: `event-${state.events.length + index + 3}`,
    type: 'status_onset',
    at: state.now,
    message: effect.message,
    sourceActionId: commandId,
    status: effect.status,
    metricDeltas: effect.metricDeltas,
  }));
  return {
    ...state,
    metrics: statusEffects.metrics,
    statuses: aligned,
    history: {
      ...state.history,
      eventCooldowns: cooldowns,
      oncePerLocalDate,
      cravingItemId,
      lastBondGainAt:
        statusEffects.metrics.bond > state.metrics.bond
          ? state.now
          : state.history.lastBondGainAt,
    },
    events: [...state.events, opportunityEvent, event, ...statusEvents],
    stateVersion: state.stateVersion + 2,
  };
}
