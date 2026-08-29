import type { GameEvent, GameState } from '../../../../src/lib/game-types';
import rules from '../../../../src/lib/data/simulation-rules.json';
import {
  DAY_MS,
  HORIZON_DAYS,
  STUDY_START,
  type RunTrace,
} from './balance-study-policy';
import {
  economy,
  healthDamage,
  kidneyAnalysis,
  statusHours,
} from './balance-run-analysis';
import {
  autonomyProfileAnalysis,
  careProfileAnalysis,
  economyProfileAnalysis,
  healthProfileAnalysis,
  nutritionProfileAnalysis,
  rescueProfileAnalysis,
} from './balance-profile-analysis';
import {
  financialAnalysis,
  lifeEventAnalysis,
} from './balance-financial-analysis';
import lifeEvents from '../../../../src/lib/data/life-events.json';
import {
  audienceBoostDiagnostics,
  followerSources,
} from './balance-audience-analysis';
const MILESTONES = [1_000, 10_000, 100_000, 250_000, 500_000, 1_000_000];

export function buildStudyResult(traces: RunTrace[]) {
  const heterogeneous = traces.some(
    (trace) => trace.spec.studyGroup === 'heterogeneous',
  );
  return {
    study: {
      id: heterogeneous
        ? 'controlled-and-heterogeneous-balance-100-v1'
        : 'canonical-balance-50-v2',
      policyVersion: heterogeneous ? 3 : 2,
      canonicalPolicyVersion: 2,
      extensionPolicyVersion: heterogeneous ? 1 : null,
      engine: 'real',
      horizonDays: HORIZON_DAYS,
      timezone: 'America/Toronto',
      question: heterogeneous
        ? 'Do the controlled cohorts and 50 heterogeneous human-behavior profiles preserve survival, autonomy, nutrition, medical-economy, and career separation?'
        : 'Can goal-directed players survive and reach 250K Casual, 500K Focused, and 1M Optimal without making exact 50% neglect safe?',
      stoppingCondition: 'Any run ending or 60 game-days.',
      economyNote:
        'Base stream income is the exact reconciled residual after event-attributed income and recorded expenses.',
    },
    configured: {
      cohort: frequency(traces.map((trace) => trace.spec.profile)),
      studyGroups: frequency(traces.map((trace) => trace.spec.studyGroup)),
      archetypes: frequency(traces.map((trace) => trace.spec.archetype)),
      eventWeights: rules.events.weights,
      lifeEventWeights: Object.fromEntries(
        lifeEvents.events.map((event) => [event.id, event.rollDenominator]),
      ),
      nutrition: {
        sugarCrash: rules.sugarCrash,
        kidneyStone: rules.kidneyStone,
      },
      followerGrowth: rules.progression.naturalAudience,
      clippers: rules.progression.clippers,
    },
    runs: traces.map(summarizeRun),
  };
}

function summarizeRun(trace: RunTrace) {
  const { state, spec } = trace;
  const end = state.ending?.at ?? state.now;
  const outcome = state.ending?.kind ?? 'horizon';
  const reachedHorizon = state.ending === null && end >= STUDY_START + HORIZON_DAYS * DAY_MS;
  const events = state.events;
  const milestoneDays = Object.fromEntries(
    MILESTONES.map((threshold) => [
      String(threshold),
      firstMilestoneDay(events, threshold),
    ]),
  );
  const targetDay = milestoneDays[String(spec.target)];
  const kidney = kidneyAnalysis(events);
  return {
    id: spec.id,
    profile: spec.profile,
    label: spec.label,
    studyGroup: spec.studyGroup,
    archetype: spec.archetype,
    overlays: spec.studyGroup === 'heterogeneous' ? spec.config.overlays : [],
    responseMode: spec.responseMode,
    seed: spec.seed,
    cadenceHours: spec.cadenceHours,
    policy:
      spec.studyGroup === 'controlled'
        ? {
            foodThreshold: spec.foodThreshold,
            restThreshold: spec.restThreshold,
            moodThreshold: spec.moodThreshold,
            foodReserve: spec.foodReserve,
            creativityTarget: spec.creativityTarget,
            clipperStacks: spec.clipperStacks,
          }
        : spec.config,
    elapsedDays: round((end - STUDY_START) / DAY_MS, 3),
    outcome,
    ending: state.ending,
    reachedHorizon,
    physicallyAlive: outcome !== 'death',
    health: state.metrics.health,
    healthProfile: healthProfileAnalysis(trace),
    subscribers: state.progression.followers,
    peakSubscribers: state.progression.peakFollowers,
    madeItUnlocked: state.endingUnlocks.made_it !== null,
    target: spec.target,
    targetDay,
    milestoneDays,
    followerSources: followerSources(state),
    audienceBoosts: audienceBoostDiagnostics(events),
    lifeEventScheduler: {
      ...state.history.lifeEventScheduler,
      successfulRolls: { ...state.history.lifeEventScheduler.successfulRolls },
    },
    streams: {
      started: state.progression.streamStats.started,
      completed: state.progression.streamStats.completed,
      interrupted: state.progression.streamStats.interrupted,
      hours: round(state.progression.streamStats.elapsedMs / 3_600_000, 2),
    },
    checks: trace.checks,
    careBehavior: careProfileAnalysis(trace),
    events: eventAnalysis(events),
    statusHours: statusHours(events, end),
    healthDamage: healthDamage(events),
    rawNeedDamage: healthDamage(events, true),
    sugarCrash: {
      warnings: count(events, 'sugar_crash_warning'),
      averted: count(events, 'sugar_crash_averted'),
      crashes: count(events, 'sugar_crash'),
      moodDamage: sumMetric(events, 'sugar_crash', 'mood'),
      restDamage: sumMetric(events, 'sugar_crash', 'rest'),
    },
    nutritionBehavior: nutritionProfileAnalysis(trace),
    kidneyStoneEpisodes: kidney.episodes,
    kidneyStone: kidney.summary,
    rescues: {
      food: count(events, 'autonomous_food_rescue'),
      rest: events.filter(
        (event) =>
          event.rescueMetric === 'rest' && event.type === 'activity_started',
      ).length,
      blockedReasons: frequency(
        events.flatMap((event) =>
          event.rescueBlockedReason ? [event.rescueBlockedReason] : [],
        ),
      ),
      followup: rescueProfileAnalysis(trace),
    },
    medical: {
      bills: count(events, 'medical_debt_created'),
      insuredBills: events.filter(
        (event) =>
          event.type === 'medical_debt_created' && event.amount === 500,
      ).length,
      dailyPaymentEvents: count(events, 'medical_debt_daily_payment'),
      fullPayments: count(events, 'medical_debt_paid_in_full'),
      remainingPrincipal: state.medicalDebt.reduce(
        (sum, bill) => sum + bill.remainingPrincipal,
        0,
      ),
      decisions: trace.behavior?.hospitalDecisions ?? {},
    },
    rejectedPurchases: trace.rejectedPurchases,
    economy: economy(state),
    financial: financialAnalysis(state, end),
    lifeEvents: lifeEventAnalysis(state, end),
    rotisserieChicken: rotisserieChickenAnalysis(state),
    economyBehavior: economyProfileAnalysis(trace),
    autonomousLife: autonomyProfileAnalysis(events),
  };
}

