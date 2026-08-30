import {
  HOUR_MS,
  LINE_OF_CREDIT_OFFER_ID,
} from '../../../../src/lib/game-constants';
import type { MetricName } from '../../../../src/lib/game-types';
import { SessionRuntime, increment, itemById } from './balance-profile-runtime';
import type { ExpandedProfile } from './balance-profile-schema';
import {
  buyIfAvailable,
  selectOwnedFood,
  selectShopFood,
} from './balance-profile-shopping';

export function respondToNutrition(runtime: SessionRuntime) {
  const strategy = runtime.spec.config.nutrition.strategy;
  if (
    (strategy === 'protein_counter' || strategy === 'risk_minimizer') &&
    runtime.state.history.sugarCrashDueAt !== null
  ) {
    for (
      let attempts = 0;
      attempts < 3 && effectiveSugar(runtime) >= 4;
      attempts += 1
    ) {
      const protein = findNutritionItem(runtime, 'protein');
      if (!protein) break;
      const before = runtime.state.history.sugarCrashDueAt;
      if (!ensureAndUse(runtime, protein)) break;
      if (before !== null) runtime.behavior.proteinResponsesAfterWarning += 1;
    }
  }
  if (
    (strategy === 'warning_hydrator' || strategy === 'risk_minimizer') &&
    riskyKidneyWindow(runtime)
  ) {
    const before = runtime.state.history.kidneyStoneFeeds.length;
    if (ensureAndUse(runtime, 'water') && before > 0)
      runtime.behavior.waterResponsesAfterWarning += 1;
  }
}

export function respondToMedical(runtime: SessionRuntime) {
  const stone = runtime.state.statuses.kidney_stone;
  const sick = runtime.state.statuses.sick;
  if (!stone && !sick) return false;
  increment(runtime.behavior.hospitalDecisions, 'condition_observed');
  const config = runtime.spec.config.medical;
  if (config.strategy === 'unaware') return false;
  if (config.strategy !== 'immediate_hospital') ensureAndUse(runtime, 'water');
  if (
    stone &&
    [
      'wait',
      'painkiller',
      'never_hospital',
      'delayed_hospital',
      'critical_hospital',
    ].includes(config.strategy)
  ) {
    if (ensurePainkiller(runtime)) runtime.memory.painkillerCycles += 1;
  }
  const age = stone ? runtime.state.now - stone.since : 0;
  const hospital =
    config.strategy === 'immediate_hospital' ||
    (config.strategy === 'delayed_hospital' &&
      age >= (config.hospitalDelayHours ?? 48) * HOUR_MS) ||
    (config.strategy === 'critical_hospital' &&
      runtime.state.metrics.health < (config.healthThreshold ?? 15)) ||
    (config.strategy === 'painkiller' &&
      runtime.memory.painkillerCycles >= (config.painkillerCycles ?? 3) &&
      age >= (config.hospitalDelayHours ?? 0) * HOUR_MS);
  if (!hospital || config.strategy === 'never_hospital') {
    increment(runtime.behavior.hospitalDecisions, 'waited');
    return false;
  }
  const accepted = runtime.invoke({ type: 'medical_care' });
  increment(
    runtime.behavior.hospitalDecisions,
    accepted ? 'hospital_started' : 'hospital_rejected',
  );
  if (accepted) runtime.memory.painkillerCycles = 0;
  return accepted;
}

export function payDebtIfPlanned(runtime: SessionRuntime) {
  const strategy = runtime.spec.config.debt.strategy;
  if (strategy.startsWith('loc_')) manageLineOfCredit(runtime, strategy);
  const principal = runtime.state.medicalDebt.reduce(
    (sum, bill) => sum + bill.remainingPrincipal,
    0,
  );
  if (!principal) return;
  if (!['full_pay_when_affordable', 'panic_cut_spending'].includes(strategy))
    return;
  if (runtime.state.balance >= Math.ceil(principal * 0.85))
    runtime.invoke({ type: 'pay_medical_debt' });
}

function manageLineOfCredit(
  runtime: SessionRuntime,
  strategy: Extract<
    ExpandedProfile['debt']['strategy'],
    | 'loc_immediate_clear'
    | 'loc_clipper_gambler'
    | 'loc_never_repay'
    | 'loc_partial_trap'
  >,
) {
  const loc = runtime.state.lineOfCredit;
  if (
    loc.status === 'available' &&
    runtime.state.balance >=
      (strategy === 'loc_partial_trap'
        ? 15_000
        : strategy === 'loc_clipper_gambler'
          ? 0
          : strategy === 'loc_never_repay'
            ? 50
            : 2_050) &&
    (strategy !== 'loc_clipper_gambler' ||
      runtime.state.progression.followers >= 1_000)
  ) {
    checkoutLineOfCredit(runtime, 1);
  }
  const opened = runtime.state.lineOfCredit;
  if (opened.status !== 'open') return;
  const unitPrice = 600;
  const quantity =
    strategy === 'loc_never_repay'
      ? 0
      : strategy === 'loc_partial_trap'
        ? opened.remainingUnits === 20
          ? 19
          : 0
        : strategy === 'loc_immediate_clear'
          ? opened.remainingUnits
          : runtime.state.progression.followers >= 500_000
            ? Math.min(
                opened.remainingUnits,
                Math.floor(runtime.state.balance / unitPrice),
              )
            : 0;
  if (quantity > 0 && runtime.state.balance >= quantity * unitPrice)
    checkoutLineOfCredit(runtime, quantity);
}

