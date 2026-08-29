import type { GameDefinition } from '../game-definition';
import type {
  GameCommand,
  GameState,
  Outcome,
  Transition,
} from '../game-types';
import { accepted, rejected } from '../simulation/engine-state';

type FeedItemsCommand = Extract<GameCommand, { type: 'feed_items' }>;
type FeedOne = Extract<GameCommand, { type: 'use_item' }>;

/**
 * Resolves a feed selection exactly as consecutive single-item commands. The
 * stable item-id order makes the result independent of UI object iteration.
 */
export function resolveBatchFeeding(
  state: GameState,
  command: FeedItemsCommand,
  definition: GameDefinition,
  dispatchOne: (state: GameState, command: FeedOne) => Transition,
): { state: GameState; outcome: Outcome } {
  const selected = command.items
    .filter(
      (selection) =>
        Number.isInteger(selection.quantity) && selection.quantity > 0,
    )
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
  if (!selected.length)
    return {
      state,
      outcome: rejected('unavailable', 'Choose at least one item to feed.'),
    };

  let next = state;
  const outcomes: Outcome[] = [];
  for (const selection of selected) {
    for (let unit = 0; unit < selection.quantity; unit += 1) {
      if (next.ending) break;
      const childCommand: FeedOne = {
        type: 'use_item',
        commandId: `${command.commandId}:feed:${selection.itemId}:${unit + 1}`,
        itemId: selection.itemId,
        now: next.now,
      };
      const result = dispatchOne(next, childCommand);
      next = result.state;
      outcomes.push(result.outcomes[0]!);
    }
    if (next.ending) break;
  }

  const successful = outcomes.filter((outcome) => outcome.accepted);
  if (!successful.length)
    return {
      state: next,
      outcome:
        outcomes.at(-1) ??
        rejected('unavailable', 'That food is not available.'),
    };
  const eventIds = successful.flatMap((outcome) => outcome.eventIds);
  return {
    state: next,
    outcome: accepted(
      'items_fed',
      `Fed ${successful.length} ${successful.length === 1 ? 'item' : 'items'}.`,
      eventIds,
    ),
  };
}
