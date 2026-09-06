import type { GameCommand, GameEvent, GameState } from '$lib/game-types';

export type EventRecord = GameEvent & { gameHash: string; sequence: number };

export type GameRecord = {
  gameHash: string;
  state: GameState;
  stateVersion: number;
  lastAcknowledgedSequence: number;
  lastAcknowledgedEventId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type OutboxRecord = {
  batchId: string;
  gameHash: string;
  baseStateVersion: number;
  previousEventId: string | null;
  contentVersion: string;
  commands: GameCommand[];
  events: EventRecord[];
  targetState: GameState;
  createdAt: number;
  retryCount: number;
};

export type SyncAcknowledgement = {
  gameHash: string;
  stateVersion: number;
  committedThroughSequence: number;
  committedThroughEventId: string | null;
};
