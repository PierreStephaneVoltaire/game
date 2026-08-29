import { describe, expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, startRun } from './game-engine';
import { reconcileRunEnding } from './ending-rules';
import { HOUR_MS } from './game-constants';
import type { GameState } from './game-types';
import endingRuleData from './data/ending-rules.json';
import {
  deathEventMessage,
  endingRiskRecoveryMessage,
  endingWarningMessage,
  madeItUnlockedMessage,
  runEndingMessage,
  runOverMessage,
} from './ending-rules/messages';

function run(now = 0) {
  return startRun(
    { mode: 'realtime', now, seed: 'ending-rules', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

function quitRisk(now = 0): GameState {
  const state = run(now);
  return reconcileRunEnding({
    ...state,
    metrics: { ...state.metrics, mood: 0 },
  });
}

function at(state: GameState, now: number): GameState {
  return reconcileRunEnding({ ...state, now, lastResolvedAt: now });
}

describe('Quit Streaming ending timer', () => {
  test('loads authored Ending messages from ending rule data', () => {
    expect(endingWarningMessage('quit_streaming', 0)).toBe(
      endingRuleData.texts.events.quitStreamingWarningStarted,
    );
    expect(endingWarningMessage('quit_streaming', 24)).toContain('24');
    expect(endingRiskRecoveryMessage('quit_streaming')).toBe(
      endingRuleData.texts.events.quitStreamingRecovered,
    );
    expect(runEndingMessage('financial_ruin')).toBe(
      endingRuleData.texts.events.runEndedFinancialRuin,
    );
    expect(deathEventMessage()).toBe(endingRuleData.texts.events.death);
    expect(madeItUnlockedMessage(endingRuleData.madeIt.followers)).toContain(
      '3,000,000',
    );
    expect(runOverMessage()).toBe(endingRuleData.texts.events.runOver);
  });

  test('ends at 72 continuous Mood-zero hours, but not before', () => {
    const risk = quitRisk();
    expect(at(risk, 72 * HOUR_MS - 1).ending).toBeNull();
    expect(at(risk, 72 * HOUR_MS).ending?.kind).toBe('quit_streaming');
  });

  test('warns once at 0, 24, and 48 hours', () => {
    let state = quitRisk();
    state = at(state, 24 * HOUR_MS);
    state = at(state, 48 * HOUR_MS);
    state = reconcileRunEnding(state);
    expect(
      state.events
        .filter((event) => event.type === 'ending_risk_warning')
        .map((event) => event.endingStage),
    ).toEqual([0, 24, 48]);
  });

  test('Mood recovery clears the countdown exactly once', () => {
    let state = at(quitRisk(), 48 * HOUR_MS);
    state = reconcileRunEnding({
      ...state,
      metrics: { ...state.metrics, mood: 1 },
    });
    expect(state.endingRisks.quit_streaming.triggerStartedAt).toBeNull();
    expect(
      state.events.filter((event) => event.type === 'ending_risk_recovered'),
    ).toHaveLength(1);
    expect(reconcileRunEnding(state)).toBe(state);
  });

  test('ended state rejects later commands without mutation', () => {
    const ended = at(quitRisk(), 72 * HOUR_MS);
    const rejected = dispatchCommand(
      ended,
      { type: 'wait', commandId: 'after-ending', now: ended.now },
      BUNDLED_GAME_DEFINITION,
    );
    expect(rejected.state).toBe(ended);
    expect(rejected.outcomes[0]).toMatchObject({
      accepted: false,
      kind: 'run_over',
    });
  });
});

test('Death retains precedence over a due Quit Streaming ending', () => {
  const due = at(quitRisk(), 72 * HOUR_MS - 1);
  const ended = reconcileRunEnding({
    ...due,
    now: 72 * HOUR_MS,
    metrics: { ...due.metrics, health: 0 },
  });
  expect(ended.ending?.kind).toBe('death');
});
