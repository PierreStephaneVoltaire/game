import type { GameState } from '../../../../src/lib/game-types';
import type { ItemDefinition } from '../../../../src/lib/game-definition';
import { SessionRuntime, itemById } from './balance-profile-runtime';
import type { ExpandedProfile } from './balance-profile-schema';
import { studyDefinition } from './balance-study-policy';

export function selectOwnedFood(runtime: SessionRuntime) {
  const candidates = Object.entries(runtime.state.inventory)
    .filter(([, quantity]) => quantity > 0)
    .map(([id]) => itemById(id))
    .filter(acceptableFood);
  return rankFood(candidates, runtime)[0]?.id ?? null;
}

export function selectShopFood(runtime: SessionRuntime) {
  const config = runtime.spec.config.shopping;
  const preferred = config.preferredItemIds;
  const available = runtime.state.shop.itemIds
    .map(itemById)
    .filter(
      (item) =>
        acceptableFood(item) &&
        (runtime.state.shop.stock[item!.id] ?? 0) > 0 &&
        item!.price <= spendableBalance(runtime.state, runtime.spec.config),
    );
  if (config.foodSelection === 'preferred_item') {
    const match = preferred
      .map(itemById)
      .find((item) =>
        available.some((candidate) => candidate!.id === item?.id),
      );
    if (match) return match.id;
    if (config.waitForPreferred) return null;
  }
  if (config.waitForPreferred && preferred.length) {
    const match = preferred
      .map(itemById)
      .find((item) =>
        available.some((candidate) => candidate!.id === item?.id),
      );
    if (!match) return null;
  }
  return rankFood(available, runtime)[0]?.id ?? null;
}

export function maintainFoodReserve(runtime: SessionRuntime) {
  let owned = usefulFoodCount(runtime.state);
  const target = effectiveFoodReserve(runtime);
  for (let attempts = 0; owned < target && attempts < 8; attempts += 1) {
    const itemId = selectShopFood(runtime);
    if (!itemId) break;
    const stock = runtime.state.shop.stock[itemId] ?? 0;
    const item = itemById(itemId)!;
    const affordable = Math.floor(
      spendableBalance(runtime.state, runtime.spec.config) / item.price,
    );
    const quantity = Math.min(stock, target - owned, affordable);
    if (
      quantity <= 0 ||
      !runtime.invoke({ type: 'buy_item', itemId, quantity })
    )
      break;
    owned += quantity;
  }
}

export function purchaseProfilePriorities(runtime: SessionRuntime) {
  const config = runtime.spec.config;
  if (config.behavior?.noLuxury) return;
  if (
    config.debt.strategy === 'panic_cut_spending' &&
    runtime.state.medicalDebt.length
  )
    return;
  const desired = [
    ...config.shopping.preferredItemIds.map(itemById),
    ...runtime.state.shop.itemIds
      .map(itemById)
      .filter((item) =>
        item?.tags.some((tag) => config.shopping.priorityTags.includes(tag)),
      ),
  ].filter((item): item is ItemDefinition => Boolean(item));
  const limit = config.shopping.spendAggressiveness === 'high' ? 4 : 1;
  let bought = 0;
  for (const item of uniqueItems(desired)) {
    if (bought >= limit) break;
    if ((runtime.state.inventory[item.id] ?? 0) > 0 && !item.supportsQuantity)
      continue;
    if ((runtime.state.shop.stock[item.id] ?? 0) <= 0) continue;
    if (item.tags.some((tag) => config.shopping.avoidTags.includes(tag)))
      continue;
    if (item.price > spendableBalance(runtime.state, config)) continue;
    if (runtime.invoke({ type: 'buy_item', itemId: item.id, quantity: 1 }))
      bought += 1;
  }
}

export function purchaseInsurance(runtime: SessionRuntime) {
  const config = runtime.spec.config.shopping;
  if (config.insurance === 'never') return;
  if (
    config.insurance === 'after_incident' &&
    !runtime.memory.seenMedicalIncident
  )
    return;
  if ((runtime.state.inventory['insurance-card'] ?? 0) > 0) return;
  buyIfAvailable(runtime, 'insurance-card', 1);
}

export function pursueProgression(runtime: SessionRuntime) {
  const config = runtime.spec.config;
  const targetStacks = config.career.clipperStacks ?? 0;
  const activeStacks = runtime.state.timedEffects.clippers?.stacks ?? 0;
  if (
    activeStacks < targetStacks &&
    spendableBalance(runtime.state, config) >= 25
  ) {
    if ((runtime.state.inventory.clippers ?? 0) === 0)
      buyIfAvailable(runtime, 'clippers', 1);
    if ((runtime.state.inventory.clippers ?? 0) > 0)
      runtime.invoke({
        type: 'perform_item_action',
        itemId: 'clippers',
        action: 'activate_clippers',
      });
  }
  const unfinishedModel = runtime.state.progression.unlockedModelTiers.some(
    (tier) => !runtime.state.progression.completedModelTiers.includes(tier),
  );
  if (
    unfinishedModel &&
    !runtime.state.projects.length &&
    spendableBalance(runtime.state, config) >= 300
  ) {
    if ((runtime.state.inventory['new-model-commission'] ?? 0) === 0)
      buyIfAvailable(runtime, 'new-model-commission', 1);
    if ((runtime.state.inventory['new-model-commission'] ?? 0) > 0)
      runtime.invoke({
        type: 'perform_item_action',
        itemId: 'new-model-commission',
        action: 'start_model_commission',
      });
  }
}

