import lifeEventData from './data/life-events.json';
import { finalizeFinancialOperation } from './financial-rules';
import { applyFollowerMilestones } from './follower-rules';
import { HOUR_MS, STAT_MAX, STAT_MIN } from './game-constants';
import type { GameEvent, GameState, MetricName, Metrics } from './game-types';
import { creditIncome } from './income-rules';
import { actionRandom } from './seeded-rng';
import { reconcileRunEnding } from './ending-rules';
import { healthDamageSource } from './simulation/health-resolution';
import { reconcileMetricSource } from './status-rules/metric-source-reconciliation';

export type LifeEventEffects = Partial<Metrics> & {
  cash?: number;
  followersFlat?: number;
  followersPercent?: number;
  followerGrowthMultiplier?: number;
  followerGrowthDurationHours?: number;
};

type OutcomeDefinition = {
  id: string;
  weight: number;
  message: string;
  effects: LifeEventEffects;
};

type LifeEventDefinition = {
  id: string;
  weight: number;
  message?: string;
  effects?: LifeEventEffects;
  minimumRunAgeHours?: number;
  minimumFollowers?: number;
  cooldownHours?: number;
  oncePerRun?: boolean;
  requiresNoDiscoveryBoost?: boolean;
  outcomes?: OutcomeDefinition[];
};

const definitions = lifeEventData.events as LifeEventDefinition[];
const metricNames: MetricName[] = [
  'food',
  'health',
  'mood',
  'rest',
  'bond',
  'creativity',
];

export function eligibleLifeEvents(
  state: GameState,
): Array<{ id: string; weight: number }> {
  const runAge = state.now - state.history.runStartedAt;
  return definitions
    .filter(
      (event) =>
        !state.ending &&
        runAge >= (event.minimumRunAgeHours ?? 0) * HOUR_MS &&
        state.progression.followers >= (event.minimumFollowers ?? 0) &&
        (state.history.eventCooldowns[lifeEventKey(event.id)] ?? 0) <=
          state.now &&
        (!event.requiresNoDiscoveryBoost ||
          !state.progression.discoveryBoost ||
          state.progression.discoveryBoost.expiresAt <= state.now),
    )
    .map(({ id, weight }) => ({ id, weight }));
}

/** Resolve one authored life event as a single atomic simulation operation. */
export function resolveLifeEvent(
  state: GameState,
  eventId: string,
  at: number,
  sourceActionId: string,
): GameState {
  const definition = definitions.find(({ id }) => id === eventId);
  if (!definition) return state;
  const outcome = selectOutcome(state, definition, sourceActionId);
  const effects = outcome?.effects ?? definition.effects ?? {};
  const metrics = { ...state.metrics };
  const metricDeltas: Partial<Metrics> = {};
  for (const metric of metricNames) {
    const authored = effects[metric] ?? 0;
    if (!authored) continue;
    const before = metrics[metric];
    metrics[metric] = Math.max(STAT_MIN, Math.min(STAT_MAX, before + authored));
    metricDeltas[metric] = metrics[metric] - before;
  }
  const cashDelta = effects.cash ?? 0;
  const followerDelta = Math.round(
    (effects.followersFlat ?? 0) +
      state.progression.followers * (effects.followersPercent ?? 0),
  );
  const appliedFollowers = Math.max(
    -state.progression.followers,
    followerDelta,
  );
  const resolvedEventId = `event-${state.events.length + 1}`;
  const resolvedMessage = outcome?.message ?? definition.message ?? eventId;
  const event: GameEvent = {
    id: resolvedEventId,
    type: 'life_event_resolved',
    at,
    message: resolvedMessage,
    sourceActionId,
    lifeEventId: definition.id,
    selectedOutcomeId: outcome?.id,
    metricDeltas:
      Object.keys(metricDeltas).length > 0 ? metricDeltas : undefined,
    cashDelta: cashDelta || undefined,
    followerDelta: appliedFollowers || undefined,
    followerGrowthMultiplier: effects.followerGrowthMultiplier,
    followerGrowthDurationHours: effects.followerGrowthDurationHours,
    healthDamageSources:
      (metricDeltas.health ?? 0) < 0
        ? [
            healthDamageSource(
              'event',
              definition.id,
              resolvedMessage,
              metricDeltas.health!,
              [resolvedEventId],
            ),
          ]
        : undefined,
  };
  const cooldownUntil = definition.oncePerRun
    ? Number.MAX_SAFE_INTEGER
    : at + (definition.cooldownHours ?? 0) * HOUR_MS;
  let next: GameState = {
    ...state,
    now: at,
    metrics,
    balance:
      cashDelta > 0
        ? creditIncome(state, cashDelta).balance
        : state.balance + cashDelta,
    progression: {
      ...state.progression,
      followers: state.progression.followers + appliedFollowers,
      discoveryBoost: effects.followerGrowthMultiplier
        ? {
            eventId: definition.id,
            multiplier: effects.followerGrowthMultiplier,
            startedAt: at,
            expiresAt:
              at + (effects.followerGrowthDurationHours ?? 0) * HOUR_MS,
          }
        : state.progression.discoveryBoost,
    },
    history: {
      ...state.history,
      eventCooldowns: {
        ...state.history.eventCooldowns,
        [lifeEventKey(definition.id)]: cooldownUntil,
      },
    },
    events: [...state.events, event],
    stateVersion: state.stateVersion + 1,
  };
  const events = [event];
  next = applyFollowerMilestones(next, sourceActionId, at, events);
  next = { ...next, events: [...state.events, ...events] };
  next = reconcileMetricSource(state, next, sourceActionId);
  if (next.balance !== state.balance)
    next = finalizeFinancialOperation({
      before: state,
      state: next,
      triggerEventId: event.id,
      kind: cashDelta
        ? `life_event:${definition.id}`
        : 'career_milestone_income',
    });
  return reconcileRunEnding(next);
}

function selectOutcome(
  state: GameState,
  definition: LifeEventDefinition,
  sourceActionId: string,
): OutcomeDefinition | undefined {
  if (!definition.outcomes?.length) return undefined;
  const total = definition.outcomes.reduce((sum, item) => sum + item.weight, 0);
  let remaining =
    actionRandom(
      state.seed,
      state.stateVersion,
      sourceActionId,
      `life_event:${definition.id}`,
      'outcome',
    ) * total;
  return definition.outcomes.find((outcome) => {
    remaining -= outcome.weight;
    return remaining < 0;
  });
}

function lifeEventKey(eventId: string): string {
  return `life_event:${eventId}`;
}
