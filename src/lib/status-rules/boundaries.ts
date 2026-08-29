import type { GameState } from '../game-types';
import rules from '../data/simulation-rules.json';
import { HOUR_MS } from '../game-constants';

export function nextStatusBoundary(
  state: GameState,
  after: number,
): number | undefined {
  const candidates: number[] = [];
  const clearBase = state.history.lastCareAttemptAt;
  if (state.statuses.overstimulated)
    candidates.push(
      clearBase + rules.statusRules.overstimulatedClearHours * HOUR_MS,
    );
  if (state.statuses.annoyed)
    candidates.push(clearBase + rules.statusRules.annoyedClearHours * HOUR_MS);
  for (const status of ['lonely', 'creative_block'] as const) {
    const record = state.statuses[status];
    if (record)
      candidates.push(
        (record.lastPenaltyAt ?? record.since) +
          rules.statusRules.recurrenceHours * HOUR_MS,
      );
  }
  const kidney = state.statuses.kidney_stone;
  if (kidney)
    candidates.push(
      (kidney.lastPenaltyAt ?? kidney.since) +
        rules.kidneyStoneRecurrenceHours * HOUR_MS,
    );
  for (const status of ['kidney_stone', 'sick', 'dizzy_spell'] as const) {
    const pass = state.statuses[status]?.naturalPassAt;
    if (pass) candidates.push(pass);
  }
  return candidates
    .filter((candidate) => candidate > after)
    .sort((a, b) => a - b)[0];
}
