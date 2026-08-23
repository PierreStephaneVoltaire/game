import type { GameState, GameEvent } from '../game-types';
import type { StatusReconciliation } from '../status-rules';
import { sugarCrashMetricDeltas } from '../status-rules';
import { statusDisplayName } from '../event-messages';
import { healthDamageSource } from './health-resolution';

/** Appends chronological status and sugar-crash narration to the ledger. */
export function appendTimelineStatusEvents(input: {
  state: GameState;
  reconciliation: StatusReconciliation;
  at: number;
}): { state: GameState; eventIds: string[] } {
  let next = input.state;
  const eventIds: string[] = [];
  const append = (event: GameEvent) => {
    next = { ...next, events: [...next.events, event] };
    eventIds.push(event.id);
  };
  for (const effect of input.reconciliation.onsetEffects) {
    if (!next.statuses[effect.status]) continue;
    append({
      id: `event-${next.events.length + 1}`,
      type: 'status_onset',
      at: effect.at ?? input.at,
      message: effect.message,
      status: effect.status,
      metricDeltas: effect.metricDeltas,
      healthDamageSources: damageSourcesForStatusEffect(
        effect.status,
        effect.metricDeltas.health,
      ),
    });
  }
  for (const effect of input.reconciliation.recurrenceEffects) {
    if (!next.statuses[effect.status]) continue;
    append({
      id: `event-${next.events.length + 1}`,
      type: 'status_recurrence',
      at: effect.at ?? input.at,
      message: effect.message,
      status: effect.status,
      metricDeltas: effect.metricDeltas,
      healthDamageSources: damageSourcesForStatusEffect(
        effect.status,
        effect.metricDeltas.health,
      ),
    });
  }
  for (const effect of input.reconciliation.clearEffects) {
    if (next.statuses[effect.status]) continue;
    append({
      id: `event-${next.events.length + 1}`,
      type: 'status_cleared',
      at: effect.at ?? input.at,
      message: effect.message,
      status: effect.status,
      metricDeltas: effect.metricDeltas,
    });
  }
  if (input.reconciliation.sugarCrash) {
    const sugarCrash = sugarCrashMetricDeltas();
    append({
      id: `event-${next.events.length + 1}`,
      type: 'sugar_crash',
      at: input.at,
      message: 'Companion hit a sugar crash.',
      status: 'sugar_crash',
      metricDeltas: { mood: sugarCrash.mood, rest: sugarCrash.rest },
    });
  }
  return { state: next, eventIds };
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
