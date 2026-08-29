import type { GameDefinition } from '../game-definition';
import type { GameEvent, GameState } from '../game-types';
import { actionRandom } from '../seeded-rng';
import { resolveItemConsumption } from '../commands/item-consumption';
import {
  kidneyStoneRecurrenceHours,
  kidneyStoneRecurrenceMetricDeltas,
} from '../status-rules';
import type { StatusReconciliation } from '../status-rules';
import { HOUR_MS } from '../game-constants';
import { healthDamageSource } from './health-resolution';
import { appendStatusTransitionEvents } from './engine-state';
import { completeDueProjects } from '../project-rules';
import { resolveTimelineOpportunities } from './timeline-opportunities';
import { appendTimelineStatusEvents } from './timeline-status-events';
import { reconcileMetricSource } from '../status-rules/metric-source-reconciliation';
import { resolveAudienceGrowth } from '../audience-growth-rules';
import { processDailyMedicalPayments } from '../medical-debt-rules';
import { processSubscriberRevenue } from '../subscriber-revenue-rules';
import {
  nextLifeEventBoundary,
  processLifeEventBoundary,
} from '../life-event-scheduler';

export type TimelineEffectsInput = {
  state: GameState;
  definition: GameDefinition;
  statusReconciliation: StatusReconciliation;
  reconciliationNow: number;
  deathAt: number | null;
  streamSnackRequests: number;
  lastResolvedAt: number;
  autonomousOpportunity?: boolean;
  preventLethal?: boolean;
};

export type TimelineEffectsResult = {
  state: GameState;
  eventIds: string[];
  deathAt: number | null;
  lethalEventId?: string;
  reconciliationNow: number;
  resolvedElapsedHours: number;
};

