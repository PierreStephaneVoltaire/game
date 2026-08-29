import type { buildStudyResult } from './balance-study-results';
import { integer, median, number, percent, sum } from './balance-report-format';
import {
  damageTable,
  economyTotals,
  economyTotalsTable,
  profileSummaryTable,
  runEndingCountTable,
  statusTable,
  lifeEventSchedulerTable,
  rotisserieChickenTable,
} from './balance-report-sections';
import {
  financialPressureTable,
  lifeEventImpactTable,
} from './balance-financial-report';

type Result = ReturnType<typeof buildStudyResult>;
type Run = Result['runs'][number];

export function renderExpandedReport(result: Result) {
  const controlled = result.runs.filter(
    (run) => run.studyGroup === 'controlled',
  );
  const heterogeneous = result.runs.filter(
    (run) => run.studyGroup === 'heterogeneous',
  );
  const physicallyAlive = heterogeneous.filter((run) => run.physicallyAlive);
  const completed = heterogeneous.filter((run) => run.reachedHorizon);
  const totalDays = sum(result.runs.map((run) => run.elapsedDays));
  return `# 100-Run Controlled and Heterogeneous Balance Diagnosis

Policy contract: canonical v${result.study.canonicalPolicyVersion}, heterogeneous
extension v${result.study.extensionPolicyVersion}. This report is generated from
the real seeded engine. It preserves the maintained controlled 50 and adds one
deterministic run for each profile P51–P100. Complete per-run data is in
[ECONOMY_EVENTS_BALANCE_RESULTS.json](./ECONOMY_EVENTS_BALANCE_RESULTS.json).

## Main result

The heterogeneous extension remained physically alive in ${physicallyAlive.length}/50
runs (${percent(physicallyAlive.length / 50)}) and reached the 60-day horizon in
${completed.length}/50 (${percent(completed.length / 50)}). Its all-run median
ending audience was ${integer(median(heterogeneous.map((run) => run.subscribers)))};
the horizon-completion median was
${integer(median(completed.map((run) => run.subscribers)))}. The
combined study observed ${number(totalDays, 1)} run-days without merging the
controlled cohorts into a misleading overall completion percentage.

## Controlled regression benchmark

${profileSummaryTable(controlled)}

### Controlled outcomes by cohort

${runEndingCountTable(controlled)}

## Heterogeneous archetypes

${groupSummary(heterogeneous, (run) => run.archetype)}

### Heterogeneous outcomes by archetype

${runEndingCountTable(heterogeneous, (run) => run.archetype)}

## Targeted non-death Ending validation

${endingValidationTable(heterogeneous)}

P91 reaches Financial Ruin through its ordinary deterministic debt-indifferent
policy. P100 is a controlled boundary profile that enters the real Ending
reconciler when the authored 72-hour zero-Mood countdown is due. It validates
the Ending record, warnings, and precedence boundary without claiming that the
current autonomous-Mood environment naturally sustains that window. The study
test fails if either configured expected outcome is not observed.

## Every heterogeneous profile

${profileTable(heterogeneous)}

## Behavior-axis comparisons

### Cadence model

${axisTable(heterogeneous, (run) => expandedPolicy(run).schedule.type)}

### Care philosophy

${axisTable(heterogeneous, (run) => expandedPolicy(run).care.strategy)}

### Nutrition knowledge

${axisTable(heterogeneous, (run) => expandedPolicy(run).nutrition.strategy)}

### Spending intensity

${axisTable(
  heterogeneous,
  (run) => expandedPolicy(run).shopping.spendAggressiveness,
)}

### Career strategy

${axisTable(heterogeneous, (run) => expandedPolicy(run).career.strategy)}

### Hospital strategy

${axisTable(heterogeneous, (run) => expandedPolicy(run).medical.strategy)}

### Rescue awareness

${axisTable(heterogeneous, (run) => expandedPolicy(run).autonomyAwareness)}

## Physical survival, completion, recovery, and pressure

${damageTable(result.runs)}

${statusTable(result.runs)}

${healthSummary(heterogeneous)}

## Care and visit behavior

${careSummary(heterogeneous)}

## Nutrition counterplay

${comparisonTable(heterogeneous, ['P74', 'P75', 'P76', 'P77', 'P78', 'P79'])}

Across the heterogeneous profiles, the engine produced
${integer(sum(heterogeneous.map((run) => run.nutritionBehavior.sugarWarnings)))}
Sugar Crash warnings,
${integer(sum(heterogeneous.map((run) => run.nutritionBehavior.sugarCrashes)))}
actual crashes,
${integer(sum(heterogeneous.map((run) => run.nutritionBehavior.proteinCancellations)))}
protein cancellations, and
${integer(sum(heterogeneous.map((run) => run.nutritionBehavior.stoneOnsets)))}
Kidney Stone onsets.

## Rescue reliance and ordinary autonomy

${comparisonTable(heterogeneous, ['P69', 'P70', 'P71', 'P96', 'P97', 'P98'])}

Food rescues totaled
${integer(sum(heterogeneous.map((run) => run.rescues.food)))} and Rest rescues
totaled ${integer(sum(heterogeneous.map((run) => run.rescues.rest)))}. Player
actions reset ${integer(sum(heterogeneous.map((run) => run.rescues.followup.lockResets.food)))}
Food locks and
${integer(sum(heterogeneous.map((run) => run.rescues.followup.lockResets.rest)))}
Rest locks. The result contract records physical survival for 12/24 hours after rescue;
that is a timing measure, not a causal claim that the rescue prevented death.

## Hospital and medical economy

${comparisonTable(heterogeneous, ['P84', 'P85', 'P86', 'P87', 'P88', 'P89', 'P90', 'P91'])}

The extension created
${integer(sum(heterogeneous.map((run) => run.medical.bills)))} bills, made
${integer(sum(heterogeneous.map((run) => run.medical.dailyPaymentEvents)))}
scheduled payments and
${integer(sum(heterogeneous.map((run) => run.medical.fullPayments)))} discounted
full payments, ending with
$${integer(sum(heterogeneous.map((run) => run.medical.remainingPrincipal)))} in
explicit principal.

${economyTotalsTable(economyTotals(result.runs))}

### Debt and Line of Credit diagnostics

${financialPressureTable(result.runs)}

### VTuber-life events

${lifeEventImpactTable(result.runs)}

### Life-event scheduler counters

${lifeEventSchedulerTable(result.runs)}

### Rotisserie Chicken exposure and outcomes

${rotisserieChickenTable(result.runs)}

## Career aggression

${comparisonTable(heterogeneous, ['P92', 'P93', 'P94', 'P95'])}

## Balance-question analysis

${balanceAnswers(heterogeneous)}

## Method and counterfactual boundary

- P51–P100 are configuration records interpreted by shared schedule, care,
  shopping, nutrition, career, medical, debt, and autonomy strategies. Their
  overlays are recorded per run.
- Scheduled, attended, busy, skipped, and retried visits are distinct. A busy
  visit is not silently moved unless its profile explicitly retries.
- Profile decisions are deterministic. Gameplay continues to use the engine's
  seed, state version, and command identity.
- The 40 HP production baseline is reported here first. The requested paired
  30 HP counterfactual remains a separately labeled experiment; it must not be
  conflated with this baseline or a production rule change.
- Financial Ruin used the production $20,000 total-debt threshold. The $15,000
  counterfactual was not executed in this baseline and did not modify
  production data.
`;
}

