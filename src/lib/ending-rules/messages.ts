import type { NonDeathEndingKind } from '../game-types';
import endingRules from '../data/ending-rules.json';

export const endingPresentationTexts = endingRules.texts.presentation;
export const endingHistoryTexts = endingRules.texts.history;
export const endingArchiveTexts = endingRules.texts.archive;

export function formatEndingMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function endingWarningMessage(
  kind: NonDeathEndingKind,
  stage: number,
): string {
  if (kind === 'quit_streaming')
    return stage === 0
      ? endingRules.texts.events.quitStreamingWarningStarted
      : formatEndingMessage(
          endingRules.texts.events.quitStreamingWarningContinued,
          { hours: stage },
        );
  return endingRules.texts.events.financialRuinWarning;
}

export function endingRiskRecoveryMessage(kind: NonDeathEndingKind): string {
  if (kind === 'quit_streaming')
    return endingRules.texts.events.quitStreamingRecovered;
  return endingRules.texts.events.financialRuinRecovered;
}

export function runEndingMessage(kind: NonDeathEndingKind): string {
  return kind === 'quit_streaming'
    ? endingRules.texts.events.runEndedQuitStreaming
    : endingRules.texts.events.runEndedFinancialRuin;
}

export function deathEventMessage(): string {
  return endingRules.texts.events.death;
}

export function madeItUnlockedMessage(followers: number): string {
  return formatEndingMessage(endingRules.texts.events.madeItUnlocked, {
    followers: followers.toLocaleString('en-US'),
  });
}

export function financialRuinCause(): string {
  return endingRules.texts.events.financialRuinCause;
}

export function deathCauseText(
  cause: keyof typeof endingRules.texts.deathCauses,
): string {
  return endingRules.texts.deathCauses[cause];
}

export function runOverMessage(): string {
  return endingRules.texts.events.runOver;
}
