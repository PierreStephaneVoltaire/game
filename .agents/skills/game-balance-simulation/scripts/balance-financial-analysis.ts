import financialRules from '../../../../src/lib/data/financial-rules.json';
import type { GameEvent, GameState, MetricName } from '../../../../src/lib/game-types';
import { debtBreakdown } from '../../../../src/lib/financial-rules';
import { DAY_MS, STUDY_START } from './balance-study-policy';

export function financialAnalysis(state: GameState, end: number) {
  const events = state.events;
  const debtEffects = events.flatMap((event) =>
    event.financialEffect ? [event.financialEffect] : [],
  );
  const entries = events.filter((event) => event.type === 'debt_status_entered');
  const ruin = state.ending?.kind === 'financial_ruin' ? state.ending : null;
  const trigger = ruin
    ? events.find((event) => event.id === ruin.triggerEventId)
    : undefined;
  const creditSpendingByCategory: Record<string, number> = {};
  for (const effect of debtEffects) {
    if (effect.kind !== 'shop_purchase') continue;
    const financed = Math.max(
      0,
      effect.after.negativeCash - effect.before.negativeCash,
    );
    const category = effect.purchaseCategory ?? 'unknown';
    creditSpendingByCategory[category] =
      (creditSpendingByCategory[category] ?? 0) + financed;
  }
  const locRepayments = events.filter(
    (event) => event.type === 'line_of_credit_repaid',
  );
  const locOpened = events.some((event) => event.type === 'line_of_credit_opened');
  const loc = state.lineOfCredit;
  const debtCrossings = Object.fromEntries(
    [10_000, 15_000, 20_000].map((threshold) => {
      const crossing = events.find(
        (event) => (event.financialEffect?.after.total ?? 0) >= threshold,
      );
      return [
        String(threshold),
        crossing ? round((crossing.at - STUDY_START) / DAY_MS, 3) : null,
      ];
    }),
  );
  return {
    endingDebt: debtBreakdown(state),
    peakTotalDebt: Math.max(
      0,
      ...debtEffects.map((effect) => effect.after.total),
    ),
    firstInDebtDay: entries[0]
      ? round((entries[0].at - STUDY_START) / DAY_MS, 3)
      : null,
    hoursInDebt: round(debtStatusHours(events, end), 2),
    debtCrossings,
    financialRuinTrigger: trigger
      ? {
          eventId: trigger.id,
          eventType: trigger.type,
          kind: trigger.financialEffect?.kind ?? null,
          lifeEventId: trigger.lifeEventId ?? null,
        }
      : null,
    creditSpendingByCategory,
    lineOfCredit: {
      opened: locOpened,
      repaymentUnitsPurchased: locRepayments.reduce(
        (sum, event) =>
          sum +
          Math.max(0, -(event.amount ?? 0)) /
            financialRules.lineOfCredit.repaymentUnitPrice,
        0,
      ),
      remainingUnits: loc.status === 'open' ? loc.remainingUnits : 0,
      remainingClosureCost:
        loc.status === 'open' ? loc.remainingClosureCost : 0,
      closed: loc.status === 'closed',
    },
  };
}

export function lifeEventAnalysis(state: GameState, end: number) {
  const events = state.events.filter(
    (event) => event.type === 'life_event_resolved',
  );
  const metrics = Object.fromEntries(
    (['food', 'health', 'mood', 'rest', 'bond', 'creativity'] as MetricName[]).map(
      (metric) => [
        metric,
        {
          additions: sumSigned(events, (event) => event.metricDeltas?.[metric] ?? 0, true),
          losses: sumSigned(events, (event) => event.metricDeltas?.[metric] ?? 0, false),
        },
      ],
    ),
  );
  const boostEvents = events.filter(
    (event) => (event.followerGrowthMultiplier ?? 0) > 0,
  );
  const impacts: Record<
    string,
    {
      resolutions: number;
      metrics: Record<string, number>;
      cash: number;
      followers: number;
      outcomes: Record<string, number>;
    }
  > = {};
  for (const event of events) {
    const id = event.lifeEventId ?? 'unknown';
    const impact = (impacts[id] ??= {
      resolutions: 0,
      metrics: {},
      cash: 0,
      followers: 0,
      outcomes: {},
    });
    impact.resolutions += 1;
    impact.cash += event.cashDelta ?? 0;
    impact.followers += event.followerDelta ?? 0;
    for (const [metric, delta] of Object.entries(event.metricDeltas ?? {}))
      impact.metrics[metric] = (impact.metrics[metric] ?? 0) + (delta ?? 0);
    if (event.selectedOutcomeId)
      impact.outcomes[event.selectedOutcomeId] =
        (impact.outcomes[event.selectedOutcomeId] ?? 0) + 1;
  }
  return {
    counts: frequency(events.map((event) => event.lifeEventId ?? 'unknown')),
    metrics,
    cashAdditions: sumSigned(events, (event) => event.cashDelta ?? 0, true),
    cashSubtractions: sumSigned(events, (event) => event.cashDelta ?? 0, false),
    subscriberAdditions: sumSigned(events, (event) => event.followerDelta ?? 0, true),
    subscriberLosses: sumSigned(events, (event) => event.followerDelta ?? 0, false),
    impacts,
    discoveryBoosts: boostEvents.length,
    discoveryBoostExposureHours: round(
      boostEvents.reduce(
        (sum, event) =>
          sum +
          Math.max(
            0,
            Math.min(
              (event.followerGrowthDurationHours ?? 0) * 3_600_000,
              end - event.at,
            ),
          ) /
            3_600_000,
        0,
      ),
      2,
    ),
  };
}

function debtStatusHours(events: GameEvent[], end: number) {
  let since: number | null = null;
  let hours = 0;
  for (const event of events) {
    if (event.type === 'debt_status_entered' && since === null) since = event.at;
    if (event.type === 'debt_status_recovered' && since !== null) {
      hours += (event.at - since) / 3_600_000;
      since = null;
    }
  }
  return hours + (since === null ? 0 : (end - since) / 3_600_000);
}

function sumSigned(
  events: GameEvent[],
  value: (event: GameEvent) => number,
  positive: boolean,
) {
  return events.reduce((sum, event) => {
    const amount = value(event);
    return sum + (positive ? Math.max(0, amount) : Math.max(0, -amount));
  }, 0);
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
