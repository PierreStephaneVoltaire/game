import type { buildStudyResult } from './balance-study-results';
import { integer, median, number, percent } from './balance-report-format';
import {
  economyTotals,
  economyTotalsTable,
  runEndingCountTable,
} from './balance-report-sections';

type Result = ReturnType<typeof buildStudyResult>;

export function renderBatchReport(
  result: Result,
  batch: number,
  batchCount: number,
) {
  const first = result.runs[0];
  const last = result.runs.at(-1);
  const rows = result.runs.map(
    (run) =>
      `| ${run.id} | ${run.profile} | ${run.outcome} | ${integer(run.subscribers)} | ${run.targetDay === null ? 'Missed' : `d${number(run.targetDay, 2)}`} | ${run.healthProfile.minimum} | $${integer(run.economy.endingBalance)} | $${integer(run.financial.endingDebt.total)} |`,
  );
  return `# 100-Run Balance Study — Batch ${batch} of ${batchCount}

This isolated process ran ${result.runs.length} deterministic profiles from
${first?.id ?? 'unknown'} through ${last?.id ?? 'unknown'} against the real
engine. The combined report is generated only after all ${batchCount} batch
result files validate.

## Profile summary

${batchSummaryTable(result.runs)}

## Ending counts

${runEndingCountTable(result.runs, (run) =>
  run.studyGroup === 'controlled' ? run.profile : run.archetype,
)}

## Every run

| Run | Profile | Outcome | Audience | Target | Min Health | Cash | Debt |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: |
${rows.join('\n')}

## Economy

${economyTotalsTable(economyTotals(result.runs))}
`;
}

function batchSummaryTable(runs: Result['runs']) {
  const groups = new Map<string, Result['runs']>();
  for (const run of runs) {
    const label =
      run.studyGroup === 'controlled' ? run.profile : run.archetype;
    groups.set(label, [...(groups.get(label) ?? []), run]);
  }
  const rows = [...groups.entries()].map(([label, group]) => {
    const physicallyAlive = group.filter((run) => run.physicallyAlive).length;
    const completed = group.filter((run) => run.reachedHorizon).length;
    const targets = group.filter((run) => run.targetDay !== null).length;
    return `| ${label} | ${group.length} | ${physicallyAlive} (${percent(physicallyAlive / group.length)}) | ${completed} (${percent(completed / group.length)}) | ${targets} (${percent(targets / group.length)}) | ${integer(median(group.map((run) => run.subscribers)))} | $${integer(median(group.map((run) => run.economy.endingBalance)))} |`;
  });
  return `| Group | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median cash |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}
