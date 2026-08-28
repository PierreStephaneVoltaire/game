import type { GameState, RunEndingKind } from '$lib/game-types';
import { HOUR_MS } from '$lib/game-constants';
import rules from '$lib/data/simulation-rules.json';

export type EndingViewModel = {
  kind: RunEndingKind;
  at: number;
  title: string;
  explanation: string;
  evidence: string[];
  causes: Array<{ name: string }>;
};

export type EndingRiskViewModel = {
  kind: Exclude<RunEndingKind, 'death'>;
  label: string;
  remaining: number;
  unit: 'hours' | 'complete local days';
};

export function endingPresentation(state: GameState): EndingViewModel | null {
  const ending = state.ending;
  if (!ending) return null;
  if (ending.kind === 'death')
    return {
      kind: ending.kind,
      at: ending.at,
      title: 'Death',
      explanation: 'Health reached 0.',
      evidence: [],
      causes: ending.causes?.map((cause) => ({ name: cause.name })) ?? [
        { name: ending.cause },
      ],
    };
  if (ending.kind === 'quit_streaming')
    return {
      kind: ending.kind,
      at: ending.at,
      title: 'Quit Streaming',
      explanation: 'Mood remained at 0 continuously for 72 game-hours.',
      evidence: [
        `The countdown began ${ending.durationHours} hours before the ending.`,
      ],
      causes: [],
    };
  return {
    kind: ending.kind,
    at: ending.at,
    title: 'Financial Ruin',
    explanation: 'Total debt reached $20,000.',
    evidence: [
      `Cause: ${ending.cause}.`,
      `Total debt: $${ending.totalDebt.toLocaleString('en-US')}.`,
      `Ending cash balance: $${ending.endingBalance.toLocaleString('en-US')}.`,
    ],
    causes: [],
  };
}

export function endingRiskPresentation(
  state: GameState,
): EndingRiskViewModel[] {
  if (state.ending) return [];
  const result: EndingRiskViewModel[] = [];
  appendMetricRisk(result, state, 'quit_streaming', 'Quit Streaming risk');
  return result;
}

function appendMetricRisk(
  result: EndingRiskViewModel[],
  state: GameState,
  kind: 'quit_streaming',
  label: string,
): void {
  const startedAt = state.endingRisks[kind].triggerStartedAt;
  if (startedAt === null) return;
  const durationHours = rules.endings.quitStreaming.durationHours;
  result.push({
    kind,
    label,
    remaining: Math.max(
      0,
      Math.ceil((startedAt + durationHours * HOUR_MS - state.now) / HOUR_MS),
    ),
    unit: 'hours',
  });
}
