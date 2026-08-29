import type { GameState, Metrics, StatusName } from '../game-types';
import rules from '../data/simulation-rules.json';
import { HOUR_MS } from '../game-constants';

export type StatusEffectEvent = {
  status: StatusName;
  metricDeltas: Partial<Metrics>;
  message: string;
  at?: number;
};

export function applyLowStatusRecurrences(
  state: GameState,
  at: number,
): { statuses: GameState['statuses']; effects: StatusEffectEvent[] } {
  const statuses = { ...state.statuses };
  const effects: StatusEffectEvent[] = [];
  for (const [status, metric] of [
    ['lonely', 'bond'],
    ['creative_block', 'creativity'],
  ] as const) {
    if (state.metrics[metric] > rules.statusRules.lowMetricOnsetMaximum)
      continue;
    const record = statuses[status];
    if (!record) continue;
    const lastPenaltyAt = record.lastPenaltyAt ?? record.since;
    const recurrenceMs = rules.statusRules.recurrenceHours * HOUR_MS;
    const occurrences = Math.floor((at - lastPenaltyAt) / recurrenceMs);
    if (occurrences < 1) continue;
    statuses[status] = {
      ...record,
      lastPenaltyAt: lastPenaltyAt + occurrences * recurrenceMs,
    };
    for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
      effects.push({
        status,
        metricDeltas: {
          mood: rules.statusMetricDeltas.lowStatusRecurrenceMood,
        },
        at: lastPenaltyAt + (occurrence + 1) * recurrenceMs,
        message:
          status === 'lonely'
            ? 'Companion is still feeling lonely.'
            : 'Companion is still creatively blocked.',
      });
    }
  }
  return { statuses, effects };
}
