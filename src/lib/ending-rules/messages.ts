import type { NonDeathEndingKind } from '../game-types';

export function endingWarningMessage(
  kind: NonDeathEndingKind,
  stage: number,
): string {
  if (kind === 'quit_streaming')
    return stage === 0
      ? 'Mood reached 0. The Quit Streaming countdown began.'
      : `Mood has remained at 0 for ${stage} hours.`;
  return 'Total debt is approaching Financial Ruin.';
}

export function endingRiskRecoveryMessage(kind: NonDeathEndingKind): string {
  if (kind === 'quit_streaming')
    return 'Mood recovered; the Quit Streaming countdown cleared.';
  return 'Total debt recovered.';
}

export function runEndingMessage(kind: NonDeathEndingKind): string {
  if (kind === 'quit_streaming') return 'The run ended: Quit Streaming.';
  return 'The run ended: Financial Ruin.';
}
