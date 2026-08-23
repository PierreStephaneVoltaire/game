import type { GameDefinition } from '../game-definition';
import type { GameEvent, GameState, StartRunInput } from '../game-types';
import { actionRandom } from '../seeded-rng';
import { localDate, rotateShop } from '../shop-rules';
import rules from '../data/simulation-rules.json';
import { startingAppearanceId } from '../companion-profile';
import { HOUR_MS } from '../game-constants';

export function createRunState(
  input: StartRunInput,
  definition: GameDefinition,
): GameState {
  const started: GameEvent = {
    id: 'event-1',
    type: 'run_started',
    at: input.now,
    message: 'Just rainbows and sunshine.',
  };
  const annoyanceThreshold =
    rules.annoyance.min +
    Math.floor(
      actionRandom(input.seed, 1, 'run-start', 'annoyance', 'threshold') *
        (rules.annoyance.max - rules.annoyance.min + 1),
    );
  const history = {
    consumptions: [],
    lastBondGainAt: input.now,
    lastCareAttemptAt: input.now,
    lastInteractionAt: input.now,
    careAttemptStreak: 0,
    repeatAction: null,
    repeatCount: 0,
    sugarCrashDueAt: null,
    lastStatusReconcileAt: input.now,
    decayRemainderHours: 0,
    healthRemainderHours: 0,
    pendingFoodDecayHit: false,
    eventCooldowns: {},
    oncePerLocalDate: {},
    cravingItemId: null,
    cravingStartedAt: null,
    cravingRefreshCount: 0,
    annoyanceThreshold,
    annoyanceWarningIssued: false,
    bondPlacementResetAt: {},
    lastCommissionWorkDate: null,
    nextAutonomousAt:
      input.now + rules.events.autonomous.intervalHours * HOUR_MS,
    runStartedAt: input.now,
  } as GameState['history'];
  const base: GameState = {
    definitionVersion: definition.version,
    mode: input.mode,
    seed: input.seed,
    timezone: input.timezone,
    now: input.now,
    lastResolvedAt: input.now,
    stateVersion: 1,
    actionOrdinal: 0,
    metrics: { ...definition.startingMetrics },
    statuses: {},
    balance: definition.startingCurrency,
    inventory: { ...definition.startingInventory },
    room: {},
    roomModifiers: {},
    shop: { localDate: '', itemIds: [], stock: {}, cart: {} },
    activity: null,
    timedEffects: {
      deferredRestLossAt: null,
      hyperfocusUntil: null,
      painReliefUntil: null,
    },
    progression: {
      followers: rules.progression.startingFollowers,
      careerTier: 'starting_out',
      unlockedModelTiers: [],
      completedModelTiers: [],
      activeAppearanceId: startingAppearanceId(),
      awardedMilestones: [],
      queuedEventStreams: [],
      permanentDonationBonus: false,
    },
    projects: [],
    events: [],
    history,
    death: null,
    processedCommands: {},
  };
  return {
    ...base,
    shop: rotateShop(base, definition, localDate(input.now, input.timezone)),
    events: [started],
  };
}
