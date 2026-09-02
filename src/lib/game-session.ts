import { derived, writable } from 'svelte/store';
import { BundledGameDefinitionRepository } from './game-definition';
import { GameController } from './game-controller';
import type { GameDefinition } from './game-definition';
import type { GameCommand, GameState, Outcome } from './game-types';
import {
  createGameViewModel,
  intentToCommand,
  type GameIntent,
  type GameViewModel,
} from './ui/game-view-model';
import { UiCommandSequence } from './ui/command-sequence';

const activeController = new GameController(
  new BundledGameDefinitionRepository(),
);
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
  persistGameState(state);
}

const GAME_KEY_PATTERN = /^\d{8}$/;
const GAME_KEY_LIST = 'virtual-pet-game-keys';
const gameStateKey = (gameKey: string) => `virtual-pet-game:${gameKey}`;

function sessionStorageAvailable(): boolean {
  return typeof sessionStorage !== 'undefined';
}

function persistGameState(state: GameState): void {
  if (!sessionStorageAvailable() || !GAME_KEY_PATTERN.test(state.seed)) return;
  sessionStorage.setItem(gameStateKey(state.seed), JSON.stringify(state));
  const keys = new Set(listGameSessionKeys());
  keys.add(state.seed);
  sessionStorage.setItem(GAME_KEY_LIST, JSON.stringify([...keys]));
}

export function listGameSessionKeys(): string[] {
  if (!sessionStorageAvailable()) return [];
  try {
    const value = JSON.parse(sessionStorage.getItem(GAME_KEY_LIST) ?? '[]');
    return Array.isArray(value)
      ? value.filter(
          (key): key is string =>
            typeof key === 'string' && GAME_KEY_PATTERN.test(key),
        )
      : [];
  } catch {
    return [];
  }
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
  if (!gameKeyIsValid(key) || !sessionStorageAvailable()) return false;
  const stored = sessionStorage.getItem(gameStateKey(key));
  if (!stored) return false;
  try {
    const state = JSON.parse(stored) as GameState;
    if (state.seed !== key) return false;
    commandSequence.reset();
    await activeController.load(state);
    publishGameState(state);
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
  publishGameState(state);
}

export async function ensureGameSession(): Promise<boolean> {
  if (!activeController.current) return false;
  await reconcileGameClock();
  return true;
}

async function sendGameCommand(command: GameCommand): Promise<Outcome> {
  const transition = await activeController.dispatch(command);
  publishGameState(transition.state);
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
  publishGameState(transition.state);
}
