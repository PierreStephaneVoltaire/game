import type { buildStudyResult } from './balance-study-results';
import { integer, number, signed, sum } from './balance-report-format';
import {
  damageTable,
  economyProfileTable,
  economyTotals,
  economyTotalsTable,
  eventTable,
  exceptionTable,
  followerTable,
  interpretation,
  lifeEventSchedulerTable,
  kidneyResponseTable,
  kidneyRunTable,
  kidneyTotals,
  milestoneTable,
  outcomeTable,
  profileSummaryTable,
  rescueBlockedTable,
  rescueTable,
  runEndingCountTable,
  statusTable,
  rotisserieChickenTable,
  survivalInterpretation,
} from './balance-report-sections';
import {
  financialPressureTable,
  lifeEventImpactTable,
} from './balance-financial-report';

type Result = ReturnType<typeof buildStudyResult>;

export function renderStudyReport(result: Result) {
  const runs = result.runs;
  const totalDays = sum(runs.map((run) => run.elapsedDays));
  const opportunityCount = sum(
    runs.map((run) => run.events.opportunities),
  );
  const kidney = kidneyTotals(runs);
  const economy = economyTotals(runs);
  return `# 60-Day Health, Career, Event, Nutrition, and Economy Diagnosis

Policy contract: canonical 50-run balance study v${result.study.policyVersion}

This report is generated from the real seeded engine. It contains 18 Casual,
12 Focused, 10 Optimal, and 10 exact 50%-neglect runs, stopped at an ending or 60
game-days. The complete validator-compatible ledger is in
[ECONOMY_EVENTS_BALANCE_RESULTS.json](./ECONOMY_EVENTS_BALANCE_RESULTS.json).

## Question and profile contract

Can goal-directed players stay alive while reaching approximately 250K
subscribers under Casual play, 500K under Focused play, and 1M under Optimal
play without making exact 50% neglect safe?

- Casual schedules 3–6 checks/day, responds at Food/Rest 4 and Mood 3, keeps a
  nine-food inventory reserve, seeks one Clipper stack, model progression, and
  Creativity 6.
- Focused schedules 4–6 checks/day, keeps ten food, seeks two Clipper stacks,
  model progression, and Creativity 8.
- Optimal checks every two hours, responds at Food/Rest 6 and Mood 4, keeps 16
  food, seeks three Clipper stacks, model progression, Creativity 9, and
  proactively manages nutrition risk.
- Neglect retains the Casual goals, skips every second scheduled visit, and
  buys food only when immediate care requires it instead of stockpiling.
- Kidney Stone responses rotate through unaware, instinctive hydration,
  symptom management, delayed Hospital, and immediate Hospital. Optimal uses
  informed prevention and treats critically only when necessary.

## Main result

${profileSummaryTable(runs)}

${survivalInterpretation(runs)}

### Run outcomes by cohort

${runEndingCountTable(runs)}

## Milestone timing

${milestoneTable(runs)}

## Subscriber sources and stream pressure

${followerTable(runs)}

Across all runs, ${integer(sum(runs.map((run) => run.streams.started)))} streams
started, ${integer(sum(runs.map((run) => run.streams.completed)))} completed,
${integer(sum(runs.map((run) => run.streams.interrupted)))} were interrupted,
and exact stream time was ${number(sum(runs.map((run) => run.streams.hours)), 2)}
hours. Audience ticks recorded
${integer(sum(runs.map((run) => run.audienceBoosts.fullValueContributions)))}
full-value boost contributions and
${integer(sum(runs.map((run) => run.audienceBoosts.discountedContributions)))}
discounted contributions; the largest active load was
${integer(Math.max(...runs.map((run) => run.audienceBoosts.maximumActiveLoad)))}.
The follower table separates natural growth, Clippers, donations, model rewards,
and any residual source; it does not infer growth from final totals.

## Physical survival, completion, statuses, and damage

${damageTable(runs)}

${statusTable(runs)}

Sugar Crash produced ${integer(sum(runs.map((run) => run.sugarCrash.crashes)))}
actual crashes after ${integer(sum(runs.map((run) => run.sugarCrash.warnings)))}
warnings; ${integer(sum(runs.map((run) => run.sugarCrash.averted)))} pending
crashes were averted. Recorded crash deltas total Mood
${signed(sum(runs.map((run) => run.sugarCrash.moodDamage)))} and Rest
${signed(sum(runs.map((run) => run.sugarCrash.restDamage)))}.

## Weighted events and direct impact

The study recorded ${integer(opportunityCount)} weighted opportunities across
${number(totalDays, 1)} run-days, or
${number(opportunityCount / totalDays, 2)} opportunities/day. Configured weight
is shown beside observed selection frequency and direct ledger impact; weights
are not unconditional probabilities because eligibility and cooldowns alter
the pool.

${eventTable(result)}

### VTuber-life event totals

${lifeEventImpactTable(runs)}

### Life-event scheduler counters

${lifeEventSchedulerTable(runs)}

### Seeded authored outcomes

${outcomeTable(runs)}

## Autonomous rescue

${rescueTable(runs)}

${rescueBlockedTable(runs)}

Food and Rest rescues remain separately locked. The Neglect row is the
important safety check: rescue frequency must be interpreted beside physical survival and completion,
not as evidence that autonomy can maintain a run indefinitely.

## Kidney Stone and Hospital response

The cohort recorded ${integer(kidney.feeds)} successful feeds, including
${integer(kidney.manualFeeds)} player-commanded feeds,
${integer(kidney.riskyFeeds)} qualifying risky feeds,
${integer(kidney.onsets)} onsets, and ${integer(kidney.recurrences)} recurrences.
${integer(kidney.runsWithStone)}/50 runs experienced an onset. Among completed
episodes, ${integer(kidney.naturalClears)} cleared naturally and
${integer(kidney.hospitalClears)} cleared through Hospital; ${integer(kidney.activeAtEnd)}
remained active at an ending or the horizon.

${kidneyResponseTable(runs)}

### Every affected run

${kidneyRunTable(runs)}

## Medical obligations and economy

The study created ${integer(kidney.bills)} medical bills, including
${integer(kidney.insuredBills)} insured bills, and finished with
$${integer(kidney.remainingPrincipal)} in explicit medical principal. It
processed ${integer(kidney.dailyPaymentEvents)} scheduled payment events and
${integer(kidney.fullPayments)} discounted full-payoff events.

${economyTotalsTable(economy)}

${economyProfileTable(runs)}

### Rotisserie Chicken exposure and outcomes

${rotisserieChickenTable(runs)}

### Debt and Line of Credit diagnostics

${financialPressureTable(runs)}

Every run satisfies \`starting cash + income - expenses = ending cash\`. Base
stream income is the exact residual because the engine has no standalone base
stream-pay event. Medical principal is separate from cash; only actual payments
are expenses.

## Per-run exceptions

${exceptionTable(runs)}

## Interpretation

${interpretation(runs, kidney, economy)}

## Method limits

- This is the maintained canonical policy, not a claim that it represents
  every human play style. Policy version changes require intentional review.
- Configured weights are reported with selections and direct impacts, but
  dynamic eligible-pool exposure is not yet persisted by the production event
  ledger.
- This baseline changes no production rules. Any counterfactual must be run as
  a separately labeled paired study with the same seeds and policy version.
- Financial Ruin used the production $20,000 total-debt threshold. The $15,000
  counterfactual was not executed and did not modify production data.
`;
}
