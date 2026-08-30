import type { GameDefinition } from '../../../../src/lib/game-definition';
import { reconcileTime } from '../../../../src/lib/game-engine';
import type { GameState } from '../../../../src/lib/game-types';

/**
 * Streaming-mode reconciliation may deliberately return at an interrupted
 * activity boundary. Studies need to resume until the requested observation
 * timestamp so a run cannot be mislabeled as a horizon result before day 60.
 */
export function reconcileThrough(
  state: GameState,
  targetAt: number,
  definition: GameDefinition,
): GameState {
  let next = state;
  while (!next.ending && next.lastResolvedAt < targetAt) {
    const before = next.lastResolvedAt;
    next = reconcileTime(next, targetAt, definition).state;
    if (next.lastResolvedAt <= before)
      throw new Error(
        `Balance study reconciliation stalled at ${before} before ${targetAt}`,
      );
  }
  return next;
}
