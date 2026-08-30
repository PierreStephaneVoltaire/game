import type { buildStudyResult } from './balance-study-results';
import { integer, median, number, percent } from './balance-report-format';

type Result = ReturnType<typeof buildStudyResult>;
type Run = Result['runs'][number];

export function cadenceSummary(runs: Run[]) {
  const controlled = runs.filter(
    (run) =>
      (run.profile === 'Casual' || run.profile === 'Focused') &&
      run.reachedHorizon,
  );
  const rows = ['Casual', 'Focused'].map((profile) => {
    const cohort = controlled.filter((run) => run.profile === profile);
    const passing = cohort.filter(
      (run) => run.cadence.ordinaryStreamStarts >= 45,
    ).length;
    return `| ${profile} | ${cohort.length} | ${number(median(cohort.map((run) => run.cadence.ordinaryStreamStarts)), 1)} | ${passing} (${percent(passing / cohort.length)}) | ${number(median(cohort.map((run) => run.cadence.maximumActualStartGapHours)), 1)} | ${number(median(cohort.map((run) => run.cadence.blockedHours)), 1)} |`;
  });
  return `| Horizon cohort | Runs | Median ordinary starts | At least 45 | Median longest gap | Median blocked hours |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}

export function cadenceExceptions(runs: Run[]) {
  const exceptions = runs.filter(
    (run) =>
      (run.profile === 'Casual' || run.profile === 'Focused') &&
      run.reachedHorizon &&
      run.cadence.ordinaryStreamStarts < 45,
  );
  const rows = exceptions.map(
    (run) =>
      `| ${run.id} | ${run.profile} | ${run.cadence.ordinaryStreamStarts} | ${number(run.cadence.blockedHours, 1)} | ${run.cadence.tooTiredSelections} | ${number(run.cadence.maximumActualStartGapHours, 1)} | ${integer(run.cadence.streamEligibleOpportunities)} |`,
  );
  return `| Run | Cohort | Starts | Blocked hours | Too tired | Longest gap | Eligible opportunities |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n') || '| — | — | 0 | 0 | 0 | 0 | 0 |'}`;
}
