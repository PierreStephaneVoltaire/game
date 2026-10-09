import type { GameState } from '../game-types';

let observer: ((state: GameState) => void) | undefined;

export function resolvedBoundary<T extends GameState>(state: T): T {
  observer?.(state);
  return state;
}

export function observeBoundaries<T>(
  onBoundary: (state: GameState) => void,
  execute: () => T,
): T {
  const previous = observer;
  observer = onBoundary;
  try {
    return execute();
  } finally {
    observer = previous;
  }
}
