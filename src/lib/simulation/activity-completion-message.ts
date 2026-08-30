import { activityCompletionMessage } from '../event-messages';
import type { Activity, GameState } from '../game-types';
import { stateTextContext } from '../seeded-text';

export function activityCompletionNarration(
  state: GameState,
  activity: Activity,
  interrupted: boolean,
): string {
  const message = activityCompletionMessage(
    activity.type,
    stateTextContext(state, activity.sourceActionId),
  );
  return interrupted
    ? `${message.replace(/ finished\.$/, '')} ended early.`
    : message;
}
