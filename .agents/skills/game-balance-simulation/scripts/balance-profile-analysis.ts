import type { GameEvent, GameState } from '../../../../src/lib/game-types';
import { HOUR_MS } from '../../../../src/lib/game-constants';
import type { RunTrace } from './balance-study-contract';

export function healthProfileAnalysis(trace: RunTrace) {
  const samples = trace.behavior?.metricSamples ?? [
    { at: trace.state.now, health: trace.state.metrics.health },
  ];
  return {
    minimum: Math.min(...samples.map((sample) => sample.health)),
    ending: trace.state.metrics.health,
    totalRecovery: trace.state.events.reduce(
      (sum, event) => sum + (event.healthRecovery ?? 0),
      0,
    ),
    hoursAtOrBelow8: round(hoursBelow(samples, 8), 2),
  };
}

export function careProfileAnalysis(trace: RunTrace) {
  const behavior = trace.behavior;
  const actions = behavior?.careActions ?? {};
  const total = Object.values(actions).reduce((sum, value) => sum + value, 0);
  return {
    actions,
    meanMetricsBeforeCare: Object.fromEntries(
      Object.entries(behavior?.preCareMetrics ?? {}).map(([metric, value]) => [
        metric,
        round(value.total / value.samples, 2),
      ]),
    ),
    visitsWithNoCare: behavior?.visitsWithNoCare ?? 0,
    actionsPerAttendedVisit: trace.checks.attended
      ? round(total / trace.checks.attended, 3)
      : 0,
    attempts: behavior?.actionAttempts ?? {},
    accepted: behavior?.acceptedActions ?? {},
    rejected: behavior?.rejectedActions ?? {},
  };
}

export function nutritionProfileAnalysis(trace: RunTrace) {
  const events = trace.state.events;
  return {
    sugarWarnings: count(events, 'sugar_crash_warning'),
    aversions: events.filter(
      (event) =>
        event.type === 'item_rejected' || event.outcomeKind === 'refused',
    ).length,
    sugarCrashes: count(events, 'sugar_crash'),
    proteinCancellations: count(events, 'sugar_crash_averted'),
    riskyKidneyWindows: riskyKidneyWindows(trace.state),
    kidneyWarnings: count(events, 'kidney_stone_risk_warning'),
    waterResponsesAfterWarning: trace.behavior?.waterResponsesAfterWarning ?? 0,
    proteinResponsesAfterWarning:
      trace.behavior?.proteinResponsesAfterWarning ?? 0,
    stoneOnsets: count(events, 'kidney_stone_onset'),
    composition: consumptionComposition(trace.state),
  };
}

export function economyProfileAnalysis(trace: RunTrace) {
  const samples = trace.behavior?.balanceSamples ?? [
    { at: trace.state.now, balance: trace.state.balance },
  ];
  return {
    spendingByCategory: trace.behavior?.purchasesByCategory ?? {},
    minimumCash: Math.min(...samples.map((sample) => sample.balance)),
    hoursBelow10: round(hoursBelow(samples, 9.999), 2),
    lowMoneyStressEvents: trace.state.events.filter(
      (event) => event.cause === 'low_money_stress',
    ).length,
  };
}

export function autonomyProfileAnalysis(events: GameEvent[]) {
  const outcomeIds = events.flatMap((event) =>
    event.selectedOutcomeId ? [event.selectedOutcomeId] : [],
  );
  const selected = events.filter(
    (event) => event.type === 'random_event_opportunity',
  );
  return {
    positiveMoodEvents: events.filter(
      (event) => (event.metricDeltas?.mood ?? 0) > 0 && event.selectedOutcomeId,
    ).length,
    negativeEvents: events.filter(
      (event) =>
        Object.values(event.metricDeltas ?? {}).some(
          (value) => (value ?? 0) < 0,
        ) && event.selectedOutcomeId,
    ).length,
    readingEvents: selected.filter((event) =>
      ['book', 'manga', 'really-long-book', 'visual-novel'].some((id) =>
        (event.cause ?? '').includes(id),
      ),
    ).length,
    itemEvents: selected.filter((event) =>
      ['cozy-game', 'sketchbook', 'coloring-book', 'can-opener'].some((id) =>
        (event.cause ?? '').includes(id),
      ),
    ).length,
    sideGigIncome: events
      .filter((event) =>
        ['small-emote-commission', 'merch-sample-sale'].some((id) =>
          (event.cause ?? event.selectedOutcomeId ?? '').includes(id),
        ),
      )
      .reduce((sum, event) => sum + Math.max(0, event.amount ?? 0), 0),
    injuryEvents: events.filter((event) =>
      (event.healthDamageSources ?? []).some(
        (source) => source.kind === 'event',
      ),
    ).length,
    movementEvents: events.filter((event) =>
      ['tiny_walk', 'barely_moved_today'].includes(event.cause ?? ''),
    ).length,
    selectedOutcomeIds: frequency(outcomeIds),
  };
}

export function rescueProfileAnalysis(trace: RunTrace) {
  const end = trace.state.ending?.at ?? trace.state.now;
  const rescueEvents = trace.state.events.filter(
    (event) =>
      event.type === 'autonomous_food_rescue' ||
      (event.type === 'activity_started' && event.rescueMetric === 'rest'),
  );
  return {
    lockResets: trace.behavior?.rescueLockResets ?? { food: 0, rest: 0 },
    hoursToNextPlayerCare: trace.behavior?.rescueToPlayerCareHours ?? {
      food: [],
      rest: [],
    },
    survivedNext12Hours: rescueEvents.filter(
      (event) => end - event.at >= 12 * HOUR_MS,
    ).length,
    survivedNext24Hours: rescueEvents.filter(
      (event) => end - event.at >= 24 * HOUR_MS,
    ).length,
  };
}

function riskyKidneyWindows(state: GameState) {
  const rolling: typeof state.history.kidneyStoneFeeds = [];
  let risky = 0;
  for (const feed of state.history.kidneyStoneFeeds) {
    rolling.push(feed);
    if (rolling.length > 10) rolling.shift();
    if (
      rolling.reduce((sum, value) => sum + value.salt, 0) >= 10 &&
      rolling.reduce((sum, value) => sum + value.water, 0) <= 2
    )
      risky += 1;
  }
  return risky;
}

function consumptionComposition(state: GameState) {
  return state.history.consumptions.reduce(
    (totals, entry) => ({
      sugar: totals.sugar + entry.sugar,
      protein: totals.protein + entry.protein,
      salt: totals.salt + entry.salt,
      water: totals.water + entry.water,
    }),
    { sugar: 0, protein: 0, salt: 0, water: 0 },
  );
}

function hoursBelow(
  samples: Array<{ at: number; health?: number; balance?: number }>,
  threshold: number,
) {
  let hours = 0;
  for (let index = 0; index < samples.length - 1; index += 1) {
    const value = samples[index].health ?? samples[index].balance ?? 0;
    if (value <= threshold)
      hours += (samples[index + 1].at - samples[index].at) / HOUR_MS;
  }
  return Math.max(0, hours);
}

function count(events: GameEvent[], type: string) {
  return events.filter((event) => event.type === type).length;
}

function frequency(values: string[]) {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
