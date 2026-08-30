import type { buildStudyResult } from './balance-study-results';

type Result = ReturnType<typeof buildStudyResult>;

export function mergeStudyResults(partials: Result[]): Result {
  if (partials.length !== 4)
    throw new Error('The expanded balance study requires exactly four batches.');
  if (partials.some((partial) => partial.runs.length !== 25))
    throw new Error('Each expanded balance study batch must contain 25 runs.');
  const runs = partials.flatMap((partial) => partial.runs);
  if (runs.length !== 100)
    throw new Error('Expanded balance study batches must total 100 runs.');
  const ids = runs.map((run) => run.id);
  if (new Set(ids).size !== ids.length)
    throw new Error('Balance study batches contain duplicate run IDs.');
  const template = partials.find(
    (partial) => partial.study.extensionPolicyVersion !== null,
  );
  if (!template)
    throw new Error('Balance study batches omit the heterogeneous extension.');
  for (const partial of partials) {
    if (partial.study.engine !== template.study.engine)
      throw new Error('Balance study batches use different engines.');
    if (partial.study.horizonDays !== template.study.horizonDays)
      throw new Error('Balance study batches use different horizons.');
    if (partial.study.engineRevision !== template.study.engineRevision)
      throw new Error('Balance study batches use different engine revisions.');
  }
  return {
    ...template,
    configured: {
      ...template.configured,
      cohort: frequency(runs.map((run) => run.profile)),
      studyGroups: frequency(runs.map((run) => run.studyGroup)),
      archetypes: frequency(runs.map((run) => run.archetype)),
    },
    runs,
  };
}

function frequency(values: string[]) {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}
