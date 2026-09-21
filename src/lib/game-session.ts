import { derived, writable } from 'svelte/store';
import { GameController } from './game-controller';
import type { GameDefinitionRepository } from './game-definition';
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
import { replayPending } from './persistence/replay';
import { flushGame } from './persistence/sync';
import type { SpeechSession } from './ui/companion-speech';
import { browserCapture } from './telemetry/browser';
import { isLocalDevelopment } from './local-development';
import { localContent } from './content/local-content';
export const pendingGameKey = writable<string | null>(null);

const runtimeContent = isLocalDevelopment()
  ? localContent
  : new RuntimeContentCache();
let activeController = new GameController(runtimeContent);
const gameSession = writable<SpeechSession | null>(null);
export const companionSpeechSession = { subscribe: gameSession.subscribe };
const commandSequence = new UiCommandSequence();
export const gameViewModel = derived<typeof gameSession, GameViewModel | null>(
  gameSession,
  ($session) =>
    $session ? createGameViewModel($session.state, $session.definition) : null,
);

function publishGameState(
  state: GameState,
  command?: GameCommand,
  outcome?: Outcome,
): void {
  const definition = activeController.currentDefinition;
  if (!definition) throw new Error('Game definition was not loaded.');
  gameSession.set({ state, definition, command, outcome });
}

function syncGame(gameHash: string): void {
  if (isLocalDevelopment()) return;
  let capture = activeController.capture;
  void flushGame(gameHash, {
    refreshContent: async () => {
      await (runtimeContent as RuntimeContentCache).refreshBeforeWrite();
    },
    replayConflict: async (hash) => {
      capture =
        (await replayPending(
          hash,
          runtimeContent,
          (controller) => {
            if (activeController.current?.seed === hash) {
              activeController = controller;
              publishGameState(controller.current!);
            }
          },
          capture,
        )) ?? capture;
    },
    confirmed: (pending, acknowledgement) => {
      capture?.marker(
        'save_confirmed',
        {
          saveBatchId: pending.batchId,
          acknowledgement,
          commandIds: pending.commands.map((command) => command.commandId),
        },
        pending.targetState,
      );
    },
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
    activeController.capture = browserCapture();
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
  activeController.capture = browserCapture();
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
  publishGameState(transition.state, command, transition.outcomes[0]);
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
