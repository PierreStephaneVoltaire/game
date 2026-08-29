import { BUNDLED_GAME_DEFINITION as definition } from '../../../../src/lib/game-definition';
import {
  dispatchCommand,
  reconcileTime,
  startRun,
} from '../../../../src/lib/game-engine';
import type { GameCommand, GameState } from '../../../../src/lib/game-types';
import { HOUR_MS } from '../../../../src/lib/game-constants';
import { type CanonicalRunSpec, type RunTrace } from './balance-study-contract';

export { canonicalRunSpecs } from './balance-study-contract';
export type { RunSpec, RunTrace } from './balance-study-contract';

export const STUDY_START = Date.UTC(2026, 0, 5, 12);
export const DAY_MS = 24 * HOUR_MS;
export const HORIZON_DAYS = 60;
export const studyDefinition = definition;

const itemById = new Map(definition.items.map((item) => [item.id, item]));

export function runStudySpec(spec: CanonicalRunSpec): RunTrace {
  let state = startRun(
    {
      mode: 'streaming',
      now: STUDY_START,
      seed: spec.seed,
      timezone: 'America/Toronto',
    },
    definition,
  );
  const checks = { scheduled: 0, attended: 0, busy: 0, skipped: 0, retries: 0 };
  let rejectedPurchases = 0;
  const count = Math.floor((HORIZON_DAYS * 24) / spec.cadenceHours);
  for (let index = 1; index <= count && !state.ending; index += 1) {
    const scheduledAt = STUDY_START + index * spec.cadenceHours * HOUR_MS;
    checks.scheduled += 1;
    if (spec.profile === 'Neglect' && index % 2 === 0) {
      checks.skipped += 1;
      continue;
    }
    if (state.now > scheduledAt) {
      checks.busy += 1;
      continue;
    }
    state = reconcileTime(state, scheduledAt, definition).state;
    if (state.ending) break;
    checks.attended += 1;
    const result = attendSession(state, spec, index);
    state = result.state;
    rejectedPurchases += result.rejectedPurchases;
  }
  const horizonAt = STUDY_START + HORIZON_DAYS * DAY_MS;
  if (!state.ending && state.now < horizonAt)
    state = reconcileTime(state, horizonAt, definition).state;
  return { state, spec, checks, rejectedPurchases };
}

function attendSession(
  state: GameState,
  spec: CanonicalRunSpec,
  session: number,
) {
  let next = state;
  let ordinal = session * 30;
  let rejectedPurchases = 0;
  const invoke = (input: Omit<GameCommand, 'commandId' | 'now'>) => {
    const result = command(next, input, ordinal++);
    next = result.state;
    if (input.type === 'buy_item' && !result.accepted) rejectedPurchases += 1;
    return result.accepted;
  };

  const handledCondition = respondToCondition(next, spec, invoke);
  if (handledCondition || next.ending) return { state: next, rejectedPurchases };

  for (
    let feeds = 0;
    feeds < 4 && next.metrics.food <= spec.foodThreshold;
    feeds += 1
  ) {
    let food = ownedFood(next);
    if (!food) {
      food = shopFood(next, spec.responseMode === 'optimal');
      if (!food || !invoke({ type: 'buy_item', itemId: food, quantity: 1 }))
        break;
    }
    if (!invoke({ type: 'use_item', itemId: food }) || next.ending) break;
  }

  maintainSupplies(next, spec, invoke);
  pursueProgression(next, spec, invoke);
  if (next.ending) return { state: next, rejectedPurchases };

  const activity =
    next.metrics.rest <= spec.restThreshold
      ? 'rest'
      : next.metrics.creativity < spec.creativityTarget
        ? 'socialize'
        : next.metrics.mood <= spec.moodThreshold
          ? 'play'
          : session % 2 === 0
            ? 'socialize'
            : 'play';
  invoke({ type: activity });
  return { state: next, rejectedPurchases };
}

function respondToCondition(
  state: GameState,
  spec: CanonicalRunSpec,
  invoke: (input: Omit<GameCommand, 'commandId' | 'now'>) => boolean,
): boolean {
  if (!state.statuses.kidney_stone && !state.statuses.sick) {
    if (spec.responseMode === 'optimal' && riskyNutrition(state))
      hydrate(state, invoke);
    return false;
  }
  const stone = state.statuses.kidney_stone;
  if (spec.responseMode === 'unaware') return false;
  hydrate(state, invoke);
  if (
    stone &&
    ['wait', 'delayed_hospital', 'optimal'].includes(spec.responseMode)
  )
    useOrBuy(state, 'painkillers', invoke, 'take_painkillers');
  if (spec.responseMode === 'hospital') {
    prepareInsurance(state, invoke);
    invoke({ type: 'medical_care' });
    return true;
  }
  if (
    spec.responseMode === 'delayed_hospital' &&
    stone &&
    state.now - stone.since >= 24 * HOUR_MS
  ) {
    prepareInsurance(state, invoke);
    invoke({ type: 'medical_care' });
    return true;
  }
  if (spec.responseMode === 'optimal' && state.metrics.health <= 8) {
    prepareInsurance(state, invoke);
    invoke({ type: 'medical_care' });
    return true;
  }
  return false;
}