function checkoutLineOfCredit(runtime: SessionRuntime, quantity: number) {
  if (
    !runtime.invoke({
      type: 'set_cart_quantity',
      itemId: LINE_OF_CREDIT_OFFER_ID,
      quantity,
    })
  )
    return false;
  return runtime.invoke({ type: 'checkout_cart' });
}

export function performCare(runtime: SessionRuntime) {
  const config = runtime.spec.config.care;
  const before = totalCareActions(runtime);
  const limit =
    config.actionsPerVisit === 'until_safe' ? 8 : config.actionsPerVisit;
  for (let count = 0; count < limit; count += 1) {
    const metric = nextCareMetric(runtime);
    if (!metric) break;
    const timed = performMetricCare(runtime, metric);
    if (runtime.state.ending || timed) break;
  }
  const actions = totalCareActions(runtime) - before;
  if (actions === 0) runtime.behavior.visitsWithNoCare += 1;
  return actions;
}

export function performCareerActivity(runtime: SessionRuntime) {
  const career = runtime.spec.config.career;
  if (career.strategy === 'none') return false;
  if (career.eveningOnly && localHour(runtime.state.now) < 18) return false;
  if (career.weekendHeavy && !isWeekend(runtime.state.now)) return false;
  if (career.strategy === 'healthy_only' && !careerHealthy(runtime))
    return false;
  if (
    career.strategy === 'stream_when_possible' &&
    (runtime.state.metrics.food < (career.minimumFood ?? 1) ||
      runtime.state.metrics.rest < (career.minimumRest ?? 1) ||
      runtime.state.metrics.health < (career.minimumHealth ?? 10))
  )
    return false;
  const action = runtime.state.metrics.creativity < 7 ? 'socialize' : 'play';
  return runtime.invoke({ type: action });
}

function nextCareMetric(runtime: SessionRuntime) {
  const care = runtime.spec.config.care;
  const metrics = runtime.state.metrics;
  if (
    care.strategy === 'health_reactive' &&
    metrics.health >= (care.healthPanicThreshold ?? 30)
  )
    return null;
  const dangerous = Boolean(
    runtime.state.statuses.kidney_stone || runtime.state.statuses.sick,
  );
  if (care.strategy === 'critical_only' && !dangerous) {
    if (
      metrics.food > care.foodThreshold &&
      metrics.rest > care.restThreshold &&
      metrics.mood > care.moodThreshold
    )
      return null;
  }
  const restricted = restrictedMetrics(runtime);
  const thresholds = {
    food: care.targetFood ?? care.foodThreshold,
    rest: care.targetRest ?? care.restThreshold,
    mood: care.targetMood ?? care.moodThreshold,
    bond: 3,
  };
  if (care.strategy === 'rescue_learner') {
    if (runtime.state.history.autonomousRescue.foodLocked) thresholds.food = 1;
    if (runtime.state.history.autonomousRescue.restLocked) thresholds.rest = 1;
  }
  if (care.strategy === 'rescue_exploit') {
    thresholds.food = runtime.state.history.autonomousRescue.foodLocked ? 5 : 1;
    thresholds.rest = runtime.state.history.autonomousRescue.restLocked ? 5 : 1;
  }
  const eligible = care.priority.filter(
    (metric) =>
      !restricted.has(metric) && needsCare(runtime, metric, thresholds[metric]),
  );
  if (!eligible.length) return null;
  if (care.strategy === 'worst_only' || care.strategy === 'health_reactive')
    return [...eligible].sort(
      (left, right) =>
        metrics[left] - metrics[right] ||
        care.priority.indexOf(left) - care.priority.indexOf(right),
    )[0];
  return eligible[0];
}

