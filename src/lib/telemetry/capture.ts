import type { GameState } from '../game-types';
import { collectCalculations, type TraceEntry } from './collector';
import { stateChanges, type Change } from './state-changes';

export type Operation = {
  schemaVersion: 1;
  streamId: string;
  operationId: string;
  parentId: string | null;
  sequence: number;
  gameHash: string;
  runStartedAt: number;
  mode: GameState['mode'];
  timezone: string;
  simulationAt: number;
  recordedAt: number;
  engineBuild: string;
  contentVersion: string;
  kind: string;
  summary: {
    stateVersion: number;
    balance: number;
    endingKind: string | null;
    commandType: string | null;
    accepted: boolean | null;
  };
  input: unknown;
  outcome: unknown;
  checkpoint?: GameState;
  changes: Change[];
  calculations: TraceEntry[];
};

export type CapturePosition = { streamId: string; operationId: string };

export type TraceSink = (operation: Operation, state: GameState) => void;

export class GameplayCapture {
  readonly streamId = crypto.randomUUID();
  private sequence = 0;
  private previous: GameState | undefined;
  private parentId: string | null = null;
  private paused = false;
  private readonly positions = new WeakMap<GameState, string>();

  constructor(
    private readonly sink: TraceSink,
    private readonly allowed: () => boolean = () => true,
  ) {}

  private observing(): boolean {
    try {
      if (this.allowed()) return true;
    } catch {
      console.warn('Gameplay capture account check failed.');
    }
    this.paused = true;
    return false;
  }

  fork(): GameplayCapture | undefined {
    try {
      return new GameplayCapture(this.sink, this.allowed);
    } catch {
      console.warn('Gameplay replay logging could not initialize.');
      return;
    }
  }

  position(state: GameState): CapturePosition | undefined {
    const operationId = this.positions.get(state);
    return operationId ? { streamId: this.streamId, operationId } : undefined;
  }

  marker(
    kind: string,
    input: unknown,
    target: GameState,
    position = this.position(target),
  ): void {
    try {
      this.record(
        kind,
        {
          detail: input,
          targetOperationId: position?.operationId ?? null,
          targetStreamId: position?.streamId ?? null,
          targetStateVersion: target.stateVersion,
          targetSimulationAt: target.now,
          targetEventCount: target.events.length,
          targetLastEventId: target.events.at(-1)?.id ?? null,
        },
        this.previous ?? target,
      );
    } catch {
      console.warn('Gameplay trace marker failed.');
    }
  }

  execute<T>(
    kind: string,
    input: unknown,
    execute: () => T,
    stateOf: (result: T) => GameState,
    outcomeOf: (result: T) => unknown = () => null,
    before?: GameState,
  ): T {
    if (!this.observing()) return execute();
    if (this.paused && before) {
      this.previous = undefined;
      this.record('checkpoint', { resumedAfterAccountChange: true }, before);
    }
    this.paused = false;
    let operationId: string;
    try {
      operationId = crypto.randomUUID();
    } catch {
      return execute();
    }
    const wasEnded = this.previous?.ending;
    let calculationCursor = 0;
    const collected = collectCalculations(
      operationId,
      execute,
      (state, entries) => {
        if (!this.previous) return;
        if (!stateChanges(this.previous, state).length) {
          if (this.parentId) this.positions.set(state, this.parentId);
          return;
        }
        const events = state.events.slice(this.previous.events.length);
        this.record(
          'transition',
          {
            operationId,
            origin: input,
            eventIds: events.map((event) => event.id),
            causedBy: [
              ...new Set(events.flatMap((event) => event.causedBy ?? [])),
            ],
            sourceActionIds: [
              ...new Set(
                events.flatMap((event) =>
                  event.sourceActionId ? [event.sourceActionId] : [],
                ),
              ),
            ],
          },
          state,
          null,
          entries.slice(calculationCursor),
        );
        calculationCursor = entries.length;
      },
    );
    const ended = !wasEnded && stateOf(collected.result).ending;
    this.record(
      kind,
      input,
      stateOf(collected.result),
      outcomeOf(collected.result),
      collected.entries.slice(calculationCursor),
      operationId,
    );
    if (ended) this.marker('run_ended', ended, stateOf(collected.result));
    return collected.result;
  }

  record(
    kind: string,
    input: unknown,
    state: GameState,
    outcome: unknown = null,
    calculations: TraceEntry[] = [],
    suppliedId?: string,
  ): void {
    if (!this.observing()) return;
    try {
      const operationId = suppliedId ?? crypto.randomUUID();
      const operation: Operation = {
        schemaVersion: 1,
        streamId: this.streamId,
        operationId,
        parentId: this.parentId,
        sequence: ++this.sequence,
        gameHash: state.seed,
        runStartedAt: state.history.runStartedAt,
        mode: state.mode,
        timezone: state.timezone,
        simulationAt: state.now,
        recordedAt: Date.now(),
        engineBuild: import.meta.env.PUBLIC_ENGINE_BUILD ?? 'unbundled',
        contentVersion: state.definitionVersion,
        kind,
        summary: {
          stateVersion: state.stateVersion,
          balance: state.balance,
          endingKind: state.ending?.kind ?? null,
          commandType:
            kind === 'command' ? (input as { type: string }).type : null,
          accepted: Array.isArray(outcome)
            ? (outcome[0]?.accepted ?? null)
            : null,
        },
        input,
        outcome,
        ...(!this.previous || kind === 'checkpoint'
          ? { checkpoint: structuredClone(state) }
          : {}),
        changes: this.previous ? stateChanges(this.previous, state) : [],
        calculations,
      };
      this.sink(operation, state);
      this.previous = structuredClone(state);
      this.parentId = operationId;
      this.positions.set(state, operationId);
    } catch {
      this.previous = undefined;
      this.paused = true;
      console.warn('Gameplay trace capture failed.');
    }
  }
}
