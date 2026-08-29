import type { Candidate } from './event-candidate-pool';
import { finalizeFinancialOperation } from './financial-rules';
import type { GameEvent, GameState, Metrics } from './game-types';
import { creditIncome } from './income-rules';
import { reconcileMetricSource } from './status-rules/metric-source-reconciliation';

/** Commit one built-in autonomous event after all authored effects are known. */
export function finalizeBuiltInEvent(input: {
  state: GameState;
  commandId: string;
  selected: Candidate;
  opportunityEvent: GameEvent;
  event: GameEvent;
  metrics: Metrics;
  inventory: GameState['inventory'];
  balanceDelta: number;
  cooldowns: Record<string, number>;
  oncePerLocalDate: Record<string, string>;
  cravingItemId: string | null;
  cravingStartedAt: number | null;
  cravingRefreshCount: number;
}): GameState {
  const normalized = reconcileMetricSource(
    input.state,
    {
      ...creditIncome(input.state, input.balanceDelta),
      metrics: input.metrics,
      inventory: input.inventory,
      history: {
        ...input.state.history,
        eventCooldowns: input.cooldowns,
        oncePerLocalDate: input.oncePerLocalDate,
        cravingItemId: input.cravingItemId,
        cravingStartedAt: input.cravingStartedAt,
        cravingRefreshCount: input.cravingRefreshCount,
        lastMovementAt:
          input.selected === 'tiny_walk'
            ? input.state.now
            : input.state.history.lastMovementAt,
      },
      events: [...input.state.events, input.opportunityEvent, input.event],
      stateVersion: input.state.stateVersion + 2,
    },
    input.commandId,
  );
  const completed: GameState = {
    ...normalized,
    history: {
      ...normalized.history,
      lastBondGainAt:
        normalized.metrics.bond > input.state.metrics.bond
          ? input.state.now
          : normalized.history.lastBondGainAt,
    },
  };
  return input.balanceDelta === 0
    ? completed
    : finalizeFinancialOperation({
        before: input.state,
        state: completed,
        triggerEventId: input.event.id,
        kind: 'automatic_event_cash',
      });
}
