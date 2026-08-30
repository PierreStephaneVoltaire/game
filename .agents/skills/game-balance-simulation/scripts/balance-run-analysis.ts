import type { GameEvent, GameState } from '../../../../src/lib/game-types';
import rules from '../../../../src/lib/data/simulation-rules.json';
import financialRules from '../../../../src/lib/data/financial-rules.json';
import {
  DAY_MS,
  STUDY_START,
  studyDefinition,
} from './balance-study-policy';

const itemByName = new Map(
  studyDefinition.items.map((item) => [item.name, item]),
);

export function kidneyAnalysis(events: GameEvent[]) {
  const feeds = events.filter(
    (event) => event.type === 'item_used' && event.cause === 'consume',
  );
  const rolling: Array<{ event: GameEvent; salt: number; water: number }> = [];
  let riskyFeeds = 0;
  let manualFeeds = 0;
  for (const event of feeds) {
    const item = itemByName.get(event.itemName ?? '');
    rolling.push({
      event,
      salt: item?.properties?.salt ?? 0,
      water: item?.properties?.water ?? 0,
    });
    if (rolling.length > 10) rolling.shift();
    if (!event.sourceActionId?.startsWith('autonomous-')) manualFeeds += 1;
    if (
      rolling.reduce((sum, feed) => sum + feed.salt, 0) >=
        rules.kidneyStone.saltThreshold &&
      rolling.reduce((sum, feed) => sum + feed.water, 0) <=
        rules.kidneyStone.waterThreshold
    )
      riskyFeeds += 1;
  }
  const onsets = events.filter((event) => event.type === 'kidney_stone_onset');
  const episodes = onsets.map((onset, index) => {
    const nextOnsetAt = onsets[index + 1]?.at ?? Number.POSITIVE_INFINITY;
    const priorFeeds = feeds.filter((feed) => feed.at <= onset.at).slice(-10);
    const trigger = priorFeeds.at(-1);
    const windowItems = priorFeeds.map((feed) =>
      itemByName.get(feed.itemName ?? ''),
    );
    const clear = events.find(
      (event) =>
        event.type === 'status_cleared' &&
        event.status === 'kidney_stone' &&
        event.at >= onset.at &&
        event.at < nextOnsetAt,
    );
    const hospital = events.find(
      (event) =>
        event.type === 'activity_completed' &&
        event.activityType === 'medical_care' &&
        event.at >= onset.at &&
        event.at < nextOnsetAt,
    );
    const bill = events.find(
      (event) =>
        event.type === 'medical_debt_created' &&
        event.at >= onset.at &&
        event.at < nextOnsetAt,
    );
    return {
      onsetDay: round((onset.at - STUDY_START) / DAY_MS, 3),
      triggerItem: trigger?.itemName ?? null,
      windowSalt: windowItems.reduce(
        (sum, item) => sum + (item?.properties?.salt ?? 0),
        0,
      ),
      windowWater: windowItems.reduce(
        (sum, item) => sum + (item?.properties?.water ?? 0),
        0,
      ),
      recurrences: events.filter(
        (event) =>
          event.type === 'kidney_stone_recurrence' &&
          event.at > onset.at &&
          event.at < (clear?.at ?? nextOnsetAt),
      ).length,
      painReliefUses: events.filter(
        (event) =>
          event.type === 'item_used' &&
          event.cause === 'take_painkillers' &&
          event.at >= onset.at &&
          event.at < nextOnsetAt,
      ).length,
      clearance: hospital ? 'hospital' : clear ? 'natural' : 'active_at_end',
      clearedDay: clear ? round((clear.at - STUDY_START) / DAY_MS, 3) : null,
      billPrincipal: bill?.amount ?? 0,
      insured: bill?.amount === 500,
    };
  });
  return {
    episodes,
    summary: {
      successfulFeeds: feeds.length,
      manualFeeds,
      riskyFeeds,
      onsets: onsets.length,
      recurrences: count(events, 'kidney_stone_recurrence'),
      naturalClears: episodes.filter(
        (episode) => episode.clearance === 'natural',
      ).length,
      hospitalClears: episodes.filter(
        (episode) => episode.clearance === 'hospital',
      ).length,
      activeAtEnd: episodes.filter(
        (episode) => episode.clearance === 'active_at_end',
      ).length,
    },
  };
}

