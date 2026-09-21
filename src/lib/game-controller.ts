import type {
  GameDefinition,
  GameDefinitionRepository,
} from './game-definition';
import { dispatchCommand, reconcileTime, startRun } from './game-engine';
import { normalizeLoadedRunEnding } from './ending-rules';
import { activateGameDefinition } from './runtime-definition';
import type { GameplayCapture } from './telemetry/capture';
import type {
  GameCommand,
  GameState,
  StartRunInput,
  Transition,
} from './game-types';

export class GameController {
  private state: GameState | null = null;
  private definition: GameDefinition | null = null;

  constructor(
    private readonly definitions: GameDefinitionRepository,
    public capture?: GameplayCapture,
  ) {}

  async start(input: StartRunInput): Promise<GameState> {
    this.definition = await this.definitions.load();
    activateGameDefinition(this.definition);
    const execute = () => startRun(input, this.definition!);
    this.state = this.capture
      ? this.capture.execute(
          'run_initialized',
          input,
          execute,
          (state) => state,
        )
      : execute();
    return this.state;
  }

  async load(state: GameState): Promise<GameState> {
    this.definition = await this.definitions.load();
    activateGameDefinition(this.definition);
    this.state = normalizeLoadedRunEnding(state);
    this.capture?.record('checkpoint', null, this.state);
    return this.state;
  }

  async dispatch(command: GameCommand): Promise<Transition> {
    if (!this.state) throw new Error('Run has not started.');
    if (!this.definition) throw new Error('Game definition was not loaded.');
    const execute = () =>
      dispatchCommand(this.state!, command, this.definition!);
    const transition = this.capture
      ? this.capture.execute(
          'command',
          command,
          execute,
          (result) => result.state,
          (result) => result.outcomes,
          this.state,
        )
      : execute();
    this.state = transition.state;
    return transition;
  }

  async reconcile(now: number): Promise<Transition> {
    if (!this.state) throw new Error('Run has not started.');
    if (!this.definition) throw new Error('Game definition was not loaded.');
    const execute = () => reconcileTime(this.state!, now, this.definition!);
    const transition = this.capture
      ? this.capture.execute(
          'clock_reconciled',
          { now },
          execute,
          (result) => result.state,
          (result) => result.outcomes,
          this.state,
        )
      : execute();
    this.state = transition.state;
    return {
      state: transition.state,
      outcomes: transition.eventIds.map((id) => ({
        accepted: true,
        kind: 'time_reconciled',
        message: 'The game caught up.',
        eventIds: [id],
      })),
    };
  }

  get current(): GameState | null {
    return this.state;
  }

  get currentDefinition(): GameDefinition | null {
    return this.definition;
  }
}
