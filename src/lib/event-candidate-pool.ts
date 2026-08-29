import type { GameDefinition } from './game-definition';
import type { GameState } from './game-types';
import rules from './data/simulation-rules.json';
import { CAREER_TIERS } from './progression-types';

export type Candidate =
  | 'none'
  | 'low_money_stress'
  | 'food_craving'
  | 'creative_inspiration'
  | 'socks'
  | 'benign_room_event'
  | 'stream'
  | 'off_stream_support'
  | 'self_entertainment'
  | 'stood_up_too_fast'
  | 'tiny_walk'
  | 'barely_moved_today'
  | 'full_body_commission'
  | 'moms_care_package'
  | 'rest_snoring'
  | `item_hook:${string}`;

export function eventCandidates(
  state: GameState,
  definition: GameDefinition,
  date: string,
  streamWeight: number,
): Array<{ type: Candidate; weight: number }> {
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
          (!hook.requiresIdle || !state.activity) &&
          (hook.minimumFollowers === undefined ||
            state.progression.followers >= hook.minimumFollowers) &&
          (hook.requiredCareerTier === undefined ||
            CAREER_TIERS.indexOf(state.progression.careerTier) >=
              CAREER_TIERS.indexOf(hook.requiredCareerTier)) &&
          (state.history.eventCooldowns[
            hook.sharedCooldownKey ?? `item_hook:${item.id}:${hook.id}`
          ] ?? 0) <= state.now,
      )
      .map((hook) => ({ itemId: item.id, hook }));
  });
  const riggingTabletOwned = definition.items.some(
    (item) =>
      item.itemActions?.some(
        (action) => action.activity?.type === 'commission_work',
      ) &&
      ((state.inventory[item.id] ?? 0) > 0 ||
        Object.values(state.room).includes(item.id)),
  );
  const eventModifier = (eventId: string) =>
    definition.items.reduce((total, item) => {
      const owned =
        (state.inventory[item.id] ?? 0) > 0 ||
        Object.values(state.room).includes(item.id);
      const placed = Object.values(state.room).includes(item.id);
      return (
        total +
        (item.eventPoolModifiers ?? [])
          .filter(
            (modifier) =>
              modifier.eventId === eventId &&
              (modifier.eligibility === 'placed' ? placed : owned),
          )
          .reduce((sum, modifier) => sum + modifier.weightDelta, 0)
      );
    }, 0);
  const restBeganTired =
    state.activity?.type === 'rest' &&
    Number(state.activity.payload?.startingRest ?? state.metrics.rest) <= 2;
  return [
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
        Object.values(state.room).includes('cat-tree') &&
        (state.history.eventCooldowns.socks ?? 0) <= state.now
          ? rules.events.weights.socks + eventModifier('socks')
          : 0,
    },
    {
      type: 'benign_room_event',
      weight:
        (state.history.eventCooldowns.room ?? 0) <= state.now
          ? rules.events.weights.benignRoom
          : 0,
    },
    { type: 'stream', weight: streamWeight },
    {
      type: 'off_stream_support',
      weight:
        !state.ending &&
        (state.history.eventCooldowns.off_stream_support ?? 0) <= state.now
          ? rules.events.offStreamSupport.weight
          : 0,
    },
    {
      type: 'self_entertainment',
      weight:
        !state.activity &&
        (state.history.eventCooldowns.self_entertainment ?? 0) <= state.now
          ? rules.events.weights.selfEntertainment
          : 0,
    },
    {
      type: 'stood_up_too_fast',
      weight:
        !state.activity &&
        (state.history.eventCooldowns.stood_up_too_fast ?? 0) <= state.now
          ? rules.events.weights.stoodUpTooFast
          : 0,
    },
    {
      type: 'tiny_walk',
      weight:
        !state.activity &&
        state.history.oncePerLocalDate.movement_event !== date
          ? rules.events.weights.tinyWalk
          : 0,
    },
    {
      type: 'barely_moved_today',
      weight:
        !state.activity &&
        state.history.oncePerLocalDate.movement_event !== date &&
        (state.history.lastMovementAt === null ||
          state.now - state.history.lastMovementAt >= 24 * 60 * 60 * 1000)
          ? rules.events.weights.barelyMovedToday
          : 0,
    },
    {
      type: 'full_body_commission',
      weight:
        riggingTabletOwned &&
        state.projects.length === 0 &&
        (state.history.eventCooldowns.full_body_commission ?? 0) <=
          localDateOrdinal(date)
          ? rules.events.weights.fullBodyCommission
          : 0,
    },
    {
      type: 'moms_care_package',
      weight:
        (state.balance < 0 || state.metrics.food <= 2) &&
        (state.history.eventCooldowns.moms_care_package ?? 0) <= state.now
          ? rules.events.weights.momsCarePackage
          : 0,
    },
    {
      type: 'rest_snoring',
      weight:
        restBeganTired &&
        state.history.eventCooldowns[`rest_snoring:${state.activity?.id}`] ===
          undefined
          ? rules.events.weights.restSnoring
          : 0,
    },
    ...itemHooks.map(({ itemId, hook }) => ({
      type: `item_hook:${itemId}:${hook.id}` as const,
      weight: hook.weight,
    })),
  ];
}

export function localDateOrdinal(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}
