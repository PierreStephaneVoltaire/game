import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';
import type { GameState } from './game-types';

export const HOUR = 3_600_000;
export const NOW = Date.UTC(2026, 0, 2, 10);

const BASE = startRun(
  { mode: 'realtime', now: NOW, seed: 'fixture', timezone: 'UTC' },
  BUNDLED_GAME_DEFINITION,
);

export function eligibleRun(seed: string, droughtHours: number): GameState {
  return eligibleRunAt(seed, droughtHours, NOW);
}

export function eligibleRunAt(
  seed: string,
  droughtHours: number,
  now: number,
): GameState {
  return {
    ...BASE,
    seed,
    now,
    lastResolvedAt: now,
    metrics: {
      food: 10,
      health: 10,
      mood: 5,
      rest: 10,
      bond: 8,
      creativity: 5,
    },
    statuses: {},
    history: {
      ...BASE.history,
      lastStatusReconcileAt: now,
      nextAutonomousAt: now + 2 * HOUR,
      cravingItemId: 'water',
      eventCooldowns: {
        inspiration: Number.MAX_SAFE_INTEGER,
        socks: Number.MAX_SAFE_INTEGER,
        room: Number.MAX_SAFE_INTEGER,
        moms_care_package: Number.MAX_SAFE_INTEGER,
      },
    },
    progression: {
      ...BASE.progression,
      lastAutonomousStreamSelectedAt: now - droughtHours * HOUR,
    },
  };
}

export function opportunityCauseAt(
  seed: string,
  droughtHours: number,
  now: number,
) {
  const state = eligibleRunAt(seed, droughtHours, now);
  return dispatchCommand(
    state,
    {
      type: 'use_item',
      commandId: 'stream-protection-opportunity',
      itemId: 'missing',
      now,
    },
    BUNDLED_GAME_DEFINITION,
  ).state.events.find((event) => event.type === 'random_event_opportunity')
    ?.cause;
}

export function opportunityCause(seed: string, droughtHours: number) {
  return opportunityCauseAt(seed, droughtHours, NOW);
}
