import { actionRandom, resolveRange } from './seeded-rng';
import { nextLocalMidnight } from './shop-rules';
import rules from './data/simulation-rules.json';
import type { ItemDefinition } from './game-definition';
import type { GameState, Project } from './game-types';
import { DAY_MS } from './game-constants';

export function projectCompletionAt(startedAt: number): number {
  return startedAt + rules.projects.completionMidnights * DAY_MS;
}

export function projectCompletionAtLocalMidnight(
  startedAt: number,
  timezone: string,
): number {
  let boundary = startedAt;
  for (let count = 0; count < rules.projects.completionMidnights; count += 1)
    boundary = nextLocalMidnight(boundary, timezone);
  return boundary;
}

export function projectId(state: GameState, type: Project['type']): string {
  return `${type}-${state.actionOrdinal + state.projects.length + 1}`;
}

export function modelTierForItem(
  item: ItemDefinition,
): 1 | 2 | 3 | 4 | undefined {
  return item.progression?.modelTier;
}

export function resolveFullBodyPayout(
  state: GameState,
  sourceActionId: string,
): number {
  const range = rules.projects.fullBodyPayout;
  return resolveRange(
    { min: range.minimum, max: range.maximum },
    actionRandom(
      state.seed,
      state.stateVersion,
      sourceActionId,
      'full_body_project',
      'payout',
    ),
  );
}
