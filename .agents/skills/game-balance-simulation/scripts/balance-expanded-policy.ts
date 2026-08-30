import { startRun } from '../../../../src/lib/game-engine';
import { reconcileRunEnding } from '../../../../src/lib/ending-rules';
import { HOUR_MS } from '../../../../src/lib/game-constants';
import type { GameState } from '../../../../src/lib/game-types';
import type { ExpandedRunSpec, RunTrace } from './balance-study-contract';
import {
  HORIZON_DAYS,
  STUDY_START,
  studyDefinition,
} from './balance-study-policy';
import { createScheduleCursor } from './balance-profile-schedule';
import {
  SessionRuntime,
  captureEvents,
  createBehaviorTrace,
  createProfileMemory,
  sampleState,
} from './balance-profile-runtime';
import {
  payDebtIfPlanned,
  performCare,
  performCareerActivity,
  respondToMedical,
  respondToNutrition,
} from './balance-profile-care';
import {
  maintainFoodReserve,
  placeBestRoomItem,
  purchaseInsurance,
  purchaseProfilePriorities,
  pursueProgression,
  useNovelItem,
} from './balance-profile-shopping';
import { reconcileThrough } from './balance-reconcile-through';

const DAY_MS = 24 * HOUR_MS;

export function runExpandedSpec(spec: ExpandedRunSpec): RunTrace {
  let state = startRun(
    {
      mode: 'streaming',
      now: STUDY_START,
      seed: spec.seed,
      timezone: 'America/Toronto',
    },
    studyDefinition,
  );
  if (spec.config.controlledEndingSetup === 'quit_streaming_due') {
    state = reconcileRunEnding({
      ...state,
      metrics: { ...state.metrics, mood: 0 },
      endingRisks: {
        quit_streaming: {
          triggerStartedAt: state.now - 72 * HOUR_MS,
          warningStages: [],
          warningEventIds: [],
        },
      },
    });
  }
  const horizon = STUDY_START + HORIZON_DAYS * DAY_MS;
  const cursor = createScheduleCursor(spec.config, STUDY_START, horizon);
  const checks = {
    scheduled: 0,
    attended: 0,
    busy: 0,
    skipped: 0,
    retries: 0,
  };
  const behavior = createBehaviorTrace(state);
  const memory = createProfileMemory();
  let rejectedPurchases = 0;
  let session = 0;
  for (
    let scheduledAt = cursor.next(state);
    scheduledAt !== null && !state.ending;
    scheduledAt = cursor.next(state)
  ) {
    session += 1;
    checks.scheduled += 1;
    if (shouldSkip(spec, memory, session)) {
      checks.skipped += 1;
      continue;
    }
    let visitAt = scheduledAt;
    if (state.now > scheduledAt) {
      checks.busy += 1;
      const retryHours = spec.config.schedule.retryAfterBusyHours;
      const retryAt =
        retryHours === undefined || retryHours === null
          ? null
          : scheduledAt + retryHours * HOUR_MS;
      if (retryAt === null || state.now > retryAt) {
        if (spec.config.schedule.skipNextAfterBusy) memory.skipNextVisit = true;
        continue;
      }
      visitAt = retryAt;
      checks.retries += 1;
    }
    const beforeEvents = state.events.length;
    state = reconcileThrough(state, visitAt, studyDefinition);
    captureEvents(state.events.slice(beforeEvents), memory);
    sampleState(behavior, state);
    if (state.ending) break;
    checks.attended += 1;
    const result = attendSession(state, spec, behavior, memory, session);
    state = result.state;
    rejectedPurchases += result.rejectedPurchases;
    if (spec.config.schedule.skipAfterSafe && isSafe(state, spec))
      memory.skipAfterSafe = true;
  }
  if (!state.ending && state.now < horizon) {
    const beforeEvents = state.events.length;
    state = reconcileThrough(state, horizon, studyDefinition);
    captureEvents(state.events.slice(beforeEvents), memory);
    sampleState(behavior, state);
  }
  return { state, spec, checks, rejectedPurchases, behavior };
}

function attendSession(
  state: GameState,
  spec: ExpandedRunSpec,
  behavior: ReturnType<typeof createBehaviorTrace>,
  memory: ReturnType<typeof createProfileMemory>,
  session: number,
) {
  const runtime = new SessionRuntime(state, spec, behavior, memory, session);
  const rejectedBefore = behavior.rejectedActions.buy_item ?? 0;
  payDebtIfPlanned(runtime);
  purchaseInsurance(runtime);
  respondToNutrition(runtime);
  if (respondToMedical(runtime) || runtime.state.ending)
    return finish(runtime, rejectedBefore);
  const beforeCareAt = runtime.state.now;
  performCare(runtime);
  if (runtime.state.ending || runtime.state.now > beforeCareAt)
    return finish(runtime, rejectedBefore);
  maintainFoodReserve(runtime);
  purchaseProfilePriorities(runtime);
  pursueProgression(runtime);
  placeBestRoomItem(runtime);
  useNovelItem(runtime);
  if (!runtime.state.ending) performCareerActivity(runtime);
  return finish(runtime, rejectedBefore);
}

function finish(runtime: SessionRuntime, rejectedBefore: number) {
  return {
    state: runtime.state,
    rejectedPurchases:
      (runtime.behavior.rejectedActions.buy_item ?? 0) - rejectedBefore,
  };
}

function shouldSkip(
  spec: ExpandedRunSpec,
  memory: ReturnType<typeof createProfileMemory>,
  session: number,
) {
  if (memory.skipNextVisit) {
    memory.skipNextVisit = false;
    return true;
  }
  if (memory.skipAfterSafe) {
    memory.skipAfterSafe = false;
    return true;
  }
  const every = spec.config.schedule.skipEvery;
  return Boolean(every && session % every === 0);
}

function isSafe(state: GameState, spec: ExpandedRunSpec) {
  const care = spec.config.care;
  return (
    state.metrics.food > care.foodThreshold &&
    state.metrics.rest > care.restThreshold &&
    state.metrics.mood > care.moodThreshold &&
    !state.statuses.kidney_stone &&
    !state.statuses.sick
  );
}
