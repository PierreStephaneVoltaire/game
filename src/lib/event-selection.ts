import type { GameDefinition } from './game-definition';
import type { GameEvent, GameState } from './game-types';
import { eventCandidates, type Candidate } from './event-candidate-pool';
import { actionRandom } from './seeded-rng';
import { localDate } from './shop-rules';
import { streamWeight } from './stream-rules';
import { eventTemplate } from './event-messages';
import { stateTextContext } from './seeded-text';

/** Select one seeded candidate and author its shared opportunity evidence. */
export function selectAttemptEvent(
  state: GameState,
  commandId: string,
  definition: GameDefinition,
): { selected: Candidate; opportunityEvent: GameEvent } {
  const resolvedStreamWeight = streamWeight(state, commandId);
  const candidates = eventCandidates(
    state,
    definition,
    localDate(state.now, state.timezone),
    resolvedStreamWeight,
  );
  const total = candidates.reduce(
    (sum, candidate) => sum + candidate.weight,
    0,
  );
  let remaining =
    actionRandom(
      state.seed,
      state.stateVersion,
      commandId,
      'autonomous_event',
      'pool',
    ) * total;
  const selected: Candidate =
    state.progression.queuedEventStreams.length > 0 && resolvedStreamWeight > 0
      ? 'stream'
      : (candidates.find((candidate) => {
          remaining -= candidate.weight;
          return remaining < 0;
        })?.type ?? 'none');
  return {
    selected,
    opportunityEvent: {
      id: `event-${state.events.length + 1}`,
      type: 'random_event_opportunity',
      at: state.now,
      message: eventTemplate(
        'random_event_opportunity',
        {},
        stateTextContext(state, commandId),
      ),
      sourceActionId: commandId,
      cause: selected,
    },
  };
}
