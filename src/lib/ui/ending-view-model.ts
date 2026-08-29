import type { GameState, RunEndingKind } from '$lib/game-types';
import { HOUR_MS } from '$lib/game-constants';
import rules from '$lib/data/simulation-rules.json';
import financialRules from '$lib/data/financial-rules.json';
import {
  endingPresentationTexts,
  formatEndingMessage,
} from '$lib/ending-rules/messages';

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
      title: endingPresentationTexts.death.title,
      explanation: endingPresentationTexts.death.explanation,
      evidence: [],
      causes: ending.causes?.map((cause) => ({ name: cause.name })) ?? [
        { name: ending.cause },
      ],
    };
  if (ending.kind === 'quit_streaming')
    return {
      kind: ending.kind,
      at: ending.at,
      title: endingPresentationTexts.quitStreaming.title,
      explanation: formatEndingMessage(
        endingPresentationTexts.quitStreaming.explanation,
        { durationHours: ending.durationHours },
      ),
      evidence: [
        formatEndingMessage(endingPresentationTexts.quitStreaming.evidence, {
          durationHours: ending.durationHours,
        }),
      ],
      causes: [],
    };
  return {
    kind: ending.kind,
    at: ending.at,
    title: endingPresentationTexts.financialRuin.title,
    explanation: formatEndingMessage(
      endingPresentationTexts.financialRuin.explanation,
      {
        threshold:
          financialRules.debt.financialRuinBalance.toLocaleString('en-US'),
      },
    ),
    evidence: [
      formatEndingMessage(endingPresentationTexts.financialRuin.causeEvidence, {
        cause: ending.cause,
      }),
      formatEndingMessage(
        endingPresentationTexts.financialRuin.balanceEvidence,
        { balance: ending.endingBalance.toLocaleString('en-US') },
      ),
    ],
    causes: [],
  };
}

export function endingRiskPresentation(
  state: GameState,
): EndingRiskViewModel[] {
  if (state.ending) return [];
  const result: EndingRiskViewModel[] = [];
  appendMetricRisk(
    result,
    state,
    'quit_streaming',
    endingPresentationTexts.quitStreaming.riskLabel,
  );
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
