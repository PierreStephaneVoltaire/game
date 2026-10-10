import type { GameState } from '../game-types';
import { observeBoundaries } from '../simulation/resolution-boundary';
import { MAX_SAVE_EVENTS } from '../game-constants';

export function collectSavePoints<T>(
  before: GameState,
  execute: () => T,
  stateOf: (result: T) => GameState,
) {
  const states: GameState[] = [];
  let baseCount = before.events.length;
  let previous = before;
  const result = observeBoundaries((state) => {
    if (state.events.length - baseCount > MAX_SAVE_EVENTS) {
      if (previous.events.length === baseCount)
        throw new Error('One atomic effect exceeds the save event limit.');
      states.push(previous);
      baseCount = previous.events.length;
    }
    previous = state;
  }, execute);
  const final = stateOf(result);
  if (final.events.length - baseCount > MAX_SAVE_EVENTS) {
    states.push(previous);
  }
  states.push(final);
  return { result, states };
}
