import type { AdverseEndingKind } from '../game-types';
import { endingRules } from '../runtime-definition';
import {
  interpolateText,
  selectSeededText,
  type SeededTextContext,
} from '../seeded-text';

type TextRecord<T extends Record<string, readonly string[]>> = {
  [Key in keyof T]: string;
};

export function formatEndingMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  return interpolateText(template, values);
}

function eventText(
  key: string,
  context?: SeededTextContext,
  values: Record<string, string | number> = {},
): string {
  return selectSeededText(
    endingRules.texts.events[key],
    context,
    `ending.events.${key}`,
    values,
  );
}

function selectTextRecord<T extends Record<string, readonly string[]>>(
  texts: T,
  context: SeededTextContext,
  ruleId: string,
): TextRecord<T> {
  return Object.fromEntries(
    Object.entries(texts).map(([key, options]) => [
      key,
      selectSeededText(options, context, `${ruleId}.${key}`),
    ]),
  ) as TextRecord<T>;
}

export function endingHistoryCopy(
  context: SeededTextContext,
): TextRecord<typeof endingRules.texts.history> {
  return selectTextRecord(endingRules.texts.history, context, 'ending.history');
}

export function endingArchiveCopy(
  context: SeededTextContext,
): TextRecord<typeof endingRules.texts.archive> {
  return selectTextRecord(endingRules.texts.archive, context, 'ending.archive');
}

export function deathPresentationCopy(context: SeededTextContext): {
  title: string;
  explanation: string;
} {
  return {
    title: selectSeededText(
      endingRules.texts.presentation.death.title,
      context,
      'ending.presentation.death.title',
    ),
    explanation: selectSeededText(
      endingRules.texts.presentation.death.explanation,
      context,
      'ending.presentation.death.explanation',
    ),
  };
}

export function quitStreamingPresentationCopy(
  context: SeededTextContext,
  durationHours: number,
): { title: string; explanation: string; evidence: string } {
  const values = { durationHours };
  const texts = endingRules.texts.presentation.quitStreaming;
  return {
    title: selectSeededText(
      texts.title,
      context,
      'ending.presentation.quitStreaming.title',
    ),
    explanation: selectSeededText(
      texts.explanation,
      context,
      'ending.presentation.quitStreaming.explanation',
      values,
    ),
    evidence: selectSeededText(
      texts.evidence,
      context,
      'ending.presentation.quitStreaming.evidence',
      values,
    ),
  };
}

export function financialRuinPresentationCopy(
  context: SeededTextContext,
  values: { threshold: string; cause: string; balance: string },
): { title: string; explanation: string; cause: string; balance: string } {
  const texts = endingRules.texts.presentation.financialRuin;
  return {
    title: selectSeededText(
      texts.title,
      context,
      'ending.presentation.financialRuin.title',
    ),
    explanation: selectSeededText(
      texts.explanation,
      context,
      'ending.presentation.financialRuin.explanation',
      values,
    ),
    cause: selectSeededText(
      texts.causeEvidence,
      context,
      'ending.presentation.financialRuin.causeEvidence',
      values,
    ),
    balance: selectSeededText(
      texts.balanceEvidence,
      context,
      'ending.presentation.financialRuin.balanceEvidence',
      values,
    ),
  };
}

export function madeItPresentationTitle(context: SeededTextContext): string {
  return selectSeededText(
    endingRules.texts.presentation.madeIt.title,
    context,
    'ending.presentation.madeIt.title',
  );
}

export function endingRiskLabel(
  kind: AdverseEndingKind,
  context: SeededTextContext,
): string {
  if (kind === 'quit_streaming')
    return selectSeededText(
      endingRules.texts.presentation.quitStreaming.riskLabel,
      context,
      'ending.presentation.quitStreaming.riskLabel',
    );
  return selectSeededText(
    endingRules.texts.presentation.financialRuin.title,
    context,
    'ending.presentation.financialRuin.title',
  );
}

export function endingWarningMessage(
  kind: AdverseEndingKind,
  stage: number,
  context?: SeededTextContext,
): string {
  if (kind === 'quit_streaming')
    return stage === 0
      ? eventText('quitStreamingWarningStarted', context)
      : eventText('quitStreamingWarningContinued', context, { hours: stage });
  return eventText('financialRuinWarning', context);
}

export function endingRiskRecoveryMessage(
  kind: AdverseEndingKind,
  context?: SeededTextContext,
): string {
  return kind === 'quit_streaming'
    ? eventText('quitStreamingRecovered', context)
    : eventText('financialRuinRecovered', context);
}

export function runEndingMessage(
  kind: AdverseEndingKind,
  context?: SeededTextContext,
): string {
  return kind === 'quit_streaming'
    ? eventText('runEndedQuitStreaming', context)
    : eventText('runEndedFinancialRuin', context);
}

export function deathEventMessage(context?: SeededTextContext): string {
  return eventText('death', context);
}

export function madeItUnlockedMessage(
  followers: number,
  context?: SeededTextContext,
): string {
  return eventText('madeItUnlocked', context, {
    followers: followers.toLocaleString('en-US'),
  });
}

export function financialRuinCause(context?: SeededTextContext): string {
  return eventText('financialRuinCause', context);
}

export function deathCauseText(
  cause: string,
  context?: SeededTextContext,
): string {
  return selectSeededText(
    endingRules.texts.deathCauses[cause],
    context,
    `ending.deathCauses.${cause}`,
  );
}

export function runOverMessage(context?: SeededTextContext): string {
  return eventText('runOver', context);
}
