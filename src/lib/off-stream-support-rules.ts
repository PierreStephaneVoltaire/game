import { simulationRules as rules } from './runtime-definition';
import { HOUR_MS } from './game-constants';
import type { GameEvent, GameState } from './game-types';
import { creditIncome } from './income-rules';
import { actionRandom } from './seeded-rng';
import { finalizeFinancialOperation } from './financial-rules';

export function resolveOffStreamSupport(
  state: GameState,
  commandId: string,
  opportunityEvent: GameEvent,
): GameState {
  const payoutRules = rules.events.offStreamSupport.payout;
  const amount =
    payoutRules.minimum +
    Math.floor(
      actionRandom(
        state.seed,
        state.stateVersion,
        commandId,
        'off_stream_support',
        'payout',
      ) *
        (payoutRules.maximum - payoutRules.minimum + 1),
    );
  const event: GameEvent = {
    id: `event-${state.events.length + 2}`,
    type: 'off_stream_support',
    at: state.now,
    message: `A fan sent $${amount} of support while the companion was offline.`,
    sourceActionId: commandId,
    amount,
  };
  const credited = creditIncome(state, amount);
  const mutated: GameState = {
    ...credited,
    history: {
      ...state.history,
      eventCooldowns: {
        ...state.history.eventCooldowns,
        off_stream_support:
          state.now + rules.events.offStreamSupport.cooldownHours * HOUR_MS,
      },
    },
    events: [...state.events, opportunityEvent, event],
    stateVersion: state.stateVersion + 2,
  };
  return finalizeFinancialOperation({
    before: state,
    state: mutated,
    triggerEventId: event.id,
    kind: 'off_stream_support_income',
  });
}
