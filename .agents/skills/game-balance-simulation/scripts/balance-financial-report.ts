import type { buildStudyResult } from './balance-study-results';
import { integer, median, number, signed, sum } from './balance-report-format';

type Run = ReturnType<typeof buildStudyResult>['runs'][number];

export function financialPressureTable(runs: Run[]) {
  const credit = mergeRecords(
    runs.map((run) => run.financial.creditSpendingByCategory),
  );
  const rows = Object.entries(credit)
    .sort((left, right) => right[1] - left[1])
    .map(([category, amount]) => `| ${category} | $${integer(amount)} |`);
  const debtPositive = runs.filter((run) => run.financial.peakTotalDebt > 0);
  const enteredDebt = runs.filter(
    (run) => run.financial.firstInDebtDay !== null,
  );
  const opened = runs.filter((run) => run.financial.lineOfCredit.opened);
  const crossings = (threshold: string) =>
    runs.filter((run) => run.financial.debtCrossings[threshold] !== null).length;
  return `| Financial diagnostic | Result |
| --- | ---: |
| Runs entering In Debt | ${runs.filter((run) => run.financial.firstInDebtDay !== null).length} |
| Median peak total debt (all runs) | $${integer(median(runs.map((run) => run.financial.peakTotalDebt)))} |
| Median peak total debt (debt-positive runs) | $${integer(median(debtPositive.map((run) => run.financial.peakTotalDebt)))} |
| Median peak total debt (In Debt runs) | $${integer(median(enteredDebt.map((run) => run.financial.peakTotalDebt)))} |
| Maximum peak total debt | $${integer(Math.max(...runs.map((run) => run.financial.peakTotalDebt)))} |
| Total In Debt exposure | ${number(sum(runs.map((run) => run.financial.hoursInDebt)), 2)} hours |
| Crossed $10,000 total debt | ${crossings('10000')} runs |
| Crossed $15,000 total debt | ${crossings('15000')} runs |
| Crossed $20,000 total debt | ${crossings('20000')} runs |
| LOC uptake | ${opened.length} runs |
| LOC repayment units purchased | ${integer(sum(runs.map((run) => run.financial.lineOfCredit.repaymentUnitsPurchased)))} |
| LOC remaining closure cost | $${integer(sum(runs.map((run) => run.financial.lineOfCredit.remainingClosureCost)))} |

| Credit spending category | Amount financed into negative cash |
| --- | ---: |
${rows.join('\n') || '| None | $0 |'}`;
}

export function lifeEventImpactTable(runs: Run[]) {
  const impacts = mergeLifeEventImpacts(runs);
  const rows = Object.entries(impacts)
    .sort((left, right) => right[1].resolutions - left[1].resolutions)
    .map(([event, impact]) => {
      const metrics = Object.entries(impact.metrics)
        .filter(([, amount]) => amount !== 0)
        .map(([metric, amount]) => `${metric} ${amount > 0 ? '+' : ''}${amount}`)
        .join(', ');
      const outcomes = Object.entries(impact.outcomes)
        .map(([id, count]) => `${id}×${count}`)
        .join(', ');
      return `| ${event} | ${integer(impact.resolutions)} | ${metrics || '—'} | ${signed(impact.cash)} | ${signed(impact.followers)} | ${outcomes || '—'} |`;
    });
  const metricRows = [
    'food',
    'health',
    'mood',
    'rest',
    'bond',
    'creativity',
  ].map((metric) => {
    const values = runs.map(
      (run) =>
        run.lifeEvents.metrics[
          metric as keyof typeof run.lifeEvents.metrics
        ],
    );
    return `| ${metric} | +${integer(sum(values.map((value) => value.additions)))} | −${integer(sum(values.map((value) => value.losses)))} |`;
  });
  return `| Life event | Resolutions | Net metric effects | Net cash | Net subscribers | Outcomes |
| --- | ---: | --- | ---: | ---: | --- |
${rows.join('\n') || '| None | 0 | — | $0 | 0 | — |'}

| Metric | Additions | Losses |
| --- | ---: | ---: |
${metricRows.join('\n')}

Cash additions were $${integer(sum(runs.map((run) => run.lifeEvents.cashAdditions)))};
cash subtractions were $${integer(sum(runs.map((run) => run.lifeEvents.cashSubtractions)))}.
Subscriber additions were ${integer(sum(runs.map((run) => run.lifeEvents.subscriberAdditions)))};
Subscriber losses were ${integer(sum(runs.map((run) => run.lifeEvents.subscriberLosses)))}.
The study observed ${integer(sum(runs.map((run) => run.lifeEvents.discoveryBoosts)))}
temporary natural-discovery boosts across
${number(sum(runs.map((run) => run.lifeEvents.discoveryBoostExposureHours)), 2)} exposure-hours.`;
}

function mergeLifeEventImpacts(runs: Run[]) {
  const merged: Record<
    string,
    {
      resolutions: number;
      metrics: Record<string, number>;
      cash: number;
      followers: number;
      outcomes: Record<string, number>;
    }
  > = {};
  for (const run of runs)
    for (const [event, impact] of Object.entries(run.lifeEvents.impacts)) {
      const target = (merged[event] ??= {
        resolutions: 0,
        metrics: {},
        cash: 0,
        followers: 0,
        outcomes: {},
      });
      target.resolutions += impact.resolutions;
      target.cash += impact.cash;
      target.followers += impact.followers;
      target.metrics = mergeRecords([target.metrics, impact.metrics]);
      target.outcomes = mergeRecords([target.outcomes, impact.outcomes]);
    }
  return merged;
}

function mergeRecords(records: Array<Record<string, number>>) {
  const merged: Record<string, number> = {};
  for (const record of records)
    for (const [key, value] of Object.entries(record))
      merged[key] = (merged[key] ?? 0) + value;
  return merged;
}
