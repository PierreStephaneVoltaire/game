import lifeEventData from './data/life-events.json';
import { reconcileRunEnding } from './ending-rules';
import { finalizeFinancialOperation } from './financial-rules';
import { applyFollowerMilestones } from './follower-rules';
import { HEALTH_MAX, HOUR_MS, STAT_MAX, STAT_MIN } from './game-constants';
import type { GameEvent, GameState, MetricName, Metrics } from './game-types';
import { creditIncome } from './income-rules';
import { actionRandom } from './seeded-rng';
import { healthDamageSource } from './simulation/health-resolution';
import { reconcileMetricSource } from './status-rules/metric-source-reconciliation';
import {
  BUNDLED_GAME_DEFINITION,
  type GameDefinition,
} from './game-definition';
import { recordLifetimePurchases } from './billing-rules';
import { eventTemplate, lifeEventMessage } from './event-messages';
import type {
  LifeEventDefinition,
  LifeEventEffects,
  LifeEventOutcomeDefinition,
} from './life-event-types';
import {
  eligibleEquipmentExpenseItems,
  eligiblePersonalPurchaseItems,
  resolveLifeEventCashRange,
  selectEquipmentExpenseItem,
  selectPersonalPurchase,
} from './life-event-random-resolution';

export type { LifeEventDefinition, LifeEventEffects } from './life-event-types';

export const lifeEventDefinitions =
  lifeEventData.events as LifeEventDefinition[];

const metricNames: MetricName[] = [
  'food',
  'health',
  'mood',
  'rest',
  'bond',
  'creativity',
];

