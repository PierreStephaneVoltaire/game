import type { Activity, GameEvent } from '$lib/game-types';
import { companionProfile } from '$lib/companion-profile';
import { eventTexts } from '$lib/runtime-definition';

export function activityJourneyMessage(
  events: GameEvent[],
  event: GameEvent,
  petName: string,
): string | undefined {
  if (event.type === 'activity_started') return activityStarted(event, petName);
  if (
    event.type !== 'activity_completed' &&
    event.type !== 'activity_interrupted'
  )
    return undefined;

  const interrupted = event.type === 'activity_interrupted';
  if (
    !interrupted &&
    event.activityType === 'commission_work' &&
    events.some(
      (candidate) =>
        candidate.type === 'full_body_project_completed' &&
        candidate.at === event.at &&
        candidate.sourceActionId === event.sourceActionId,
    )
  )
    return undefined;
  return activityEnded(events, event, petName, interrupted);
}

function activityStarted(event: GameEvent, name: string): string {
  if (event.activityType === 'medical_care')
    return `${name} checked into the hospital for treatment.`;
  if (event.activityType === 'rest')
    return event.sourceActionId?.startsWith('autonomous:') ||
      event.message.toLowerCase().includes('autonomous')
      ? `${name} curled up for a nap on their own.`
      : `${name} settled down to rest.`;
  if (event.activityType === 'socialize')
    return `${name} started spending time together with you.`;
  if (event.activityType === 'play') return `${name} started playing.`;
  if (event.activityType === 'stream') return `${name} started streaming.`;
  if (event.activityType === 'commission_work')
    return `${name} settled in for a focused stretch of Commission Work.`;
  return `${name} started an activity.`;
}

function activityEnded(
  events: GameEvent[],
  event: GameEvent,
  name: string,
  interrupted: boolean,
): string {
  const type = event.activityType;
  if (
    !interrupted &&
    type &&
    eventTexts.activityCompletions[type].some(
      (template: string) =>
        template.replaceAll('{pet}', companionProfile.displayName) ===
        event.message,
    )
  )
    return event.message.replaceAll(companionProfile.displayName, name);
  if (type === 'medical_care')
    return `${name} came home from the hospital rested and medically cleared.`;
  if (type === 'commission_work')
    return `${name} had to stop Commission Work early, so the job did not pay out.`;
  if (type === 'stream') return streamEnded(events, event, name, interrupted);
  const verbs: Partial<Record<Activity['type'], string>> = {
    rest: 'resting',
    socialize: 'socializing',
    play: 'playing',
  };
  return `${name} stopped ${verbs[type ?? 'play'] ?? 'the activity'} early.`;
}

function streamEnded(
  events: GameEvent[],
  event: GameEvent,
  name: string,
  interrupted: boolean,
): string {
  const start = events.find(
    (candidate) =>
      candidate.sourceActionId === event.sourceActionId &&
      (candidate.type === 'tournament_stream' ||
        candidate.type === 'model_debut_stream'),
  );
  const kind =
    start?.type === 'tournament_stream'
      ? 'the tournament stream'
      : start?.type === 'model_debut_stream'
        ? 'the model debut stream'
        : 'streaming';
  return interrupted
    ? `${name} had to stop ${kind} early.`
    : kind === 'streaming'
      ? `${name} finished streaming.`
      : `${name} finished ${kind}.`;
}
