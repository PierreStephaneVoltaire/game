import type { GameDefinition } from '../game-definition';
import type { GameEvent, GameState } from '../game-types';
import { actionRandom } from '../seeded-rng';
import { localDate, rotateShop } from '../shop-rules';
import { resolveItemConsumption } from '../commands/item-consumption';
import {
  kidneyStoneRecurrenceHours,
  kidneyStoneRecurrenceMetricDeltas,
  sugarCrashMetricDeltas,
} from '../status-rules';
import type { StatusReconciliation } from '../status-rules';
import { HOUR_MS } from '../game-constants';
import { healthDamageSource } from './health-resolution';
import { statusDisplayName } from '../event-messages';
import { appendStatusTransitionEvents } from './engine-state';

export type TimelineEffectsInput = {
  state: GameState;
  definition: GameDefinition;
  statusReconciliation: StatusReconciliation;
  reconciliationNow: number;
  deathAt: number | null;
  streamSnackRequests: number;
  lastResolvedAt: number;
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
}: TimelineEffectsInput): TimelineEffectsResult {
  let next = state;
  let deathAt = initialDeathAt;
  let lethalEventId: string | undefined;
  let reconciliationNow = initialReconciliationNow;
  let resolvedElapsedHours = (reconciliationNow - lastResolvedAt) / HOUR_MS;
  const eventIds: string[] = [];

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
    }
  }

  const currentLocalDate = localDate(reconciliationNow, next.timezone);
  if (!deathAt && currentLocalDate !== next.shop.localDate) {
    next = {
      ...next,
      shop: rotateShop(next, definition, currentLocalDate),
      stateVersion: next.stateVersion + 1,
    };
    const event: GameEvent = {
      id: `event-${next.events.length + 1}`,
      type: 'shop_rotated',
      at: reconciliationNow,
      message: 'The shop refreshed for a new local day.',
    };
    next = { ...next, events: [...next.events, event] };
    eventIds.push(event.id);
  }
  if (!deathAt)
    for (const effect of statusReconciliation.onsetEffects) {
      if (!next.statuses[effect.status]) continue;
      const event: GameEvent = {
        id: `event-${next.events.length + 1}`,
        type: 'status_onset',
        at: reconciliationNow,
        message: effect.message,
        status: effect.status,
        metricDeltas: effect.metricDeltas,
        healthDamageSources: damageSourcesForStatusEffect(
          effect.status,
          effect.metricDeltas.health,
        ),
      };
      next = { ...next, events: [...next.events, event] };
      eventIds.push(event.id);
    }
  if (!deathAt)
    for (const effect of statusReconciliation.recurrenceEffects) {
      if (!next.statuses[effect.status]) continue;
      const event: GameEvent = {
        id: `event-${next.events.length + 1}`,
        type: 'status_recurrence',
        at: effect.at ?? reconciliationNow,
        message: effect.message,
        status: effect.status,
        metricDeltas: effect.metricDeltas,
        healthDamageSources: damageSourcesForStatusEffect(
          effect.status,
          effect.metricDeltas.health,
        ),
      };
      next = { ...next, events: [...next.events, event] };
      eventIds.push(event.id);
    }
  if (!deathAt)
    for (const effect of statusReconciliation.clearEffects) {
      if (next.statuses[effect.status]) continue;
      const event: GameEvent = {
        id: `event-${next.events.length + 1}`,
        type: 'status_cleared',
        at: effect.at ?? reconciliationNow,
        message: effect.message,
        status: effect.status,
        metricDeltas: effect.metricDeltas,
      };
      next = { ...next, events: [...next.events, event] };
      eventIds.push(event.id);
    }
  if (!deathAt && statusReconciliation.sugarCrash) {
    const sugarCrash = sugarCrashMetricDeltas();
    const event: GameEvent = {
      id: `event-${next.events.length + 1}`,
      type: 'sugar_crash',
      at: reconciliationNow,
      message: 'Companion hit a sugar crash.',
      status: 'sugar_crash',
      metricDeltas: {
        mood: sugarCrash.mood,
        rest: sugarCrash.rest,
      },
    };
    next = { ...next, events: [...next.events, event] };
    eventIds.push(event.id);
  }

  if (
    !deathAt &&
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
      const recurrence = kidneyStoneRecurrenceMetricDeltas(next.metrics);
      const healthDelta = recurrence.health;
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
      eventIds.push(event.id);
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

function damageSourcesForStatusEffect(
  status: keyof GameState['statuses'],
  healthDelta: number | undefined,
) {
  if ((healthDelta ?? 0) >= 0) return undefined;
  const names: Partial<Record<keyof GameState['statuses'], string>> = {
    starving: 'Starvation',
    sleep_deprived: 'Sleep deprivation',
    depressed: 'Depression',
    sick: 'Sickness',
    kidney_stone: 'Kidney stone complications',
    full: 'Overfeeding',
  };
  return [
    healthDamageSource(
      'status',
      status,
      names[status] ?? statusDisplayName(status),
      healthDelta ?? 0,
    ),
  ];
}
