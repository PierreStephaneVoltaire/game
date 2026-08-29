import type {
  DeathCause,
  GameEvent,
  GameState,
  HealthDamageSource,
} from '../game-types';
import { deathCauseText, deathEventMessage } from '../ending-rules/messages';
import { stateTextContext, type SeededTextContext } from '../seeded-text';

export function recordDeath(state: GameState): GameState {
  if (state.ending || state.metrics.health > 0) return state;
  const finalDamageEvent = [...state.events]
    .reverse()
    .find((event) => (event.metricDeltas?.health ?? 0) < 0);
  const finalDamageEvents = finalDamageEvent
    ? state.events.filter(
        (event) =>
          (event.metricDeltas?.health ?? 0) < 0 &&
          event.at === finalDamageEvent.at &&
          event.sourceActionId === finalDamageEvent.sourceActionId,
      )
    : [];
  const textContext = stateTextContext(
    state,
    finalDamageEvent?.sourceActionId ?? `death:${state.now}`,
  );
  const sources = finalDamageEvents.length
    ? finalDamageEvents.flatMap((event) =>
        event.healthDamageSources?.length
          ? event.healthDamageSources
          : [fallbackSource(event, textContext)],
      )
    : [unknownSource(textContext)];
  const causes = deduplicateCauses(sources);
  const causalIds = unique([
    ...sources.flatMap((source) => source.eventIds),
    ...finalDamageEvents.flatMap((event) => [
      ...(event.causedBy ?? []),
      event.id,
    ]),
  ]);
  const cause = causes.map((item) => item.name).join(', ');
  const deathEvent: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'death',
    at: state.now,
    message: deathEventMessage(textContext),
    cause,
    causedBy: causalIds,
  };
  return {
    ...state,
    ending: {
      kind: 'death',
      at: state.now,
      cause,
      causes,
      eventIds: [...causalIds, deathEvent.id],
    },
    events: [...state.events, deathEvent],
  };
}

function deduplicateCauses(sources: HealthDamageSource[]): DeathCause[] {
  const causes: DeathCause[] = [];
  for (const source of sources) {
    const existing = causes.find(
      (cause) => cause.kind === source.kind && cause.id === source.id,
    );
    if (existing)
      existing.eventIds = unique([...existing.eventIds, ...source.eventIds]);
    else
      causes.push({
        kind: source.kind,
        id: source.id,
        name: source.name,
        eventIds: unique(source.eventIds),
      });
  }
  return causes;
}

function fallbackSource(
  event: GameEvent,
  textContext: SeededTextContext,
): HealthDamageSource {
  if (event.status === 'sick')
    return source(
      'status',
      'sick',
      deathCauseText('sickness', textContext),
      event,
    );
  if (event.status === 'kidney_stone')
    return source(
      'status',
      'kidney_stone',
      deathCauseText('kidneyStoneComplications', textContext),
      event,
    );
  return source(
    event.cause ? 'item' : 'event',
    event.cause ?? event.type,
    event.message || deathCauseText('unknown', textContext),
    event,
  );
}

function source(
  kind: HealthDamageSource['kind'],
  id: string,
  name: string,
  event: GameEvent,
): HealthDamageSource {
  return {
    kind,
    id,
    name,
    amount: Math.abs(event.metricDeltas?.health ?? 0),
    eventIds: [...(event.causedBy ?? []), event.id],
  };
}

function unknownSource(textContext: SeededTextContext): HealthDamageSource {
  return {
    kind: 'event',
    id: 'unknown',
    name: deathCauseText('unknown', textContext),
    amount: 0,
    eventIds: [],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