export function resolveTimelineEffects({
  state,
  definition,
  statusReconciliation,
  reconciliationNow: initialReconciliationNow,
  deathAt: initialDeathAt,
  streamSnackRequests,
  lastResolvedAt,
  autonomousOpportunity = false,
  preventLethal = false,
}: TimelineEffectsInput): TimelineEffectsResult {
  let next = state;
  let deathAt = initialDeathAt;
  let lethalEventId: string | undefined;
  let reconciliationNow = initialReconciliationNow;
  let resolvedElapsedHours = (reconciliationNow - lastResolvedAt) / HOUR_MS;
  const eventIds: string[] = [];
  const beforeProjectEvents = next.events.length;
  next = completeDueProjects(next, reconciliationNow);
  eventIds.push(
    ...next.events.slice(beforeProjectEvents).map((event) => event.id),
  );

  if (!deathAt && streamSnackRequests > 0 && next.activity?.type === 'stream') {
    const streamActivityId = next.activity.sourceActionId;
    for (
      let snackIndex = 0;
      snackIndex < streamSnackRequests;
      snackIndex += 1
    ) {
      const snacks = definition.items.filter(
        (item) =>
          item.edible &&
          (item.preferences?.includes('liked') ||
            item.preferences?.includes('variable')) &&
          item.usable !== false &&
          item.itemActions?.some((action) => action.kind === 'consume') &&
          (item.effects?.food?.max ?? 0) > 0 &&
          (next.inventory[item.id] ?? 0) > 0,
      );
      if (!snacks.length) break;
      const roll = actionRandom(
        next.seed,
        next.stateVersion,
        streamActivityId,
        'stream_snack',
        String(snackIndex),
      );
      const item = snacks[Math.floor(roll * snacks.length)];
      const beforeSnackEventCount = next.events.length;
      const beforeSnackStatuses = next.statuses;
      const snackCommandId = `${streamActivityId}:snack:${snackIndex}`;
      next = resolveItemConsumption(
        next,
        {
          type: 'use_item',
          commandId: snackCommandId,
          itemId: item.id,
          now: reconciliationNow,
        },
        definition,
        { automatic: true },
      ).state;
      next = appendStatusTransitionEvents(
        next,
        beforeSnackStatuses,
        snackCommandId,
      );
      eventIds.push(
        ...next.events
          .slice(beforeSnackEventCount)
          .map((snackEvent) => snackEvent.id),
      );
      if (next.metrics.health <= 0) {
        if (preventLethal) {
          next = { ...next, metrics: { ...next.metrics, health: 1 } };
        } else {
          deathAt = reconciliationNow;
          break;
        }
      }
    }
  }

  if (!deathAt) {
    if (!next.ending && nextLifeEventBoundary(next) === reconciliationNow) {
      const lifeEvents = processLifeEventBoundary(next, reconciliationNow);
      next = lifeEvents.state;
      eventIds.push(...lifeEvents.eventIds);
    }
  }
  if (!deathAt && !next.ending) {
    const opportunities = resolveTimelineOpportunities({
      state: next,
      definition,
      at: reconciliationNow,
      autonomous: autonomousOpportunity,
    });
    next = opportunities.state;
    eventIds.push(...opportunities.eventIds);
  }
  if (!deathAt && !next.ending) {
    const revenue = processSubscriberRevenue(next, reconciliationNow);
    next = revenue.state;
    eventIds.push(...revenue.eventIds);
  }
  if (!deathAt && !next.ending) {
    const medicalPayments = processDailyMedicalPayments(
      next,
      reconciliationNow,
    );
    next = medicalPayments.state;
    eventIds.push(...medicalPayments.eventIds);
  }
  if (!deathAt && !next.ending) {
    const audience = resolveAudienceGrowth(next, reconciliationNow);
    next = audience.state;
    eventIds.push(...audience.eventIds);
  }
  if (!deathAt && !next.ending) {
    const statusEvents = appendTimelineStatusEvents({
      state: next,
      reconciliation: statusReconciliation,
      at: reconciliationNow,
    });
    next = statusEvents.state;
    eventIds.push(...statusEvents.eventIds);
  }

  if (
    !deathAt &&
    !next.ending &&
    next.statuses.kidney_stone &&
    next.activity?.type !== 'medical_care'
  ) {
    const record = next.statuses.kidney_stone;
    let causalEventIds = record.causalEventIds ?? [];
    const lastPenaltyAt = record.lastPenaltyAt ?? record.since;
    const recurrenceMs = kidneyStoneRecurrenceHours() * HOUR_MS;
    const occurrences = Math.floor(
      (reconciliationNow - lastPenaltyAt) / recurrenceMs,
    );
    for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
      const recurrenceAt = lastPenaltyAt + (occurrence + 1) * recurrenceMs;
      if (
        next.timedEffects.painReliefUntil !== null &&
        recurrenceAt < next.timedEffects.painReliefUntil
      ) {
        next = {
          ...next,
          statuses: {
            ...next.statuses,
            kidney_stone: {
              ...next.statuses.kidney_stone!,
              lastPenaltyAt: recurrenceAt,
            },
          },
        };
        continue;
      }
      const recurrence = kidneyStoneRecurrenceMetricDeltas(next.metrics);
      const healthDelta =
        preventLethal && next.metrics.health + recurrence.health <= 0
          ? 1 - next.metrics.health
          : recurrence.health;
      const restDelta = recurrence.rest;
      const event: GameEvent = {
        id: `event-${next.events.length + 1}`,
        type: 'kidney_stone_recurrence',
        at: recurrenceAt,
        message: 'Kidney stone symptoms worsened.',
        status: 'kidney_stone',
        metricDeltas: { health: healthDelta, rest: restDelta },
        causedBy: causalEventIds,
        healthDamageSources: [
          healthDamageSource(
            'status',
            'kidney_stone',
            'Kidney stone complications',
            healthDelta,
            causalEventIds,
          ),
        ],
      };
      causalEventIds = [...causalEventIds, event.id];
      const beforeRecurrence = next;
      next = {
        ...next,
        metrics: {
          ...next.metrics,
          health: next.metrics.health + healthDelta,
          rest: next.metrics.rest + restDelta,
        },
        statuses: {
          ...next.statuses,
          kidney_stone: {
            ...record,
            lastPenaltyAt: recurrenceAt,
            causalEventIds,
          },
        },
        events: [...next.events, event],
      };
      next = reconcileMetricSource(
        beforeRecurrence,
        next,
        `kidney-stone:${recurrenceAt}`,
      );
      eventIds.push(
        event.id,
        ...next.events
          .slice(beforeRecurrence.events.length + 1)
          .map((statusEvent) => statusEvent.id),
      );
      if (next.metrics.health <= 0) {
        deathAt = recurrenceAt;
        lethalEventId = event.id;
        next = {
          ...next,
          now: recurrenceAt,
          lastResolvedAt: recurrenceAt,
        };
        reconciliationNow = recurrenceAt;
        resolvedElapsedHours = (reconciliationNow - lastResolvedAt) / HOUR_MS;
        break;
      }
    }
  }
  return {
    state: next,
    eventIds,
    deathAt,
    lethalEventId,
    reconciliationNow,
    resolvedElapsedHours,
  };
}
