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
}

export function createRootSeed(): string {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join(
    '',
  );
}

export async function beginGameSession(
  mode: 'realtime' | 'streaming',
): Promise<void> {
  commandSequence.reset();
  const state = await activeController.start({
    mode,
    now: Date.now(),
    seed: createRootSeed(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  publishGameState(state);
}

export async function ensureGameSession(): Promise<void> {
  if (!activeController.current) await beginGameSession('realtime');
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