function performMetricCare(
  runtime: SessionRuntime,
  metric: 'food' | 'rest' | 'mood' | 'bond',
) {
  if (metric === 'food') {
    const target = desiredFoodTarget(runtime);
    for (
      let feeds = 0;
      feeds < 4 && runtime.state.metrics.food < target;
      feeds += 1
    ) {
      let food = selectOwnedFood(runtime);
      if (!food) {
        food = selectShopFood(runtime);
        if (
          !food ||
          !runtime.invoke({ type: 'buy_item', itemId: food, quantity: 1 })
        )
          break;
      }
      if (!runtime.invoke({ type: 'use_item', itemId: food })) break;
    }
    return false;
  }
  if (metric === 'rest') return runtime.invoke({ type: 'rest' });
  if (metric === 'mood') return runtime.invoke({ type: 'play' });
  return runtime.invoke({ type: 'socialize' });
}

function needsCare(
  runtime: SessionRuntime,
  metric: 'food' | 'rest' | 'mood' | 'bond',
  threshold: number,
) {
  const value = runtime.state.metrics[metric];
  return runtime.spec.config.care.strategy === 'top_up' ||
    runtime.spec.config.care.strategy === 'minimal'
    ? value < threshold
    : value <= threshold;
}

function desiredFoodTarget(runtime: SessionRuntime) {
  const care = runtime.spec.config.care;
  if (care.strategy === 'rescue_exploit')
    return runtime.state.history.autonomousRescue.foodLocked ? 5 : 2;
  if (care.targetFood !== undefined) return care.targetFood;
  return care.foodThreshold + 1;
}

function ensurePainkiller(runtime: SessionRuntime) {
  if ((runtime.state.inventory.painkillers ?? 0) === 0)
    buyIfAvailable(runtime, 'painkillers', 1);
  if ((runtime.state.inventory.painkillers ?? 0) === 0) return false;
  return runtime.invoke({
    type: 'perform_item_action',
    itemId: 'painkillers',
    action: 'take_painkillers',
  });
}

function ensureAndUse(runtime: SessionRuntime, itemId: string) {
  if ((runtime.state.inventory[itemId] ?? 0) === 0)
    buyIfAvailable(runtime, itemId, 1);
  return (runtime.state.inventory[itemId] ?? 0) > 0
    ? runtime.invoke({ type: 'use_item', itemId })
    : false;
}

function findNutritionItem(runtime: SessionRuntime, nutrient: 'protein') {
  return (
    Object.entries(runtime.state.inventory)
      .filter(([, quantity]) => quantity > 0)
      .map(([id]) => itemById(id))
      .filter((item) => item?.edible && (item.properties?.[nutrient] ?? 0) > 0)
      .sort(
        (left, right) =>
          (right!.properties?.[nutrient] ?? 0) -
          (left!.properties?.[nutrient] ?? 0),
      )[0]?.id ?? null
  );
}

function effectiveSugar(runtime: SessionRuntime) {
  const recent = runtime.state.history.consumptions.filter(
    (entry) => runtime.state.now - entry.at <= 6 * HOUR_MS,
  );
  const sugar = recent.reduce((sum, entry) => sum + entry.sugar, 0);
  const protein = recent.reduce((sum, entry) => sum + entry.protein, 0);
  return Math.max(0, sugar - protein);
}

function riskyKidneyWindow(runtime: SessionRuntime) {
  const feeds = runtime.state.history.kidneyStoneFeeds.slice(-10);
  return (
    feeds.reduce((sum, feed) => sum + feed.salt, 0) >= 6 &&
    feeds.reduce((sum, feed) => sum + feed.water, 0) <= 2
  );
}

function restrictedMetrics(runtime: SessionRuntime) {
  const result = new Set<MetricName>();
  const weekday = !isWeekend(runtime.state.now);
  if (runtime.spec.config.care.weekdayCoreOnly && weekday) {
    result.add('mood');
    result.add('bond');
  }
  if (
    runtime.spec.config.care.weekdayQuickOnly &&
    weekday &&
    localHour(runtime.state.now) >= 11 &&
    localHour(runtime.state.now) <= 14
  ) {
    result.add('rest');
    result.add('mood');
    result.add('bond');
  }
  return result;
}

function careerHealthy(runtime: SessionRuntime) {
  const config = runtime.spec.config.career;
  return (
    runtime.state.metrics.food >= (config.minimumFood ?? 6) &&
    runtime.state.metrics.rest >= (config.minimumRest ?? 6) &&
    runtime.state.metrics.mood >= (config.minimumMood ?? 5) &&
    runtime.state.metrics.health >= (config.minimumHealth ?? 30) &&
    !runtime.state.statuses.kidney_stone &&
    !runtime.state.statuses.sick
  );
}

function totalCareActions(runtime: SessionRuntime) {
  return Object.values(runtime.behavior.careActions).reduce(
    (sum, value) => sum + value,
    0,
  );
}

function localHour(at: number) {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Toronto',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(at),
  );
}

function isWeekend(at: number) {
  return ['Sat', 'Sun'].includes(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Toronto',
      weekday: 'short',
    }).format(at),
  );
}
