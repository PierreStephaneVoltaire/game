#!/usr/bin/env node
/* global process */
import { readFileSync, writeFileSync } from 'node:fs';

const outputPath = process.argv[2] ?? 'docs/LOC_BALANCE_RESULTS.json';
const argumentsAfterOutput = process.argv.slice(3);
const refresh = argumentsAfterOutput.length === 1 && argumentsAfterOutput[0] === '--refresh';
const batchPaths = refresh ? [] : argumentsAfterOutput;
if (!refresh && batchPaths.length !== 16)
  throw new Error('LOC cohort merge requires exactly 16 batches.');
const partials = refresh
  ? [JSON.parse(readFileSync(outputPath, 'utf8'))]
  : batchPaths.map((path) => JSON.parse(readFileSync(path, 'utf8')));
const runs = partials.flatMap((partial) => partial.runs ?? []);
if (runs.length !== 400) throw new Error('LOC cohorts must contain 400 runs.');
if (new Set(runs.map((run) => run.id)).size !== runs.length)
  throw new Error('LOC cohort runs must have unique IDs.');
const result = {
  ...partials[0],
  study: {
    ...partials[0].study,
    id: 'loc-cohorts-400-v1',
    question:
      'How do the four controlled line-of-credit cohorts affect survival, debt repayment, target attainment, and Financial Ruin over 60 game-days?',
    batchCount: 16,
    batchSize: 25,
    totalRuns: 400,
  },
  configured: {
    ...partials[0].configured,
    cohort: Object.fromEntries(
      [...new Set(runs.map((run) => run.label))].map((label) => [
        label,
        runs.filter((run) => run.label === label).length,
      ]),
    ),
  },
  cohortSummaries: buildCohortSummaries(runs),
  runs,
};
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `${refresh ? 'refreshed' : 'merged'} ${runs.length} LOC cohort runs into ${outputPath}`,
);

function buildCohortSummaries(allRuns) {
  const labels = [...new Set(allRuns.map((run) => run.label))];
  return Object.fromEntries(
    labels.map((label) => {
      const cohort = allRuns.filter((run) => run.label === label);
      const endingDays = cohort
        .filter((run) => !run.reachedHorizon)
        .map((run) => run.elapsedDays);
      const peakDebts = cohort.map((run) => run.financial.peakTotalDebt);
      const outcomeCounts = Object.fromEntries(
        ['horizon', 'death', 'quit_streaming', 'financial_ruin'].map((outcome) => [
          outcome,
          cohort.filter((run) => run.outcome === outcome).length,
        ]),
      );
      const financialRuinTriggerCauses = {};
      for (const run of cohort) {
        const trigger = run.financial.financialRuinTrigger;
        if (!trigger) continue;
        const cause = trigger.eventType ?? trigger.kind ?? trigger.lifeEventId ?? 'unknown';
        financialRuinTriggerCauses[cause] =
          (financialRuinTriggerCauses[cause] ?? 0) + 1;
      }
      const targetAttainmentCount = cohort.filter(
        (run) => run.targetDay !== null,
      ).length;
      return [
        label,
        {
          runCount: cohort.length,
          outcomeCounts,
          medianEndingDay: median(endingDays),
          medianPeakDebt: median(peakDebts),
          maximumPeakDebt: Math.max(...peakDebts),
          lineOfCredit: {
            opened: cohort.filter((run) => run.financial.lineOfCredit.opened)
              .length,
            closed: cohort.filter((run) => run.financial.lineOfCredit.closed)
              .length,
            repaymentUnitsPurchased: sum(
              cohort,
              (run) => run.financial.lineOfCredit.repaymentUnitsPurchased,
            ),
            remainingClosureCost: sum(
              cohort,
              (run) => run.financial.lineOfCredit.remainingClosureCost,
            ),
          },
          targetAttainment: {
            count: targetAttainmentCount,
            rate: targetAttainmentCount / cohort.length,
          },
          madeItCount: cohort.filter((run) => run.madeItUnlocked).length,
          financialRuinTriggerCauses,
        },
      ];
    }),
  );
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function sum(values, selector) {
  return values.reduce((total, value) => total + selector(value), 0);
}
