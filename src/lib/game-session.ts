import { derived, writable } from 'svelte/store';
import { GameController } from './game-controller';
import type {
  GameDefinition,
  GameDefinitionRepository,
} from './game-definition';
import { InMemoryGameDefinitionRepository } from './game-definition';
import { RuntimeContentCache } from './content/runtime-content';
import type { GameCommand, GameState, Outcome } from './game-types';
import {
  createGameViewModel,
  intentToCommand,
  type GameIntent,
  type GameViewModel,
} from './ui/game-view-model';
import { UiCommandSequence } from './ui/command-sequence';
import {
  loadGame,
  loadActiveGameHash,
  saveNewGame,
  saveTransition,
  setActiveGameHash,
} from './persistence/games';
import { nextOutbox, replacePending } from './persistence/outbox';
import { flushGame } from './persistence/sync';
import type { EventRecord } from './persistence/types';

const runtimeContent = new RuntimeContentCache();
let activeController = new GameController(runtimeContent);
const gameSession = writable<{
  state: GameState;
  definition: GameDefinition;
} | null>(null);
const commandSequence = new UiCommandSequence();
export const gameViewModel = derived<typeof gameSession, GameViewModel | null>(
  gameSession,
  ($session) =>
    $session ? createGameViewModel($session.state, $session.definition) : null,
);

function publishGameState(state: GameState): void {
  const definition = activeController.currentDefinition;
  if (!definition) throw new Error('Game definition was not loaded.');
  gameSession.set({ state, definition });
}

type RemoteGame = {
  stateVersion: number;
  lastEventSequence: number;
  lastEventId: string | null;
  state: GameState;
};

async function replayPending(gameHash: string): Promise<void> {
  const pending = await nextOutbox(gameHash);
  if (!pending) return;
  const definition = await runtimeContent.load();
  const controller = new GameController(
    new InMemoryGameDefinitionRepository(definition),
  );
  const response = await fetch(`/api/games/${encodeURIComponent(gameHash)}`, {
    credentials: 'same-origin',
    headers: { 'x-content-version': definition.version },
  });
  let baseStateVersion: number;
  let baseEventSequence: number;
  let previousEventId: string | null;
  let state: GameState;
  let committedEventCount: number;
  if (response.status === 404 && pending.baseStateVersion === 0) {
    state = await controller.start({
      mode: pending.targetState.mode,
      now: pending.targetState.history.runStartedAt,
      seed: gameHash,
      timezone: pending.targetState.timezone,
    });
    baseStateVersion = 0;
    baseEventSequence = 0;
    previousEventId = null;
    committedEventCount = 0;
  } else {
    if (!response.ok) throw new Error('Could not load the canonical game.');
    const remote = (await response.json()) as RemoteGame;
    state = await controller.load({
      ...remote.state,
      definitionVersion: definition.version,
    });
    baseStateVersion = remote.stateVersion;
    baseEventSequence = remote.lastEventSequence;
    previousEventId = remote.lastEventId;
    committedEventCount = state.events.length;
  }
  for (const command of pending.commands) {
    state = (
      await controller.dispatch({
        ...command,
        expectedStateVersion: state.stateVersion,
      })
    ).state;
  }
  if (
    state.mode === 'realtime' &&
    pending.targetState.now > state.now &&
    !state.ending
  )
    state = (await controller.reconcile(pending.targetState.now)).state;
  const events: EventRecord[] = state.events
    .slice(committedEventCount)
    .map((event, index) => ({
      ...event,
      gameHash,
      sequence: baseEventSequence + index + 1,
    }));
  if (
    !(await replacePending(
      pending,
      state,
      events,
      baseStateVersion,
      baseEventSequence,
      previousEventId,
      definition.version,
    ))
  )
    return replayPending(gameHash);
  if (activeController.current?.seed === gameHash) {
    activeController = controller;
    publishGameState(state);
  }
}

function syncGame(gameHash: string): void {
  void flushGame(gameHash, {
    refreshContent: async () => {
      await runtimeContent.refreshBeforeWrite();
    },
    replayConflict: replayPending,
  });
}

const GAME_KEY_PATTERN = /^\d{8}$/;

export function useGameDefinitionRepository(
  repository: GameDefinitionRepository,
): void {
  activeController = new GameController(repository);
  gameSession.set(null);
}

export function gameKeyIsValid(gameKey: string): boolean {
  return GAME_KEY_PATTERN.test(gameKey.trim());
}

export function createGameKey(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0]! % 100_000_000).padStart(8, '0');
}

export async function openGameSession(gameKey: string): Promise<boolean> {
  const key = gameKey.trim();
  if (!gameKeyIsValid(key)) return false;
  const persisted = await loadGame(key);
  try {
    const stored = persisted?.state ?? null;
    if (!stored) return false;
    const state = stored;
    if (state.seed !== key) return false;
    commandSequence.reset();
    await activeController.load(state);
    await setActiveGameHash(key);
    publishGameState(state);
    syncGame(key);
    return true;
  } catch {
    return false;
  }
}

export async function beginGameSession(
  mode: 'realtime' | 'streaming',
  gameKey: string,
): Promise<void> {
  const seed = gameKey.trim();
  if (!gameKeyIsValid(seed))
    throw new Error('An eight-digit game key is required.');
  commandSequence.reset();
  const state = await activeController.start({
    mode,
    now: Date.now(),
    seed,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  await saveNewGame(state);
  publishGameState(state);
  syncGame(seed);
}

export async function ensureGameSession(): Promise<boolean> {
  if (!activeController.current) {
    const gameHash = await loadActiveGameHash();
    if (!gameHash || !(await openGameSession(gameHash))) return false;
  }
  await reconcileGameClock();
  return true;
}

async function sendGameCommand(command: GameCommand): Promise<Outcome> {
  const before = activeController.current;
  if (!before) throw new Error('Start a game session before sending actions.');
  const transition = await activeController.dispatch(command);
  await saveTransition(before, transition.state, command);
  publishGameState(transition.state);
  syncGame(transition.state.seed);
  return (
    transition.outcomes[0] ?? {
      accepted: false,
      kind: 'empty',
      message: 'No outcome was returned.',
      eventIds: [],
    }
  );
}

export async function sendGameIntent(intent: GameIntent): Promise<Outcome> {
  let state = activeController.current;
  if (!state) throw new Error('Start a game session before sending actions.');
  if (state.mode === 'realtime') {
    await reconcileGameClock();
    state = activeController.current;
    if (!state) throw new Error('The active game session was lost.');
  }
  return sendGameCommand(
    intentToCommand(intent, state, commandSequence.next()),
  );
}

export async function reconcileGameClock(): Promise<void> {
  const current = activeController.current;
  if (!current || current.mode !== 'realtime') return;
  const transition = await activeController.reconcile(Date.now());
  await saveTransition(current, transition.state);
  publishGameState(transition.state);
  syncGame(transition.state.seed);
}

if (typeof window !== 'undefined')
  window.addEventListener('online', () => {
    const state = activeController.current;
    if (state) syncGame(state.seed);
  });