function groupSummary(runs: Run[], key: (run: Run) => string) {
  const groups = groupRuns(runs, key);
  const rows = [...groups.entries()].map(([label, group]) =>
    summaryRow(label, group),
  );
  return summaryHeader(rows);
}

function axisTable(runs: Run[], key: (run: Run) => string) {
  return groupSummary(runs, key);
}

function summaryHeader(rows: string[]) {
  return `| Group | Runs | Physically alive | 60-day completion | Target hit | Median audience | Median min Health | Median ending cash | Remaining debt |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}

function summaryRow(label: string, runs: Run[]) {
  const physicallyAlive = runs.filter((run) => run.physicallyAlive).length;
  const completed = runs.filter((run) => run.reachedHorizon).length;
  const targets = runs.filter((run) => run.targetDay !== null).length;
  return `| ${label} | ${runs.length} | ${physicallyAlive} (${percent(physicallyAlive / runs.length)}) | ${completed} (${percent(completed / runs.length)}) | ${targets} (${percent(targets / runs.length)}) | ${integer(median(runs.map((run) => run.subscribers)))} | ${number(median(runs.map((run) => run.healthProfile.minimum)), 1)} | $${integer(median(runs.map((run) => run.economy.endingBalance)))} | $${integer(sum(runs.map((run) => run.financial.endingDebt.total)))} |`;
}

function profileTable(runs: Run[]) {
  const rows = runs.map(
    (run) =>
      `| ${run.profile} | ${run.label} | ${run.archetype} | ${run.outcome} | ${integer(run.subscribers)} | ${run.targetDay === null ? 'Missed' : `d${number(run.targetDay, 2)}`} | ${run.healthProfile.minimum} | $${integer(run.economy.endingBalance)} | $${integer(run.financial.endingDebt.total)} |`,
  );
  return `| ID | Profile | Type | Outcome | Audience | Target | Min Health | Cash | Debt |
| --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: |
${rows.join('\n')}`;
}

function comparisonTable(runs: Run[], ids: string[]) {
  const selected = ids.flatMap((id) =>
    runs.filter((run) => run.profile === id),
  );
  return profileTable(selected);
}

function endingValidationTable(runs: Run[]) {
  const selected = runs.filter(
    (run) => expandedPolicy(run).expectedOutcome !== undefined,
  );
  const rows = selected.map((run) => {
    const expected = expandedPolicy(run).expectedOutcome!;
    return `| ${run.profile} | ${run.label} | ${formatOutcome(expected)} | ${formatOutcome(run.outcome)} | ${run.outcome === expected ? 'Pass' : 'Fail'} | d${number(run.elapsedDays, 2)} |`;
  });
  return `| ID | Profile | Expected Ending | Observed outcome | Validation | Ending day |
| --- | --- | --- | --- | --- | ---: |
${rows.join('\n')}`;
}

function formatOutcome(outcome: string) {
  if (outcome === 'quit_streaming') return 'Quit Streaming';
  if (outcome === 'financial_ruin') return 'Financial Ruin';
  if (outcome === 'death') return 'Death';
  return 'Horizon Completion';
}

function healthSummary(runs: Run[]) {
  const repeatedRecovery = runs.filter(
    (run) => run.healthProfile.totalRecovery >= 20 && run.physicallyAlive,
  );
  return `${runs.filter((run) => run.healthProfile.minimum <= 8).length}/50 profiles reached Health 8 or lower. ${repeatedRecovery.length}/50 remained physically alive after receiving at least 20 points of cumulative Health recovery. Median time at Health 8 or lower was ${number(median(runs.map((run) => run.healthProfile.hoursAtOrBelow8)), 2)} hours.`;
}

function careSummary(runs: Run[]) {
  const actions = (metric: string) =>
    sum(runs.map((run) => run.careBehavior.actions[metric] ?? 0));
  return `The extension recorded ${integer(actions('food'))} Food actions,
${integer(actions('rest'))} Rest actions, ${integer(actions('mood'))} Mood
actions, and ${integer(actions('bond'))} Bond actions. There were
${integer(sum(runs.map((run) => run.careBehavior.visitsWithNoCare)))} attended
visits with no care action and
${integer(sum(runs.map((run) => run.checks.retries)))} successful retry sessions.`;
}

function balanceAnswers(runs: Run[]) {
  const common = runs.filter((run) => run.archetype === 'common');
  const risky = runs.filter((run) => run.archetype === 'risky');
  const rescue = runs.filter((run) =>
    ['P69', 'P70', 'P71'].includes(run.profile),
  );
  const hospital = runs.filter((run) =>
    ['P84', 'P85', 'P87', 'P88', 'P90', 'P91'].includes(run.profile),
  );
  const nutrition = runs.filter((run) =>
    ['P76', 'P78', 'P79'].includes(run.profile),
  );
  return `1. **Max Health:** common-profile physical survival is ${percent(common.filter((run) => run.physicallyAlive).length / common.length)} and risky-profile physical survival is ${percent(risky.filter((run) => run.physicallyAlive).length / risky.length)}. This baseline alone does not authorize lowering Health; use the paired 30 HP run for causality.
2. **Recovery:** ${runs.filter((run) => run.physicallyAlive && run.healthProfile.totalRecovery >= 20).length} physically alive profiles recovered at least 20 Health cumulatively; inspect their minimum Health and critical-hours fields before attributing survival to the cap.
3. **Rescue strength:** ${rescue.filter((run) => run.reachedHorizon).length}/${rescue.length} rescue-stress profiles completed 60 days, with ${sum(rescue.map((run) => run.rescues.food + run.rescues.rest))} successful rescues.
4. **Positive autonomy:** P96/P97/P98 provide collector, room, and minimalist outcomes in the comparison table; autonomous Mood, injury, movement, and side-gig fields remain available per run.
5. **Hospital viability:** ${hospital.filter((run) => run.reachedHorizon).length}/${hospital.length} Hospital-oriented profiles completed 60 days and ended with $${integer(sum(hospital.map((run) => run.medical.remainingPrincipal)))} principal.
6. **Nutrition clarity:** ${nutrition.filter((run) => run.reachedHorizon).length}/${nutrition.length} informed profiles completed 60 days; compare their warnings, responses, crashes, and onsets with P74/P75/P77 in the result JSON.
7. **Career cost:** P92–P95 separate aggressive, healthy-only, early-grind, and late-grind policies; their table reports exact outcomes, target timing, audience, cash, and debt without treating audience failure as an ending.`;
}

function expandedPolicy(run: Run) {
  return run.policy as Extract<Run['policy'], { schedule: unknown }>;
}

function groupRuns(runs: Run[], key: (run: Run) => string) {
  const groups = new Map<string, Run[]>();
  for (const run of runs) {
    const label = key(run);
    groups.set(label, [...(groups.get(label) ?? []), run]);
  }
  return groups;
}
