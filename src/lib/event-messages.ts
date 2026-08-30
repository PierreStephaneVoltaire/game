import type { Activity, StatusName } from './game-types';
import eventTexts from './data/event-texts.json';
import { selectSeededText, type SeededTextContext } from './seeded-text';

export type BuiltInEventType = keyof typeof eventTexts.builtInEvents;
export type EventTemplateId = keyof typeof eventTexts.eventTemplates;
export type LifeEventTextId = keyof typeof eventTexts.lifeEvents;

export function messageFor(
  type: BuiltInEventType,
  context?: SeededTextContext,
): string {
  return selectSeededText(
    eventTexts.builtInEvents[type],
    context,
    `builtInEvents.${type}`,
  );
}

export function eventTemplate(
  id: EventTemplateId,
  values: Record<string, string> = {},
  context?: SeededTextContext,
): string {
  return selectSeededText(
    eventTexts.eventTemplates[id],
    context,
    `eventTemplates.${id}`,
    values,
  );
}

export function lifeEventMessage(
  id: LifeEventTextId,
  context?: SeededTextContext,
  values: Record<string, string> = {},
): string {
  return selectSeededText(
    eventTexts.lifeEvents[id],
    context,
    `lifeEvents.${id}`,
    values,
  );
}

export function statusDisplayName(status: StatusName): string {
  return eventTexts.statusNames[status];
}

export function statusTransitionMessage(
  status: StatusName,
  active: boolean,
  context?: SeededTextContext,
): string {
  return eventTemplate(
    active ? 'status_activated' : 'status_cleared',
    {
      status: statusDisplayName(status),
    },
    context,
  );
}

export function activityCompletionMessage(
  type: Activity['type'],
  context?: SeededTextContext,
): string {
  return selectSeededText(
    eventTexts.activityCompletions[type],
    context,
    `activityCompletions.${type}`,
  );
}