export function placeBestRoomItem(runtime: SessionRuntime) {
  if (
    !runtime.spec.config.shopping.placeRoomItems &&
    !runtime.spec.config.behavior?.optimizeRoom
  )
    return;
  const candidates = Object.entries(runtime.state.inventory)
    .filter(([, quantity]) => quantity > 0)
    .map(([id]) => itemById(id))
    .filter((item): item is ItemDefinition => Boolean(item?.roomSlot))
    .sort((left, right) => roomScore(right) - roomScore(left));
  const item = candidates.find(
    (candidate) => runtime.state.room[candidate.roomSlot!] !== candidate.id,
  );
  if (item)
    runtime.invoke({
      type: 'place_item',
      itemId: item.id,
      slot: item.roomSlot!,
    });
}

export function useNovelItem(runtime: SessionRuntime) {
  if (
    !runtime.spec.config.behavior?.useNewItems &&
    !runtime.spec.config.behavior?.clickEverything
  )
    return;
  const item = studyDefinition.items.find(
    (candidate) =>
      (runtime.state.inventory[candidate.id] ?? 0) > 0 &&
      candidate.itemActions?.length &&
      !runtime.memory.manuallyTriedItemIds.includes(candidate.id) &&
      !candidate.edible,
  );
  if (!item) return;
  runtime.memory.manuallyTriedItemIds.push(item.id);
  runtime.invoke({
    type: 'perform_item_action',
    itemId: item.id,
    action: item.itemActions![0].id,
  });
}

export function buyIfAvailable(
  runtime: SessionRuntime,
  itemId: string,
  quantity: number,
) {
  const item = itemById(itemId);
  if (
    item &&
    (runtime.state.shop.stock[itemId] ?? 0) >= quantity &&
    item.price * quantity <=
      spendableBalance(runtime.state, runtime.spec.config)
  )
    return runtime.invoke({ type: 'buy_item', itemId, quantity });
  return false;
}

export function acceptableFood(
  item: ItemDefinition | undefined,
): item is ItemDefinition {
  return Boolean(
    item?.edible &&
    (item.effects?.food?.max ?? 0) > 0 &&
    (item.preferences?.includes('liked') ||
      item.preferences?.includes('variable')) &&
    (item.context?.refusalProbability ?? 0) === 0,
  );
}

function rankFood(items: ItemDefinition[], runtime: SessionRuntime) {
  const strategy = runtime.spec.config.shopping.foodSelection;
  const learnedProtein =
    runtime.spec.config.behavior?.learnAfterSugarCrash &&
    runtime.memory.seenSugarCrash;
  return [...items].sort((left, right) => {
    if (strategy === 'favorite_repeat' && runtime.memory.lastFoodId)
      return (
        Number(right.id === runtime.memory.lastFoodId) -
        Number(left.id === runtime.memory.lastFoodId)
      );
    if (strategy === 'preferred_item' && !learnedProtein) {
      const preferred = runtime.spec.config.shopping.preferredItemIds;
      return preferred.indexOf(left.id) - preferred.indexOf(right.id);
    }
    if (strategy === 'varied')
      return (
        (runtime.memory.foodUseCounts[left.id] ?? 0) -
        (runtime.memory.foodUseCounts[right.id] ?? 0)
      );
    if (strategy === 'cheap')
      return left.price / foodGain(left) - right.price / foodGain(right);
    if (strategy === 'food_gain')
      return foodGain(right) - foodGain(left) || left.price - right.price;
    if (strategy === 'nutrition_safe' || learnedProtein)
      return (
        nutritionRisk(left) - nutritionRisk(right) ||
        foodGain(right) - foodGain(left)
      );
    return (
      preferenceScore(right) - preferenceScore(left) ||
      foodGain(right) - foodGain(left)
    );
  });
}

function effectiveFoodReserve(runtime: SessionRuntime) {
  if (
    runtime.spec.config.debt.strategy === 'panic_cut_spending' &&
    runtime.state.medicalDebt.length
  )
    return Math.min(4, runtime.spec.config.shopping.foodReserve);
  return runtime.spec.config.shopping.foodReserve;
}

function spendableBalance(state: GameState, config: ExpandedProfile) {
  return Math.max(0, state.balance - config.shopping.minimumCashReserve);
}

function usefulFoodCount(state: GameState) {
  return Object.entries(state.inventory).reduce(
    (sum, [id, quantity]) =>
      sum + (acceptableFood(itemById(id)) ? quantity : 0),
    0,
  );
}

function nutritionRisk(item: ItemDefinition) {
  const values = item.properties;
  return (
    (values?.salt ?? 0) * 3 +
    Math.max(0, (values?.sugar ?? 0) - (values?.protein ?? 0)) * 2 -
    (values?.water ?? 0)
  );
}

function preferenceScore(item: ItemDefinition) {
  return (
    Number(item.tags.includes('favorite')) * 3 +
    Number(item.preferences?.includes('liked')) * 2
  );
}

function foodGain(item: ItemDefinition) {
  return Math.max(1, item.effects?.food?.max ?? 0);
}

function roomScore(item: ItemDefinition) {
  return Object.values(item.roomEffects ?? {}).reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );
}

function uniqueItems(items: ItemDefinition[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