/** Resolve one authored life event as a single atomic simulation operation. */
export function resolveLifeEvent(
  state: GameState,
  eventId: string,
  at: number,
  sourceActionId: string,
  gameDefinition: GameDefinition = BUNDLED_GAME_DEFINITION,
): GameState {
  const definition = lifeEventDefinitions.find(({ id }) => id === eventId);
  if (
    !definition ||
    state.ending ||
    !isLifeEventEligible(state, definition, gameDefinition)
  )
    return state;
  if (
    definition.id === 'agency_invitation' &&
    state.progression.agencyJoinedAt !== null
  )
    return state;
  const purchasedItem =
    definition.behavior?.type === 'catalogue_purchase'
      ? selectPersonalPurchase(state, gameDefinition, sourceActionId)
      : undefined;
  if (definition.behavior?.type === 'catalogue_purchase' && !purchasedItem)
    return state;
  const failedEquipment =
    definition.behavior?.type === 'catalogue_item_expense'
      ? selectEquipmentExpenseItem(
          state,
          definition,
          gameDefinition,
          sourceActionId,
        )
      : undefined;
  if (
    definition.behavior?.type === 'catalogue_item_expense' &&
    !failedEquipment
  )
    return state;
  const outcome = selectOutcome(state, definition, sourceActionId);
  const rangedCash = resolveLifeEventCashRange(
    state,
    definition,
    sourceActionId,
  );
  const effects: LifeEventEffects = purchasedItem
    ? {
        cash: -purchasedItem.price,
        mood:
          definition.behavior?.type === 'catalogue_purchase'
            ? definition.behavior.mood
            : 1,
      }
    : {
        ...(outcome?.effects ?? definition.effects ?? {}),
        ...(rangedCash === undefined ? {} : { cash: rangedCash }),
      };
  const metrics = { ...state.metrics };
  const metricDeltas: Partial<Metrics> = {};
  for (const metric of metricNames) {
    const authored = effects[metric] ?? 0;
    if (!authored) continue;
    const before = metrics[metric];
    const maximum = metric === 'health' ? HEALTH_MAX : STAT_MAX;
    metrics[metric] = Math.max(STAT_MIN, Math.min(maximum, before + authored));
    metricDeltas[metric] = metrics[metric] - before;
  }
  const cashDelta = effects.cash ?? 0;
  const followerDelta = followerChange(state, effects);
  const resolvedEventId = `event-${state.events.length + 1}`;
  const resolvedMessage = purchasedItem
    ? eventTemplate('personal_purchase', { item: purchasedItem.name })
    : definition.messageTemplateId
      ? eventTemplate(definition.messageTemplateId, {
          amount: Math.abs(cashDelta).toLocaleString('en-US'),
          item: failedEquipment?.name ?? '',
        })
      : outcome?.messageId
        ? lifeEventMessage(outcome.messageId)
        : definition.messageId
          ? lifeEventMessage(definition.messageId)
          : eventId;
  const event: GameEvent = {
    id: resolvedEventId,
    type: 'life_event_resolved',
    at,
    message: resolvedMessage,
    sourceActionId,
    cause: failedEquipment?.id,
    purchaseActor: purchasedItem ? 'companion' : undefined,
    purchases: purchasedItem
      ? [
          {
            itemId: purchasedItem.id,
            itemName: purchasedItem.name,
            quantity: 1,
          },
        ]
      : undefined,
    lifeEventId: definition.id,
    selectedOutcomeId: outcome?.id,
    metricDeltas:
      Object.keys(metricDeltas).length > 0 ? metricDeltas : undefined,
    cashDelta: cashDelta || undefined,
    followerDelta: followerDelta || undefined,
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
  const discoveryBoosts = effects.followerGrowthMultiplier
    ? [
        ...state.progression.discoveryBoosts.filter(
          (boost) => boost.eventId !== definition.id && boost.expiresAt > at,
        ),
        {
          eventId: definition.id,
          multiplier: effects.followerGrowthMultiplier,
          startedAt: at,
          expiresAt: at + (effects.followerGrowthDurationHours ?? 0) * HOUR_MS,
        },
      ]
    : state.progression.discoveryBoosts;
  let next: GameState = {
    ...state,
    now: at,
    metrics,
    balance:
      cashDelta > 0
        ? creditIncome(state, cashDelta).balance
        : state.balance + cashDelta,
    inventory: purchasedItem
      ? {
          ...state.inventory,
          [purchasedItem.id]: (state.inventory[purchasedItem.id] ?? 0) + 1,
        }
      : state.inventory,
    progression: {
      ...state.progression,
      followers: state.progression.followers + followerDelta,
      agencyJoinedAt:
        definition.id === 'agency_invitation'
          ? at
          : state.progression.agencyJoinedAt,
      discoveryBoosts,
    },
    events: [...state.events, event],
    history: purchasedItem
      ? recordLifetimePurchases(state, [
          { itemId: purchasedItem.id, quantity: 1 },
        ])
      : state.history,
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

export function isLifeEventEligible(
  state: GameState,
  definition: LifeEventDefinition,
  gameDefinition: GameDefinition = BUNDLED_GAME_DEFINITION,
): boolean {
  if (definition.requiresNonnegativeBalance && state.balance < 0) return false;
  if (
    definition.id === 'agency_invitation' &&
    state.progression.agencyJoinedAt !== null
  )
    return false;
  if (definition.behavior?.type === 'catalogue_purchase')
    return eligiblePersonalPurchaseItems(state, gameDefinition).length > 0;
  if (definition.behavior?.type === 'catalogue_item_expense')
    return eligibleEquipmentExpenseItems(definition, gameDefinition).length > 0;
  return true;
}

function followerChange(state: GameState, effects: LifeEventEffects): number {
  let change = Math.round(
    (effects.followersFlat ?? 0) +
      state.progression.followers * (effects.followersPercent ?? 0),
  );
  if (
    (effects.followersPercent ?? 0) < 0 &&
    change > -(effects.followersMinimumLoss ?? 0)
  )
    change = -(effects.followersMinimumLoss ?? 0);
  return Math.max(-state.progression.followers, change);
}

function selectOutcome(
  state: GameState,
  definition: LifeEventDefinition,
  sourceActionId: string,
): LifeEventOutcomeDefinition | undefined {
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
