import type { GameEvent, GameState, StatusName } from '../game-types';
import { alignGameStatuses, applyStatusOnsetEffects } from '../status-rules';
import { resolveStatusFixedPoint } from './fixed-point';

const METRIC_STATUSES = new Set<StatusName>([
  'starving',
  'hungry',
  'sleep_deprived',
  'depressed',
  'lonely',
  'creative_block',
  'low_energy',
  'full',
]);

/**
 * Normalizes metric-owned statuses after an immediate metric source. Contextual
 * statuses already resolved by the source are preserved, while metric onset
 * effects are evaluated from the pre-source status baseline exactly once.
 */
export function reconcileMetricSource(
  before: GameState,
  state: GameState,
  sourceActionId: string,
): GameState {
  const metrics = {
    ...state.metrics,
    ...(state.timedEffects.hyperfocusUntil !== null &&
    state.now < state.timedEffects.hyperfocusUntil
      ? { creativity: 10 }
      : {}),
  };
  const previous = { ...before.statuses };
  for (const status of Object.keys(state.statuses) as StatusName[]) {
    if (!METRIC_STATUSES.has(status)) previous[status] = state.statuses[status];
  }
  for (const status of Object.keys(previous) as StatusName[]) {
    if (!METRIC_STATUSES.has(status) && !state.statuses[status])
      delete previous[status];
  }
  const normalized = resolveStatusFixedPoint({
    metrics,
    previous,
    now: state.now,
    align: alignGameStatuses,
    applyOnset: applyStatusOnsetEffects,
  });
  const events: GameEvent[] = normalized.events.map((effect, index) => ({
    id: `event-${state.events.length + index + 1}`,
    type: 'status_onset',
    at: state.now,
    message: effect.message,
    sourceActionId,
    status: effect.status,
    metricDeltas: effect.metricDeltas,
  }));
  return {
    ...state,
    metrics: normalized.metrics,
    statuses: normalized.statuses,
    events: events.length ? [...state.events, ...events] : state.events,
  };
}
