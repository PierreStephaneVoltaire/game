import type { buildStudyResult } from './balance-study-results';
import {
  compact,
  integer,
  median,
  nullable,
  number,
  percent,
} from './balance-report-format';

type Run = ReturnType<typeof buildStudyResult>['runs'][number];

const PROFILE_ORDER = ['Casual', 'Focused', 'Optimal', 'Neglect'] as const;
const RUN_OUTCOMES = [
  'horizon',
  'death',
  'quit_streaming',
  'financial_ruin',
] as const;

export function profileSummaryTable(runs: Run[]) {
  const rows = PROFILE_ORDER.map((profile) => {
    const group = runs.filter((run) => run.profile === profile);
    const physicallyAlive = group.filter((run) => run.physicallyAlive);
    const completed = group.filter((run) => run.reachedHorizon);
    const targetHits = group.filter((run) => run.targetDay !== null);
    return `| ${profile} / ${compact(group[0].target)} | ${group.length} | ${physicallyAlive.length} (${percent(physicallyAlive.length / group.length)}) | ${completed.length} (${percent(completed.length / group.length)}) | ${targetHits.length} (${percent(targetHits.length / group.length)}) | ${integer(median(group.map((run) => run.subscribers)))} | ${nullable(median(completed.map((run) => run.subscribers)), integer)} | ${nullable(median(targetHits.map((run) => run.targetDay!)), (value) => number(value, 2))} | ${nullable(median(group.filter((run) => !run.reachedHorizon).map((run) => run.elapsedDays)), (value) => number(value, 2))} |`;
  });
  return `| Profile / target | Runs | Physically alive | 60-day completion | Target hit | Median subs, all | Completion median | Median target day | Median ending day |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}

export function survivalInterpretation(runs: Run[]) {
  const managed = runs.filter((run) => run.profile !== 'Neglect');
  const neglect = runs.filter((run) => run.profile === 'Neglect');
  const managedPhysical =
    managed.filter((run) => run.physicallyAlive).length / managed.length;
  const neglectPhysical =
    neglect.filter((run) => run.physicallyAlive).length / neglect.length;
  const managedCompletion =
    managed.filter((run) => run.reachedHorizon).length / managed.length;
  const neglectCompletion =
    neglect.filter((run) => run.reachedHorizon).length / neglect.length;
  return `Managed physical survival is ${percent(managedPhysical)} and 60-day
completion is ${percent(managedCompletion)}; exact-neglect physical survival is
${percent(neglectPhysical)} and completion is ${percent(neglectCompletion)}.
Physical life after a non-death ending is never reported as horizon completion.`;
}

export function runEndingCountTable(
  runs: Run[],
  groupKey: (run: Run) => string = (run) => run.profile,
) {
  const groups = new Map<string, Run[]>();
  for (const run of runs) {
    const key = groupKey(run);
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  const rows = [...groups.entries()].map(([group, members]) => {
    const counts = RUN_OUTCOMES.map(
      (outcome) => members.filter((run) => run.outcome === outcome).length,
    );
    const madeIt = members.filter((run) => run.madeItUnlocked).length;
    return `| ${group} | ${counts[0]} | ${madeIt} | ${counts.slice(1).join(' | ')} |`;
  });
  return `| Group | Active at horizon | Made It unlocked | Death | Quit Streaming | Financial Ruin |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}

export function formatRunOutcome(run: Run): string {
  if (run.outcome === 'horizon') return 'Horizon';
  const label = run.outcome
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
  return `${label} d${number(run.elapsedDays, 2)}`;
}
