import type { GameDefinition } from './game-definition';
import type { GameState } from './game-types';
import rules from './data/simulation-rules.json';

export type Candidate =
  | 'none'
  | 'low_money_stress'
  | 'food_craving'
  | 'creative_inspiration'
  | 'socks'
  | 'benign_room_event'
  | 'stream'
  | 'autonomous_nap'
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
          (state.history.eventCooldowns[`item_hook:${item.id}:${hook.id}`] ??
            0) <= state.now,
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
      type: 'autonomous_nap',
      weight:
        !state.activity && state.metrics.rest <= 2
          ? rules.events.autonomous.restWeight
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
