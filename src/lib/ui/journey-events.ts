import type { GameEvent } from '$lib/game-types';
import { activityJourneyMessage } from './journey-activity-messages';
import {
  ITEM_NARRATIVE_TYPES,
  itemJourneyMessage,
  timedEffectJourneyMessage,
} from './journey-item-messages';
import {
  PROGRESSION_EVENT_TYPES,
  progressionJourneyMessage,
} from './journey-progress-messages';
import { statusJourneyMessage } from './journey-status-messages';
import { uniquePresentationId } from './unique-presentation-id';
import {
  journeyTextContext,
  purchaseJourneyMessage,
} from './journey-purchase-messages';

export type JourneyEntryViewModel = {
  id: string;
  at: number;
  message: string;
  sourceEventIds: string[];
};

const HIDDEN_TYPES = new Set(['random_event_opportunity', 'shop_rotated']);

export function projectJourney(
  events: GameEvent[],
  petName: string,
  seed: string | number = 'journey-presentation',
): JourneyEntryViewModel[] {
  const entries: JourneyEntryViewModel[] = [];
  const transitionKeys = new Set<string>();
  const chronologicalEvents = events
    .map((event, index) => ({ event, index }))
    .sort(
      (left, right) =>
        left.event.at - right.event.at || left.index - right.index,
    )
    .map(({ event }) => event);
  for (const event of chronologicalEvents) {
    if (HIDDEN_TYPES.has(event.type) || event.type === 'status_recurrence')
      continue;
    if (event.type === 'command_outcome') {
      const alreadyNarrated = events.some(
        (candidate) =>
          candidate !== event &&
          candidate.sourceActionId === event.sourceActionId &&
          candidate.type === 'item_refused',
      );
      if (
        event.outcomeAccepted === false &&
        event.outcomeKind === 'refused' &&
        !alreadyNarrated
      )
        push(entries, event, personalize(event.message, petName));
      continue;
    }
    if (event.type === 'time_reconciled') {
      const effectMessage = timedEffectJourneyMessage(
        chronologicalEvents,
        event,
        petName,
      );
      if (effectMessage)
        push(entries, event, effectMessage, [event.id], `${event.id}:effect`);
      if (
        !event.healthDamageSources?.length ||
        (event.metricDeltas?.health ?? 0) >= 0
      )
        continue;
      const causes = [
        ...new Set(event.healthDamageSources.map((item) => item.name)),
      ];
      push(
        entries,
        event,
        `${petName}'s health suffered from ${joinWords(causes)}.`,
        [event.id],
        `${event.id}:health`,
      );
      continue;
    }
    if (event.type === 'run_started') {
      push(entries, event, `${petName}'s journey began.`);
      continue;
    }
    if (
      event.type === 'status_onset' ||
      event.type === 'status_added' ||
      event.type === 'status_cleared'
    ) {
      if (!event.status) continue;
      const active = event.type !== 'status_cleared';
      const transitionKey = `${event.at}:${event.status}:${active}`;
      if (transitionKeys.has(transitionKey)) continue;
      transitionKeys.add(transitionKey);
      const message = statusJourneyMessage({
        events: chronologicalEvents,
        event,
        status: event.status,
        petName,
        active,
      });
      if (message) push(entries, event, message);
      continue;
    }
    if (event.type === 'activity_started') {
      const message = activityJourneyMessage(
        chronologicalEvents,
        event,
        petName,
      );
      if (message) push(entries, event, message);
      continue;
    }
    if (
      event.type === 'activity_completed' ||
      event.type === 'activity_interrupted'
    ) {
      const message = activityJourneyMessage(
        chronologicalEvents,
        event,
        petName,
      );
      if (message) push(entries, event, message);
      continue;
    }
    if (event.type === 'stream_candidate') {
      push(
        entries,
        event,
        event.message.includes('too tired')
          ? `${petName} is too tired to stream.`
          : `${petName} started streaming.`,
      );
      continue;
    }
    if (PROGRESSION_EVENT_TYPES.has(event.type)) {
      const message = progressionJourneyMessage(
        event,
        petName,
        journeyTextContext(seed, event, petName),
      );
      if (message) push(entries, event, message);
      continue;
    }
    if (event.purchases?.length) {
      event.purchases.forEach((purchase, index) =>
        entries.push({
          id: uniquePresentationId(entries, `${event.id}:purchase:${index}`),
          at: event.at,
          message: purchaseJourneyMessage(
            event,
            purchase,
            petName,
            journeyTextContext(seed, event, petName),
          ),
          sourceEventIds: [event.id],
        }),
      );
      continue;
    }
    if (ITEM_NARRATIVE_TYPES.has(event.type)) {
      const message = itemJourneyMessage(event, petName);
      if (message)
        push(
          entries,
          event,
          message,
          authoredStatusSourceIds(chronologicalEvents, event),
        );
      continue;
    }
    if (event.type === 'death') {
      push(entries, event, personalize(event.message, petName));
      continue;
    }
    if (event.type === 'run_ended') {
      push(entries, event, event.message);
      continue;
    }
    const narrativeMessage = naturalNarrativeMessage(event, petName);
    if (narrativeMessage) push(entries, event, narrativeMessage);
  }
  return entries;
}