export function statusHours(events: GameEvent[], end: number) {
  const active = new Map<string, number>();
  const totals: Record<string, number> = {};
  for (const event of [...events].sort((left, right) => left.at - right.at)) {
    if (!event.status) continue;
    if (event.type === 'status_added' || event.type === 'status_onset') {
      if (!active.has(event.status)) active.set(event.status, event.at);
    } else if (event.type === 'status_cleared') {
      const since = active.get(event.status);
      if (since !== undefined) {
        totals[event.status] =
          (totals[event.status] ?? 0) + (event.at - since) / 3_600_000;
        active.delete(event.status);
      }
    }
  }
  for (const [status, since] of active)
    totals[status] = (totals[status] ?? 0) + (end - since) / 3_600_000;
  return Object.fromEntries(
    Object.entries(totals).map(([status, hours]) => [status, round(hours, 2)]),
  );
}

export function healthDamage(events: GameEvent[], raw = false) {
  const totals: Record<string, number> = {};
  for (const event of events)
    for (const source of raw
      ? event.rawNeedDamageSources ?? []
      : event.healthDamageSources ?? [])
      totals[source.id] = (totals[source.id] ?? 0) + source.amount;
  return totals;
}

export function economy(state: GameState) {
  const events = state.events;
  const shop = events.reduce(
    (sum, event) =>
      sum +
      (event.purchases ?? []).reduce((subtotal, purchase) => {
        const item = studyDefinition.items.find(
          (candidate) => candidate.id === purchase.itemId,
        );
        return subtotal + (item?.price ?? 0) * purchase.quantity;
      }, 0),
    0,
  );
  const hospital = events
    .filter((event) =>
      ['medical_debt_daily_payment', 'medical_debt_paid_in_full'].includes(
        event.type,
      ),
    )
    .reduce((sum, event) => sum + Math.max(0, -(event.amount ?? 0)), 0);
  const income = {
    stream: 0,
    donations: sumAmount(events, 'donation_received'),
    subscriberRevenue: sumAmount(events, 'subscriber_revenue'),
    offStreamSupport: sumAmount(events, 'off_stream_support'),
    appearances:
      events.filter(
        (event) =>
          event.type === 'career_milestone' &&
          event.cause === 'convention_guest',
      ).length * 500,
    commissions: sumAmount(events, 'full_body_project_completed'),
    projects: sumAmount(events, 'project_completed'),
    lifeEvents: events.reduce(
      (sum, event) => sum + Math.max(0, event.cashDelta ?? 0),
      0,
    ),
    lineOfCredit:
      count(events, 'line_of_credit_opened') *
      financialRules.lineOfCredit.cashAdvance,
    other: events
      .filter((event) => event.selectedOutcomeId && (event.amount ?? 0) > 0)
      .reduce((sum, event) => sum + (event.amount ?? 0), 0),
  };
  const explicit = Object.values(income).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const lifeEventExpenses = events.reduce(
    (sum, event) => sum + Math.max(0, -(event.cashDelta ?? 0)),
    0,
  );
  const locExpenses =
    count(events, 'line_of_credit_opened') *
      financialRules.lineOfCredit.applicationPrice +
    events
      .filter((event) => event.type === 'line_of_credit_repaid')
      .reduce((sum, event) => sum + Math.max(0, -(event.amount ?? 0)), 0);
  const expenses = {
    shop,
    hospital,
    lifeEvents: lifeEventExpenses,
    lineOfCredit: locExpenses,
    other: 0,
  };
  income.stream =
    state.balance -
    rules.startingCurrency +
    Object.values(expenses).reduce((sum, amount) => sum + amount, 0) -
    explicit;
  const debtEffects = events.flatMap((event) =>
    event.financialEffect ? [event.financialEffect] : [],
  );
  return {
    startingBalance: rules.startingCurrency,
    endingBalance: state.balance,
    income,
    expenses,
    maximumDebt: Math.max(
      0,
      ...debtEffects.map((effect) => effect.after.total),
    ),
    hoursInDebt: debtHours(events, state.ending?.at ?? state.now),
  };
}

function debtHours(events: GameEvent[], end: number) {
  let since: number | null = null;
  let hours = 0;
  for (const event of events) {
    if (event.type === 'debt_status_entered' && since === null) since = event.at;
    if (event.type === 'debt_status_recovered' && since !== null) {
      hours += (event.at - since) / 3_600_000;
      since = null;
    }
  }
  return round(hours + (since === null ? 0 : (end - since) / 3_600_000), 2);
}

function count(events: GameEvent[], type: string) {
  return events.filter((event) => event.type === type).length;
}

function sumAmount(events: GameEvent[], type: string) {
  return events
    .filter((event) => event.type === type)
    .reduce((sum, event) => sum + (event.amount ?? 0), 0);
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
