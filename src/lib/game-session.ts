import { writable } from 'svelte/store';
import { GameController } from './game-controller';
import type { GameDefinitionRepository } from './game-definition';
import { RuntimeContentCache } from './content/runtime-content';
import type { GameCommand, GameState, Outcome } from './game-types';
import { intentToCommand, type GameIntent } from './ui/game-view-model';
import { batchSessionPublication, publishSession } from './ui/session-state';
export { companionSpeechSession, gameViewModel } from './ui/session-state';
import { UiCommandSequence } from './ui/command-sequence';
import {
  loadGame,
  loadActiveGameHash,
  saveNewGame,
  saveTransition,
  setActiveGameHash,
} from './persistence/games';
import {
  cacheRemoteGame,
  downloadGame,
  SavedGameUnavailableError,
} from './persistence/remote';
import { nextOutbox } from './persistence/outbox';
import { withGameLock } from './persistence/locks';
import { scheduleGameSync } from './persistence/scheduler';
import { flushGame } from './persistence/sync';
import { browserCapture } from './telemetry/browser';
import { isLocalDevelopment } from './local-development';
import { localContent } from './content/local-content';
export const pendingGameKey = writable<string | null>(null);

const runtimeContent = isLocalDevelopment()
  ? localContent
  : new RuntimeContentCache();
let activeController = new GameController(runtimeContent);
const commandSequence = new UiCommandSequence();

function publishGameState(
  state: GameState,
  command?: GameCommand,
  outcome?: Outcome,
): void {
  const definition = activeController.currentDefinition;
  if (!definition) throw new Error('Game definition was not loaded.');
  publishSession({ state, definition, command, outcome });
}

function syncHooks(gameHash: string) {
  const capture =
    activeController.current?.seed === gameHash
      ? activeController.capture
      : undefined;
  return {
    refreshContent: async () => {
      if (runtimeContent instanceof RuntimeContentCache)
        await runtimeContent.refreshBeforeWrite();
    },
    adoptRemote: async (
      remote: NonNullable<Awaited<ReturnType<typeof downloadGame>>>,
    ) => {
      await queued(async () => {
        const discarded = await cacheRemoteGame(remote, true);
        (capture ?? browserCapture())?.marker(
          'stream_superseded',
          {
            supersededBatchIds: discarded.map((batch) => batch.batchId),
            supersededPositions: discarded.flatMap((batch) =>
              batch.capturePosition ? [batch.capturePosition] : [],
            ),
            latestCommittedBatchId: remote.latestCommittedBatchId ?? null,
            stateVersion: remote.stateVersion,
          },
          activeController.current?.seed === gameHash
            ? activeController.current
            : remote.state,
        );
        if (activeController.current?.seed === gameHash) {
          activeController.capture = browserCapture();
          publishGameState(await activeController.load(remote.state));
        }
      }, gameHash);
    },
    confirmed: (
      pending: import('./persistence/types').OutboxRecord,
      acknowledgement: import('./persistence/types').SyncAcknowledgement,
    ) => {
      capture?.marker(
        'save_confirmed',
        {
          saveBatchId: pending.batchId,
          acknowledgement,
          commandIds: pending.commands.map((command) => command.commandId),
        },
        pending.targetState,
        pending.capturePosition,
      );
    },
    rejected: (
      pending: import('./persistence/types').OutboxRecord,
      detail: Record<string, unknown>,
    ) => {
      capture?.marker(
        'save_rejected',
        detail,
        pending.targetState,
        pending.capturePosition,
      );
    },
  };
}

function syncGame(gameHash: string): void {
  if (!isLocalDevelopment()) scheduleGameSync(gameHash, syncHooks(gameHash));
}

const GAME_KEY_PATTERN = /^\d{8}$/;
let gameQueue: Promise<unknown> = Promise.resolve();

function queued<T>(task: () => Promise<T>, gameHash?: string): Promise<T> {
  const locked = () =>
    withGameLock(
      gameHash ?? activeController.current?.seed ?? 'session',
      'transition',
      () => batchSessionPublication(task),
    );
  const run = gameQueue.then(locked, locked);
  gameQueue = run.catch(() => undefined);
  return run;
}

export function useGameDefinitionRepository(
  repository: GameDefinitionRepository,
): void {
  activeController = new GameController(repository);
  publishSession(null);
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
  if (!isLocalDevelopment()) await flushGame(key, syncHooks(key));
  return queued(async () => {
    try {
      if (!isLocalDevelopment() && !(await nextOutbox(key))) {
        try {
          const remote = await downloadGame(key);
          if (!remote) return false;
          await cacheRemoteGame(remote);
        } catch (error) {
          if (!(error instanceof SavedGameUnavailableError)) throw error;
        }
      }
      const persisted = await loadGame(key);
      if (!persisted || persisted.state.seed !== key) return false;
      activeController.capture = browserCapture();
      const state = await activeController.load(persisted.state);
      await setActiveGameHash(key);
      publishGameState(state);
      syncGame(key);
      return true;
    } catch {
      return false;
    }
  }, key);
}

export function beginGameSession(
  mode: 'realtime' | 'streaming',
  gameKey: string,
): Promise<void> {
  const seed = gameKey.trim();
  return queued(async () => {
    if (!gameKeyIsValid(seed))
      throw new Error('An eight-digit game key is required.');
    activeController.capture = browserCapture();
    const state = await activeController.start({
      mode,
      now: Date.now(),
      seed,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    await saveNewGame(state, activeController.capture?.position(state));
    publishGameState(state);
    syncGame(seed);
  }, seed);
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
  await saveResolvedTransition(before, command);
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

export function sendGameIntent(intent: GameIntent): Promise<Outcome> {
  return queued(async () => {
    await refreshLocalState();
    let state = activeController.current;
    if (!state) throw new Error('Start a game session before sending actions.');
    if (state.mode === 'realtime') {
      await catchUpGameClock();
      state = activeController.current;
      if (!state) throw new Error('The active game session was lost.');
    }
    return sendGameCommand(
      intentToCommand(intent, state, commandSequence.next()),
    );
  });
}

export function reconcileGameClock(): Promise<void> {
  return queued(async () => {
    await refreshLocalState();
    await catchUpGameClock();
  });
}

async function catchUpGameClock(): Promise<void> {
  const current = activeController.current;
  if (!current || current.mode !== 'realtime') return;
  const transition = await activeController.reconcile(Date.now());
  await saveResolvedTransition(current);
  publishGameState(transition.state);
  syncGame(transition.state.seed);
}

async function refreshLocalState(): Promise<void> {
  const current = activeController.current;
  if (!current) return;
  const stored = await loadGame(current.seed);
  if (stored && JSON.stringify(stored.state) !== JSON.stringify(current))
    publishGameState(await activeController.load(stored.state));
}

async function saveResolvedTransition(
  before: GameState,
  command?: GameCommand,
): Promise<void> {
  for (const state of activeController.savePoints) {
    await saveTransition(
      before,
      state,
      state === activeController.current ? command : undefined,
      activeController.capture?.position(state),
    );
    before = state;
  }
}

if (typeof window !== 'undefined')
  window.addEventListener('online', () => {
    const state = activeController.current;
    if (state) syncGame(state.seed);
  });
