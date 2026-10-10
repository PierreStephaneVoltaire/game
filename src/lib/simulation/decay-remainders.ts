import { HOUR_MS } from '../game-constants';
import type { GameHistory } from '../game-history-types';

type RemainderHistory = Pick<
  GameHistory,
  | 'decayRemainderMs'
  | 'healthRemainderMs'
  | 'decayRemainderHours'
  | 'healthRemainderHours'
>;

export function decayRemainderMs(history: RemainderHistory): number {
  return (
    history.decayRemainderMs ??
    Math.round((history.decayRemainderHours ?? 0) * HOUR_MS)
  );
}

export function healthRemainderMs(history: RemainderHistory): number {
  return (
    history.healthRemainderMs ??
    Math.round((history.healthRemainderHours ?? 0) * HOUR_MS)
  );
}