function firstMilestoneDay(events: GameEvent[], threshold: number) {
  const event = events.find(
    (candidate) =>
      candidate.type === 'career_milestone' &&
      candidate.followerDelta === threshold,
  );
  return event ? round((event.at - STUDY_START) / DAY_MS, 3) : null;
}

function eventAnalysis(events: GameEvent[]) {
  const opportunities = events.filter(
    (event) => event.type === 'random_event_opportunity',
  );
  const impacts: Record<
    string,
    {
      selections: number;
      metrics: Record<string, number>;
      money: number;
      followers: number;
    }
  > = {};
  for (const opportunity of opportunities) {
    const selected = opportunity.cause ?? 'none';
    const entry = (impacts[selected] ??= {
      selections: 0,
      metrics: {},
      money: 0,
      followers: 0,
    });
    entry.selections += 1;
    const opportunityIndex = events.indexOf(opportunity);
    const immediate = events[opportunityIndex + 1];
    const effects =
      selected !== 'none' &&
      immediate &&
      immediate.type !== 'random_event_opportunity' &&
      immediate.sourceActionId === opportunity.sourceActionId
        ? [immediate]
        : [];
    for (const effect of effects) {
      for (const [metric, delta] of Object.entries(effect.metricDeltas ?? {}))
        entry.metrics[metric] = (entry.metrics[metric] ?? 0) + (delta ?? 0);
      entry.money += effect.cashDelta ?? effect.amount ?? 0;
      entry.followers += effect.followerDelta ?? 0;
    }
  }
  return {
    opportunities: opportunities.length,
    selections: frequency(opportunities.map((event) => event.cause ?? 'none')),
    impacts,
    selectedOutcomeIds: frequency(
      events.flatMap((event) =>
        event.selectedOutcomeId ? [event.selectedOutcomeId] : [],
      ),
    ),
  };
}

function rotisserieChickenAnalysis(state: GameState) {
  const itemId = 'three_month_old_rotisserie_chicken';
  const shopAppearances = state.events.filter(
    (event) =>
      ['run_started', 'shop_rotated'].includes(event.type) &&
      event.shopItemIds?.includes(itemId),
  ).length;
  const purchases = state.events.flatMap((event) =>
    (event.purchases ?? [])
      .filter((purchase) => purchase.itemId === itemId)
      .map((purchase) => ({ at: event.at, quantity: purchase.quantity })),
  );
  const uses = state.events.filter((event) => event.itemId === itemId);
  const deaths = state.events.filter((event) => event.type === 'death');
  const lethalUses = uses.filter((use) =>
    deaths.some((death) => death.causedBy?.includes(use.id)),
  );
  const itemDamage = uses.reduce(
    (sum, event) =>
      sum +
      (event.healthDamageSources ?? [])
        .filter((source) => source.kind === 'item' && source.id === itemId)
        .reduce((total, source) => total + source.amount, 0),
    0,
  );
  const automaticUses = uses.filter(
    (event) => event.itemUseMode === 'automatic_stream_snack',
  );
  const manualUses = uses.filter((event) => event.itemUseMode === 'manual');
  return {
    shopAppearances,
    purchases: purchases.reduce((sum, purchase) => sum + purchase.quantity, 0),
    purchaseEvents: purchases.length,
    manualUses: manualUses.length,
    automaticUses: automaticUses.length,
    healthDamage: itemDamage,
    lethalUses: lethalUses.length,
    deathWithin24Hours: uses.filter((use) =>
      deaths.some(
        (death) =>
          death.at >= use.at &&
          death.at - use.at <= 24 * 3_600_000,
      ),
    ).length,
  };
}

function count(events: GameEvent[], type: string) {
  return events.filter((event) => event.type === type).length;
}

function sumMetric(
  events: GameEvent[],
  type: string,
  metric: keyof GameState['metrics'],
) {
  return events
    .filter((event) => event.type === type)
    .reduce((sum, event) => sum + (event.metricDeltas?.[metric] ?? 0), 0);
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
