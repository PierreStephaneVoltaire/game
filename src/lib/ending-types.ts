import type { HealthDamageSource } from './game-types';

export type RunEndingKind = 'death' | 'quit_streaming' | 'financial_ruin';

export type EndingKind = RunEndingKind | 'made_it';

export type NonDeathEndingKind = Exclude<RunEndingKind, 'death'>;

export type DeathCause = Pick<HealthDamageSource, 'kind' | 'id' | 'name'> & {
  eventIds: string[];
};

export type DeathEnding = {
  kind: 'death';
  at: number;
  /** Compatibility summary; player UI renders the structured causes. */
  cause: string;
  causes?: DeathCause[];
  eventIds: string[];
};

type MetricEnding<Kind extends 'quit_streaming'> = {
  kind: Kind;
  at: number;
  triggerStartedAt: number;
  durationHours: number;
  endingMetricValue: number;
  eventIds: string[];
  cause?: never;
  causes?: never;
};

export type MetricRunEnding = MetricEnding<'quit_streaming'>;

export type FinancialRuinEnding = {
  kind: 'financial_ruin';
  at: number;
  cause: 'Insolvency';
  endingBalance: number;
  totalDebt: number;
  debtComponents: import('./financial-types').DebtBreakdown;
  triggerEventId: string;
  eventIds: string[];
  causes?: never;
};

export type RunEnding = DeathEnding | MetricRunEnding | FinancialRuinEnding;

export type MadeItEndingUnlock = {
  kind: 'made_it';
  at: number;
  followers: number;
  peakFollowers: number;
  triggerEventId: string;
  eventIds: string[];
};

export type EndingUnlocks = { made_it: MadeItEndingUnlock | null };

export type EndingRiskClock = {
  triggerStartedAt: number | null;
  /** Numeric stages already narrated: game-hours for metrics, local days for cash. */
  warningStages: number[];
  warningEventIds: string[];
};

export type EndingRiskClocks = { quit_streaming: EndingRiskClock };
