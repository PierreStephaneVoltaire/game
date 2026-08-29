import type { Activity, StatusName } from './game-types';
import eventTexts from './data/event-texts.json';

export type BuiltInEventType = keyof typeof eventTexts.builtInEvents;
export type EventTemplateId = keyof typeof eventTexts.eventTemplates;
export type LifeEventTextId = keyof typeof eventTexts.lifeEvents;

export function messageFor(type: BuiltInEventType): string {
  return eventTexts.builtInEvents[type];
}

export function eventTemplate(
  id: EventTemplateId,
  values: Record<string, string> = {},
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    eventTexts.eventTemplates[id],
  );
}

export function lifeEventMessage(id: LifeEventTextId): string {
  return eventTexts.lifeEvents[id];
}

export function statusDisplayName(status: StatusName): string {
  return eventTexts.statusNames[status];
}

export function statusTransitionMessage(
  status: StatusName,
  active: boolean,
): string {
  return eventTemplate(active ? 'status_activated' : 'status_cleared', {
    status: statusDisplayName(status),
  });
}

export function activityCompletionMessage(type: Activity['type']): string {
  return eventTexts.activityCompletions[type];
}
