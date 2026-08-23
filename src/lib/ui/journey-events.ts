import type { Activity, GameEvent } from '$lib/game-types';
import { statusJourneyMessage } from './journey-status-messages';

export type JourneyEntryViewModel = {
  id: string;
  at: number;
  message: string;
  sourceEventIds: string[];
};

const HIDDEN_TYPES = new Set([
  'random_event_opportunity',
  'shop_rotated',
  'critical_health_mood_penalty',
  'nutrition_profile_discovered',
]);

export function projectJourney(
  events: GameEvent[],
  petName: string,
): JourneyEntryViewModel[] {
  const entries: JourneyEntryViewModel[] = [];
  const transitionKeys = new Set<string>();
  for (const event of events) {
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
        events,
        event,
        status: event.status,
        petName,
        active,
      });
      if (message) push(entries, event, message);
      continue;
    }
    if (event.type === 'activity_started') {
      push(entries, event, activityStarted(event.activityType, petName));
      continue;
    }
    if (
      event.type === 'activity_completed' ||
      event.type === 'activity_interrupted'
    ) {
      push(
        entries,
        event,
        activityEnded(
          event.activityType,
          petName,
          event.type === 'activity_interrupted',
        ),
      );
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
    if (event.purchases?.length) {
      event.purchases.forEach((purchase, index) =>
        entries.push({
          id: `${event.id}:purchase:${index}`,
          at: event.at,
          message: `Bought ${purchase.quantity} ${purchase.itemName}.`,
          sourceEventIds: [event.id],
        }),
      );
      continue;
    }
    if (event.type === 'item_used') {
      const item =
        event.itemName ?? event.message.match(/^(.*?) was used\.$/)?.[1];
      push(
        entries,
        event,
        item ? `${petName} used ${item}.` : personalize(event.message, petName),
      );
      continue;
    }
    if (event.type === 'item_reaction' && event.itemName) {
      const reaction = event.discovery === 'liked' ? 'enjoyed' : 'tolerated';
      push(entries, event, `${petName} ${reaction} ${event.itemName}.`);
      continue;
    }
    if (event.type === 'death') {
      push(entries, event, `${petName} died.`);
      continue;
    }
    if (isNarrativeEvent(event.type))
      push(entries, event, personalize(event.message, petName));
  }
  return entries;
}

export function projectCausalJourney(
  events: GameEvent[],
  eventIds: string[],
  petName: string,
): JourneyEntryViewModel[] {
  const ids = new Set(eventIds);
  return projectJourney(events, petName).filter((entry) =>
    entry.sourceEventIds.some((id) => ids.has(id)),
  );
}

function activityStarted(type: Activity['type'] | undefined, name: string) {
  if (type === 'medical_care') return `${name} went to the hospital.`;
  if (type === 'rest') return `${name} went to rest.`;
  if (type === 'socialize') return `${name} started socializing.`;
  if (type === 'play') return `${name} started playing.`;
  if (type === 'stream') return `${name} started streaming.`;
  return `${name} started an activity.`;
}

function activityEnded(
  type: Activity['type'] | undefined,
  name: string,
  interrupted: boolean,
) {
  if (type === 'medical_care') return `${name} returned from the hospital.`;
  const verbs: Partial<Record<Activity['type'], string>> = {
    rest: 'resting',
    socialize: 'socializing',
    play: 'playing',
    stream: 'streaming',
  };
  return interrupted
    ? `${name} stopped ${verbs[type ?? 'play'] ?? 'the activity'} early.`
    : `${name} finished ${verbs[type ?? 'play'] ?? 'the activity'}.`;
}

function isNarrativeEvent(type: string): boolean {
  return [
    'item_refused',
    'item_reaction',
    'item_discovery',
    'item_preparation',
    'item_placed',
    'item_unplaced',
    'craving_fulfilled',
    'sickness_onset',
    'sick_feeding_harm',
    'kidney_stone_onset',
    'kidney_stone_recurrence',
    'sugar_crash',
    'low_money_stress',
    'food_craving',
    'creative_inspiration',
    'socks',
    'benign_room_event',
    'item_automatic_hook',
  ].includes(type);
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
) {
  entries.push({
    id: event.id,
    at: event.at,
    message,
    sourceEventIds: [event.id],
  });
}