function maintainSupplies(
  state: GameState,
  spec: CanonicalRunSpec,
  invoke: (input: Omit<GameCommand, 'commandId' | 'now'>) => boolean,
) {
  let owned = usefulFoodCount(state);
  for (const id of state.shop.itemIds) {
    if (owned >= spec.foodReserve || state.balance < 20) break;
    const item = itemById.get(id);
    const stock = state.shop.stock[id] ?? 0;
    if (!acceptableFood(item) || stock <= 0 || item!.price > state.balance)
      continue;
    const quantity = Math.min(stock, spec.foodReserve - owned);
    if (invoke({ type: 'buy_item', itemId: id, quantity })) owned += quantity;
  }
  if (spec.responseMode !== 'unaware' && (state.inventory.water ?? 0) < 3)
    buyIfAvailable(state, 'water', 3 - (state.inventory.water ?? 0), invoke);
}

function pursueProgression(
  state: GameState,
  spec: CanonicalRunSpec,
  invoke: (input: Omit<GameCommand, 'commandId' | 'now'>) => boolean,
) {
  const activeStacks = state.timedEffects.clippers?.stacks ?? 0;
  if (activeStacks < spec.clipperStacks && state.balance >= 100) {
    if ((state.inventory.clippers ?? 0) === 0)
      buyIfAvailable(state, 'clippers', 1, invoke);
    if ((state.inventory.clippers ?? 0) > 0)
      invoke({
        type: 'perform_item_action',
        itemId: 'clippers',
        action: 'activate_clippers',
      });
  }
  const unfinishedModel = state.progression.unlockedModelTiers.some(
    (tier) => !state.progression.completedModelTiers.includes(tier),
  );
  if (unfinishedModel && !state.projects.length && state.balance >= 500) {
    if ((state.inventory['new-model-commission'] ?? 0) === 0)
      buyIfAvailable(state, 'new-model-commission', 1, invoke);
    if ((state.inventory['new-model-commission'] ?? 0) > 0)
      invoke({
        type: 'perform_item_action',
        itemId: 'new-model-commission',
        action: 'start_model_commission',
      });
  }
}

function hydrate(
  state: GameState,
  invoke: (input: Omit<GameCommand, 'commandId' | 'now'>) => boolean,
) {
  if ((state.inventory.water ?? 0) === 0)
    buyIfAvailable(state, 'water', 1, invoke);
  if ((state.inventory.water ?? 0) > 0)
    invoke({ type: 'use_item', itemId: 'water' });
}

function prepareInsurance(
  state: GameState,
  invoke: (input: Omit<GameCommand, 'commandId' | 'now'>) => boolean,
) {
  if ((state.inventory['insurance-card'] ?? 0) === 0 && state.balance >= 150)
    buyIfAvailable(state, 'insurance-card', 1, invoke);
}

function useOrBuy(
  state: GameState,
  itemId: string,
  invoke: (input: Omit<GameCommand, 'commandId' | 'now'>) => boolean,
  action: string,
) {
  if ((state.inventory[itemId] ?? 0) === 0)
    buyIfAvailable(state, itemId, 1, invoke);
  if ((state.inventory[itemId] ?? 0) > 0)
    invoke({ type: 'perform_item_action', itemId, action });
}

function buyIfAvailable(
  state: GameState,
  itemId: string,
  quantity: number,
  invoke: (input: Omit<GameCommand, 'commandId' | 'now'>) => boolean,
) {
  if ((state.shop.stock[itemId] ?? 0) >= quantity)
    invoke({ type: 'buy_item', itemId, quantity });
}

function riskyNutrition(state: GameState) {
  const feeds = state.history.kidneyStoneFeeds.slice(-10);
  return (
    feeds.reduce((sum, feed) => sum + feed.salt, 0) >= 6 &&
    feeds.reduce((sum, feed) => sum + feed.water, 0) <= 2
  );
}

function ownedFood(state: GameState) {
  return (
    Object.entries(state.inventory)
      .filter(([, quantity]) => quantity > 0)
      .map(([id]) => itemById.get(id))
      .filter(acceptableFood)
      .sort(
        (left, right) =>
          (right!.effects?.food?.max ?? 0) - (left!.effects?.food?.max ?? 0) ||
          left!.price - right!.price,
      )[0]?.id ?? null
  );
}

function shopFood(state: GameState, avoidSalt: boolean) {
  return (
    state.shop.itemIds
      .map((id) => itemById.get(id))
      .filter(
        (item) =>
          acceptableFood(item) &&
          (state.shop.stock[item!.id] ?? 0) > 0 &&
          item!.price <= Math.max(0, state.balance) &&
          (!avoidSalt || (item!.properties?.salt ?? 0) <= 1),
      )
      .sort((left, right) => left!.price - right!.price)[0]?.id ?? null
  );
}

function acceptableFood(item: ReturnType<typeof itemById.get>) {
  return Boolean(
    item?.edible &&
    (item.effects?.food?.max ?? 0) > 0 &&
    (item.preferences?.includes('liked') ||
      item.preferences?.includes('variable')) &&
    (item.context?.refusalProbability ?? 0) === 0,
  );
}

function usefulFoodCount(state: GameState) {
  return Object.entries(state.inventory).reduce(
    (sum, [id, quantity]) =>
      sum + (acceptableFood(itemById.get(id)) ? quantity : 0),
    0,
  );
}

function command(
  state: GameState,
  input: Omit<GameCommand, 'commandId' | 'now'>,
  ordinal: number,
) {
  const result = dispatchCommand(
    state,
    {
      ...input,
      commandId: `canonical-${ordinal}-${state.actionOrdinal}-${state.stateVersion}`,
      now: state.now,
    } as GameCommand,
    definition,
  );
  return {
    state: result.state,
    accepted: result.outcomes[0]?.accepted ?? false,
  };
}
