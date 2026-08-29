import type { ConsumptionRecord, GameState } from '../game-types';
import rules from '../data/simulation-rules.json';
import { HOUR_MS } from '../game-constants';

export type SugarCrashConsumptionResolution = {
  statuses: GameState['statuses'];
  dueAt: number | null;
  effectiveSugar: number;
  transition: 'scheduled' | 'cancelled' | 'active_cleared' | null;
};

export function effectiveSugarExposure(
  consumptions: ConsumptionRecord[],
  now: number,
): number {
  const windowStart = now - rules.sugarCrash.windowHours * HOUR_MS;
  const recent = consumptions.filter((record) => record.at >= windowStart);
  const sugar = recent.reduce((sum, record) => sum + record.sugar, 0);
  const protein = recent.reduce((sum, record) => sum + record.protein, 0);
  return Math.max(0, sugar - protein);
}

/** Evaluate a successful consumption atomically after sugar and protein land. */
export function resolveSugarCrashConsumption(input: {
  consumptions: ConsumptionRecord[];
  statuses: GameState['statuses'];
  dueAt: number | null;
  now: number;
}): SugarCrashConsumptionResolution {
  const effectiveSugar = effectiveSugarExposure(input.consumptions, input.now);
  const below = effectiveSugar < rules.sugarCrash.effectiveSugarThreshold;
  const statuses = { ...input.statuses };
  if (below && statuses.sugar_crash) {
    delete statuses.sugar_crash;
    return {
      statuses,
      dueAt: null,
      effectiveSugar,
      transition: 'active_cleared',
    };
  }
  if (below && input.dueAt !== null)
    return {
      statuses,
      dueAt: null,
      effectiveSugar,
      transition: 'cancelled',
    };
  if (!below && !statuses.sugar_crash && input.dueAt === null)
    return {
      statuses,
      dueAt: input.now + rules.sugarCrash.delayHours * HOUR_MS,
      effectiveSugar,
      transition: 'scheduled',
    };
  return {
    statuses,
    dueAt: input.dueAt,
    effectiveSugar,
    transition: null,
  };
}
