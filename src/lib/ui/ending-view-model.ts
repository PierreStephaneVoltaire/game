import type {
  AdverseEndingKind,
  GameState,
  RunEndingKind,
} from '$lib/game-types';
import { HOUR_MS } from '$lib/game-constants';
import {
  financialRules,
  simulationRules as rules,
} from '$lib/runtime-definition';
import {
  deathPresentationCopy,
  endingRiskLabel,
  financialRuinPresentationCopy,
  madeItPresentationTitle,
  madeItUnlockedMessage,
  quitStreamingPresentationCopy,
} from '$lib/ending-rules/messages';
import { stateTextContext } from '$lib/seeded-text';

export type EndingViewModel = {
  kind: RunEndingKind;
  at: number;
  title: string;
  explanation: string;
  evidence: string[];
  causes: Array<{ name: string }>;
};

export type EndingRiskViewModel = {
  kind: AdverseEndingKind;
  label: string;
  remaining: number;
  unit: 'hours' | 'complete local days';
};

export function endingPresentation(state: GameState): EndingViewModel | null {
  const ending = state.ending;
  if (!ending) return null;
  const textContext = stateTextContext(
    state,
    `ending-presentation:${ending.kind}:${ending.at}`,
  );
  if (ending.kind === 'death') {
    const copy = deathPresentationCopy(textContext);
    return {
      kind: ending.kind,
      at: ending.at,
      title: copy.title,
      explanation: copy.explanation,
      evidence: [],
      causes: ending.causes?.map((cause) => ({ name: cause.name })) ?? [
        { name: ending.cause },
      ],
    };
  }
  if (ending.kind === 'quit_streaming') {
    const copy = quitStreamingPresentationCopy(
      textContext,
      ending.durationHours,
    );
    return {
      kind: ending.kind,
      at: ending.at,
      title: copy.title,
      explanation: copy.explanation,
      evidence: [copy.evidence],
      causes: [],
    };
  }
  if (ending.kind === 'made_it') {
    const endingEvent = state.events.find(
      (event) => event.id === ending.eventIds.at(-1),
    );
    return {
      kind: ending.kind,
      at: ending.at,
      title: madeItPresentationTitle(textContext),
      explanation:
        endingEvent?.message ??
        madeItUnlockedMessage(ending.followers, textContext),
      evidence: [],
      causes: [],
    };
  }
  const financialCopy = financialRuinPresentationCopy(textContext, {
    threshold: financialRules.debt.financialRuinBalance.toLocaleString('en-US'),
    cause: ending.cause,
    balance: ending.endingBalance.toLocaleString('en-US'),
  });
  return {
    kind: ending.kind,
    at: ending.at,
    title: financialCopy.title,
    explanation: financialCopy.explanation,
    evidence: [financialCopy.cause, financialCopy.balance],
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
    endingRiskLabel(
      'quit_streaming',
      stateTextContext(
        state,
        `ending-risk-label:${state.endingRisks.quit_streaming.triggerStartedAt}`,
      ),
    ),
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
