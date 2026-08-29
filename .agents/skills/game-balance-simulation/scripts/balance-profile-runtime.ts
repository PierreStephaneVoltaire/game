import { dispatchCommand } from '../../../../src/lib/game-engine';
import type {
  GameCommand,
  GameEvent,
  GameState,
} from '../../../../src/lib/game-types';
import { HOUR_MS } from '../../../../src/lib/game-constants';
import type { ItemDefinition } from '../../../../src/lib/game-definition';
import {
  type BehaviorTrace,
  type ExpandedRunSpec,
} from './balance-study-contract';
import { studyDefinition } from './balance-study-policy';

export type ProfileMemory = {
  foodUseCounts: Record<string, number>;
  lastFoodId: string | null;
  painkillerCycles: number;
  pendingRescueAt: Partial<Record<'food' | 'rest', number>>;
  seenSugarCrash: boolean;
  seenMedicalIncident: boolean;
  manuallyTriedItemIds: string[];
  skipNextVisit: boolean;
  skipAfterSafe: boolean;
};

export function createBehaviorTrace(state: GameState): BehaviorTrace {
  return {
    actionAttempts: {},
    acceptedActions: {},
    rejectedActions: {},
    careActions: {},
    preCareMetrics: {},
    visitsWithNoCare: 0,
    purchasesByCategory: {},
    usedItemIds: [],
    hospitalDecisions: {},
    rescueLockResets: { food: 0, rest: 0 },
    rescueToPlayerCareHours: { food: [], rest: [] },
    waterResponsesAfterWarning: 0,
    proteinResponsesAfterWarning: 0,
    balanceSamples: [{ at: state.now, balance: state.balance }],
    metricSamples: [{ at: state.now, health: state.metrics.health }],
  };
}

export function createProfileMemory(): ProfileMemory {
  return {
    foodUseCounts: {},
    lastFoodId: null,
    painkillerCycles: 0,
    pendingRescueAt: {},
    seenSugarCrash: false,
    seenMedicalIncident: false,
    manuallyTriedItemIds: [],
    skipNextVisit: false,
    skipAfterSafe: false,
  };
}

export class SessionRuntime {
  state: GameState;
  private ordinal: number;

  constructor(
    state: GameState,
    readonly spec: ExpandedRunSpec,
    readonly behavior: BehaviorTrace,
    readonly memory: ProfileMemory,
    session: number,
  ) {
    this.state = state;
    this.ordinal = session * 100;
  }

  invoke(input: Omit<GameCommand, 'commandId' | 'now'>) {
    const before = this.state;
    increment(this.behavior.actionAttempts, input.type);
    const result = dispatchCommand(
      before,
      {
        ...input,
        commandId: `profile-${this.spec.id}-${this.ordinal++}-${before.actionOrdinal}-${before.stateVersion}`,
        now: before.now,
      } as GameCommand,
      studyDefinition,
    );
    const accepted = result.outcomes[0]?.accepted ?? false;
    increment(
      accepted ? this.behavior.acceptedActions : this.behavior.rejectedActions,
      input.type,
    );
    this.state = result.state;
    this.recordCommandEffects(before, input, accepted);
    captureEvents(this.state.events.slice(before.events.length), this.memory);
    sampleState(this.behavior, this.state);
    return accepted;
  }

  private recordCommandEffects(
    before: GameState,
    input: Omit<GameCommand, 'commandId' | 'now'>,
    accepted: boolean,
  ) {
    if (!accepted) return;
    if (input.type === 'buy_item') {
      const item = itemById(input.itemId);
      increment(
        this.behavior.purchasesByCategory,
        item?.category ?? 'unknown',
        input.quantity ?? 1,
      );
    }
    const careMetric = careMetricFor(input);
    if (careMetric) {
      increment(this.behavior.careActions, careMetric);
      const entry = (this.behavior.preCareMetrics[careMetric] ??= {
        total: 0,
        samples: 0,
      });
      entry.total += before.metrics[careMetric];
      entry.samples += 1;
      const rescuedAt = this.memory.pendingRescueAt[careMetric];
      if (rescuedAt !== undefined) {
        this.behavior.rescueToPlayerCareHours[careMetric].push(
          Math.max(0, (before.now - rescuedAt) / HOUR_MS),
        );
        delete this.memory.pendingRescueAt[careMetric];
      }
    }
    if (input.type === 'use_item') {
      this.behavior.usedItemIds.push(input.itemId);
      const item = itemById(input.itemId);
      if (item?.edible && (item.effects?.food?.max ?? 0) > 0) {
        this.memory.lastFoodId = input.itemId;
        increment(this.memory.foodUseCounts, input.itemId);
      }
    }
    for (const metric of ['food', 'rest'] as const)
      if (
        before.history.autonomousRescue[`${metric}Locked`] &&
        !this.state.history.autonomousRescue[`${metric}Locked`]
      )
        this.behavior.rescueLockResets[metric] += 1;
  }
}

export function captureEvents(events: GameEvent[], memory: ProfileMemory) {
  for (const event of events) {
    if (event.type === 'autonomous_food_rescue')
      memory.pendingRescueAt.food = event.at;
    if (event.type === 'activity_started' && event.rescueMetric === 'rest')
      memory.pendingRescueAt.rest = event.at;
    if (event.type === 'sugar_crash') memory.seenSugarCrash = true;
    if (event.type === 'medical_debt_created')
      memory.seenMedicalIncident = true;
  }
}

export function sampleState(behavior: BehaviorTrace, state: GameState) {
  behavior.balanceSamples.push({ at: state.now, balance: state.balance });
  behavior.metricSamples.push({ at: state.now, health: state.metrics.health });
}

export function itemById(id: string): ItemDefinition | undefined {
  return studyDefinition.items.find((item) => item.id === id);
}

function careMetricFor(input: Omit<GameCommand, 'commandId' | 'now'>) {
  if (input.type === 'rest') return 'rest' as const;
  if (input.type === 'play') return 'mood' as const;
  if (input.type === 'socialize') return 'bond' as const;
  if (input.type === 'use_item') {
    const item = itemById(input.itemId);
    if (item?.edible && (item.effects?.food?.max ?? 0) > 0)
      return 'food' as const;
  }
  return null;
}

export function increment(
  record: Record<string, number>,
  key: string,
  amount = 1,
) {
  record[key] = (record[key] ?? 0) + amount;
}