export function projectCausalJourney(
  events: GameEvent[],
  eventIds: string[],
  petName: string,
  seed: string | number = 'journey-presentation',
): JourneyEntryViewModel[] {
  const ids = new Set(eventIds);
  return projectJourney(events, petName, seed).filter((entry) =>
    entry.sourceEventIds.some((id) => ids.has(id)),
  );
}

function naturalNarrativeMessage(
  event: GameEvent,
  petName: string,
): string | undefined {
  if (event.type === 'annoyance_warning')
    return `${petName} is getting frustrated.`;
  if (event.type === 'critical_health_mood_penalty')
    return `${petName}'s critical health made everything feel worse.`;
  if (event.type === 'autonomous_food_rescue')
    return personalize(event.message, petName);
  if (
    event.type === 'medical_debt_created' ||
    event.type === 'medical_debt_daily_payment' ||
    event.type === 'medical_debt_paid_in_full' ||
    event.type === 'sugar_crash_warning' ||
    event.type === 'sugar_crash_averted' ||
    event.type === 'kidney_stone_risk_warning' ||
    event.type === 'ending_risk_warning' ||
    event.type === 'ending_risk_recovered' ||
    event.type === 'debt_status_entered' ||
    event.type === 'debt_status_recovered' ||
    event.type === 'line_of_credit_opened' ||
    event.type === 'line_of_credit_repaid' ||
    event.type === 'life_event_resolved' ||
    event.type === 'life_event_effect_expired' ||
    event.type === 'ending_unlocked'
  )
    return personalize(event.message, petName);
  if (event.type === 'autonomous_nap_refused')
    return `${petName} tried to nap on their own, but could not settle.`;
  if (event.type === 'rest_snoring')
    return `${petName} snored contentedly through the room.`;
  if (event.type === 'craving_expired')
    return `${petName}'s craving faded before it could be fulfilled.`;
  if (
    [
      'item_refused',
      'item_placed',
      'item_unplaced',
      'kidney_stone_recurrence',
      'sugar_crash',
      'low_money_stress',
      'food_craving',
      'creative_inspiration',
      'socks',
      'benign_room_event',
      'off_stream_support',
      'item_automatic_hook',
    ].includes(event.type)
  )
    return personalize(event.message, petName);
  return undefined;
}

function authoredStatusSourceIds(
  events: GameEvent[],
  event: GameEvent,
): string[] {
  if (!event.status) return [event.id];
  const transitionIds = events
    .filter(
      (candidate) =>
        candidate.at === event.at &&
        candidate.status === event.status &&
        (candidate.type === 'status_onset' ||
          candidate.type === 'status_added'),
    )
    .map((candidate) => candidate.id);
  return [...new Set([event.id, ...transitionIds])];
}

function personalize(message: string, petName: string): string {
  return message
    .replace(/^Companion\b/, petName)
    .replace(/^The companion\b/, petName)
    .replace(/\bthe companion\b/g, petName);
}

function joinWords(words: string[]): string {
  if (words.length < 2) return words[0] ?? 'an unknown cause';
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`;
}

function push(
  entries: JourneyEntryViewModel[],
  event: GameEvent,
  message: string,
  sourceEventIds = [event.id],
  id = event.id,
) {
  entries.push({
    id: uniquePresentationId(entries, id),
    at: event.at,
    message,
    sourceEventIds,
  });
}
