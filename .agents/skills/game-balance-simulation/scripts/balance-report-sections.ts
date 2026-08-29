import type { buildStudyResult } from './balance-study-results';
import {
  frequency,
  integer,
  median,
  mergeRecords,
  nullable,
  number,
  percent,
  signed,
  sum,
} from './balance-report-format';
import { formatRunOutcome } from './balance-ending-report';
export {
  profileSummaryTable,
  runEndingCountTable,
  survivalInterpretation,
} from './balance-ending-report';

type Result = ReturnType<typeof buildStudyResult>;
type Run = Result['runs'][number];

const PROFILE_ORDER = ['Casual', 'Focused', 'Optimal', 'Neglect'] as const;
const MILESTONES = ['1000', '10000', '100000', '250000', '500000', '1000000'];
export function milestoneTable(runs: Run[]) {
  const rows = PROFILE_ORDER.flatMap((profile) => {
    const group = runs.filter((run) => run.profile === profile);
    const counts = MILESTONES.map(
      (milestone) => group.filter((run) => run.milestoneDays[milestone] !== null).length,
    );
    const medians = MILESTONES.map((milestone) =>
      nullable(
        median(
          group.flatMap((run) =>
            run.milestoneDays[milestone] === null ? [] : [run.milestoneDays[milestone]!],
          ),
        ),
        (value) => number(value, 2),
      ),
    );
    return [
      `| ${profile}: runs reaching | ${counts.join(' | ')} |`,
      `| ${profile}: median day | ${medians.join(' | ')} |`,
    ];
  });
  return `| Profile | 1K | 10K | 100K | 250K | 500K | 1M |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}

export function followerTable(runs: Run[]) {
  const rows = PROFILE_ORDER.map((profile) => {
    const group = runs.filter((run) => run.profile === profile);
    return `| ${profile} | ${integer(sum(group.map((run) => run.followerSources.natural)))} | ${integer(sum(group.map((run) => run.followerSources.clippers)))} | ${integer(sum(group.map((run) => run.followerSources.donations)))} | ${integer(sum(group.map((run) => run.followerSources.models)))} | ${integer(sum(group.map((run) => run.followerSources.other)))} | ${nullable(median(group.flatMap((run) => run.audienceBoosts.medianActiveLoad === null ? [] : [run.audienceBoosts.medianActiveLoad])), (value) => number(value, 2))} |`;
  });
  return `| Profile | Natural growth | Clippers | Donation followers | Model rewards | Other | Median active boost load |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}

export function damageTable(runs: Run[]) {
  const totals = mergeRecords(runs.map((run) => run.healthDamage));
  const rawNeedTotals = mergeRecords(runs.map((run) => run.rawNeedDamage));
  const deaths = frequency(
    runs.flatMap((run) => run.ending?.causes?.map((cause) => cause.id) ?? []),
  );
  const sources = new Set([...Object.keys(totals), ...Object.keys(rawNeedTotals)]);
  const rows = [...sources]
    .map((source) => [source, totals[source] ?? 0] as const)
    .sort((left, right) => right[1] - left[1])
    .map(([source, amount]) => `| ${source} | ${integer(rawNeedTotals[source] ?? 0)} | ${integer(amount)} | ${deaths[source] ?? 0} |`);
  return `| Damage source | Raw need damage | Applied Health damage | Terminal cause appearances |
| --- | ---: | ---: | ---: |
${rows.join('\n')}`;
}

export function statusTable(runs: Run[]) {
  const totals = mergeRecords(runs.map((run) => run.statusHours));
  const rows = Object.entries(totals)
    .sort((left, right) => right[1] - left[1])
    .map(([status, hours]) => `| ${status} | ${number(hours, 2)} |`);
  return `| Status | Exposure hours |
| --- | ---: |
${rows.join('\n')}`;
}

export function eventTable(result: Result) {
  const runs = result.runs;
  const selections = mergeRecords(runs.map((run) => run.events.selections));
  const impacts = new Map<string, { metrics: Record<string, number>; money: number; followers: number }>();
  for (const run of runs)
    for (const [event, value] of Object.entries(run.events.impacts)) {
      const total = impacts.get(event) ?? { metrics: {}, money: 0, followers: 0 };
      total.metrics = mergeRecords([total.metrics, value.metrics]);
      total.money += value.money;
      total.followers += value.followers;
      impacts.set(event, total);
    }
  const configured = result.configured.eventWeights;
  const configuredLifeEvents = result.configured.lifeEventWeights;
  const weight = (event: string) => {
    const key = event.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
    return event.startsWith('life_event:')
      ? String(
          configuredLifeEvents[event.slice('life_event:'.length)] ??
            'Authored',
        )
      : event === 'stream'
      ? 'Dynamic'
      : String((configured as Record<string, number>)[key] ?? 'Authored/dynamic');
  };
  const opportunities = sum(runs.map((run) => run.events.opportunities));
  const rows = Object.entries(selections)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([event, selected]) => {
      const impact = impacts.get(event);
      const metricText = Object.entries(impact?.metrics ?? {})
        .filter(([, amount]) => amount !== 0)
        .map(([metric, amount]) => `${metric} ${signed(amount)}`)
        .join(', ');
      const direct = [
        metricText,
        impact?.money ? `$${signed(impact.money)}` : '',
        impact?.followers ? `${signed(impact.followers)} followers` : '',
      ]
        .filter(Boolean)
        .join('; ');
      return `| ${event} | ${weight(event)} | ${integer(selected)} | ${percent(selected / opportunities)} | ${direct || 'Narration/state only'} |`;
    });
  return `| Candidate | Configured weight | Selections | Share | Recorded direct impact |
| --- | ---: | ---: | ---: | --- |
${rows.join('\n')}`;
}

export function lifeEventSchedulerTable(runs: Run[]) {
  const successful = mergeRecords(
    runs.map((run) => run.lifeEventScheduler.successfulRolls),
  );
  const rows = Object.entries(successful)
    .sort((left, right) => right[1] - left[1])
    .map(([event, count]) => `| ${event} | ${integer(count)} |`);
  return `| Scheduler diagnostic | Total |
| --- | ---: |
| 30-minute boundaries processed | ${integer(sum(runs.map((run) => run.lifeEventScheduler.boundariesProcessed)))} |
| Multi-success boundaries | ${integer(sum(runs.map((run) => run.lifeEventScheduler.multiSuccessBoundaries)))} |
| Suppressed repeat Agency rolls | ${integer(sum(runs.map((run) => run.lifeEventScheduler.suppressedAgencyInvitations)))} |

| Successful life-event roll | Count |
| --- | ---: |
${rows.join('\n') || '| None | 0 |'}`;
}

export function rotisserieChickenTable(runs: Run[]) {
  const total = (field: keyof Run['rotisserieChicken']) =>
    sum(runs.map((run) => run.rotisserieChicken[field] as number));
  return `| Rotisserie Chicken diagnostic | Total |
| --- | ---: |
| Runs with a Shop appearance | ${runs.filter((run) => run.rotisserieChicken.shopAppearances > 0).length} |
| Runs with a purchase | ${runs.filter((run) => run.rotisserieChicken.purchases > 0).length} |
| Shop appearances | ${integer(total('shopAppearances'))} |
| Purchase events | ${integer(total('purchaseEvents'))} |
| Purchased units | ${integer(total('purchases'))} |
| Manual uses | ${integer(total('manualUses'))} |
| Automatic stream-snack uses | ${integer(total('automaticUses'))} |
| Attributed Health damage | ${integer(total('healthDamage'))} |
| Lethal uses | ${integer(total('lethalUses'))} |
| Deaths within 24 hours of any use (correlation) | ${integer(total('deathWithin24Hours'))} |`;
}

export function rescueTable(runs: Run[]) {
  const rows = PROFILE_ORDER.map((profile) => {
    const group = runs.filter((run) => run.profile === profile);
    return `| ${profile} | ${sum(group.map((run) => run.rescues.food))} | ${sum(group.map((run) => run.rescues.rest))} | ${sum(group.map((run) => sum(Object.values(run.rescues.blockedReasons))))} | ${group.filter((run) => run.physicallyAlive).length}/${group.length} | ${group.filter((run) => run.reachedHorizon).length}/${group.length} |`;
  });
  return `| Profile | Food rescues | Rest rescues | Blocked attempts | Physically alive | 60-day completion |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}

export function rescueBlockedTable(runs: Run[]) {
  const reasons = mergeRecords(runs.map((run) => run.rescues.blockedReasons));
  const rows = Object.entries(reasons)
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => `| ${reason} | ${integer(count)} |`);
  return `| Rescue block reason | Count |
| --- | ---: |
${rows.join('\n') || '| None recorded | 0 |'}`;
}

export function outcomeTable(runs: Run[]) {
  const outcomes = mergeRecords(runs.map((run) => run.events.selectedOutcomeIds));
  const rows = Object.entries(outcomes)
    .sort((left, right) => right[1] - left[1])
    .map(([outcome, count]) => `| ${outcome} | ${integer(count)} |`);
  return `| Outcome ID | Selections |
| --- | ---: |
${rows.join('\n') || '| None recorded | 0 |'}`;
}

export function kidneyTotals(runs: Run[]) {
  return {
    feeds: sum(runs.map((run) => run.kidneyStone.successfulFeeds)),
    manualFeeds: sum(runs.map((run) => run.kidneyStone.manualFeeds)),
    riskyFeeds: sum(runs.map((run) => run.kidneyStone.riskyFeeds)),
    onsets: sum(runs.map((run) => run.kidneyStone.onsets)),
    recurrences: sum(runs.map((run) => run.kidneyStone.recurrences)),
    naturalClears: sum(runs.map((run) => run.kidneyStone.naturalClears)),
    hospitalClears: sum(runs.map((run) => run.kidneyStone.hospitalClears)),
    activeAtEnd: sum(runs.map((run) => run.kidneyStone.activeAtEnd)),
    runsWithStone: runs.filter((run) => run.kidneyStone.onsets > 0).length,
    bills: sum(runs.map((run) => run.medical.bills)),
    insuredBills: sum(runs.map((run) => run.medical.insuredBills)),
    dailyPaymentEvents: sum(runs.map((run) => run.medical.dailyPaymentEvents)),
    fullPayments: sum(runs.map((run) => run.medical.fullPayments)),
    remainingPrincipal: sum(runs.map((run) => run.medical.remainingPrincipal)),
  };
}

export function kidneyResponseTable(runs: Run[]) {
  const modes = [...new Set(runs.map((run) => run.responseMode))];
  const rows = modes.map((mode) => {
    const group = runs.filter((run) => run.responseMode === mode);
    return `| ${mode} | ${group.length} | ${group.filter((run) => run.kidneyStone.onsets > 0).length} | ${sum(group.map((run) => run.kidneyStone.onsets))} | ${sum(group.map((run) => run.kidneyStone.recurrences))} | ${sum(group.map((run) => run.kidneyStone.naturalClears))} | ${sum(group.map((run) => run.kidneyStone.hospitalClears))} | ${group.filter((run) => run.physicallyAlive).length} | ${group.filter((run) => run.reachedHorizon).length} | $${integer(sum(group.map((run) => run.economy.expenses.hospital)))} |`;
  });
  return `| Response | Runs | Runs with stone | Onsets | Recurrences | Natural clears | Hospital clears | Physically alive | 60-day completion | Medical payments |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}

export function kidneyRunTable(runs: Run[]) {
  const rows = runs
    .filter((run) => run.kidneyStone.onsets > 0)
    .map(
      (run) =>
        `| ${run.id} | ${run.responseMode} | ${run.kidneyStone.onsets} | ${run.kidneyStone.recurrences} | ${run.kidneyStone.naturalClears} | ${run.kidneyStone.hospitalClears} | $${integer(run.economy.expenses.hospital)} | $${integer(run.medical.remainingPrincipal)} | ${formatRunOutcome(run)} |`,
    );
  return `| Run | Response | Onsets | Recurrences | Natural clears | Hospital clears | Payments | Principal | Outcome |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows.join('\n') || '| — | — | 0 | 0 | 0 | 0 | $0 | $0 | No affected runs |'}`;
}

export function economyTotals(runs: Run[]) {
  const income = mergeRecords(runs.map((run) => run.economy.income));
  const expenses = mergeRecords(runs.map((run) => run.economy.expenses));
  return {
    income,
    expenses,
    starting: sum(runs.map((run) => run.economy.startingBalance)),
    ending: sum(runs.map((run) => run.economy.endingBalance)),
  };
}

export function economyTotalsTable(totals: ReturnType<typeof economyTotals>) {
  const rows = [
    ...Object.entries(totals.income).map(([source, amount]) => `| Income: ${source} | $${integer(amount)} |`),
    ...Object.entries(totals.expenses).map(([source, amount]) => `| Expense: ${source} | −$${integer(amount)} |`),
    `| Combined starting cash | $${integer(totals.starting)} |`,
    `| Combined ending cash | $${integer(totals.ending)} |`,
  ];
  return `| Source | Total |
| --- | ---: |
${rows.join('\n')}`;
}

export function economyProfileTable(runs: Run[]) {
  const rows = PROFILE_ORDER.map((profile) => {
    const group = runs.filter((run) => run.profile === profile);
    return `| ${profile} | $${integer(median(group.map((run) => run.economy.endingBalance)))} | $${integer(median(group.map((run) => sum(Object.values(run.economy.income)))))} | $${integer(sum(group.map((run) => run.economy.expenses.shop)))} | $${integer(sum(group.map((run) => run.economy.expenses.hospital)))} | $${integer(sum(group.map((run) => run.medical.remainingPrincipal)))} | ${sum(group.map((run) => run.rejectedPurchases))} |`;
  });
  return `| Profile | Median ending cash | Median income | Shop spending | Medical payments | Remaining principal | Rejected purchases |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`;
}

export function exceptionTable(runs: Run[]) {
  const exceptions = runs.filter(
    (run) => !run.reachedHorizon || run.targetDay === null || run.medical.remainingPrincipal > 0,
  );
  const rows = exceptions.map(
    (run) =>
      `| ${run.id} | ${formatRunOutcome(run)} | ${integer(run.subscribers)} | ${run.targetDay === null ? 'Missed' : `d${number(run.targetDay, 2)}`} | ${run.kidneyStone.onsets} | ${run.medical.bills} | $${integer(run.medical.remainingPrincipal)} |`,
  );
  return `| Run | Outcome | Subscribers | Target | Stone onsets | Bills | Principal |
| --- | --- | ---: | --- | ---: | ---: | ---: |
${rows.join('\n') || '| — | No exceptions | 0 | — | 0 | 0 | $0 |'}`;
}

export function interpretation(
  runs: Run[],
  kidney: ReturnType<typeof kidneyTotals>,
  economy: ReturnType<typeof economyTotals>,
) {
  const optimal = runs.filter((run) => run.profile === 'Optimal');
  const focused = runs.filter((run) => run.profile === 'Focused');
  const neglect = runs.filter((run) => run.profile === 'Neglect');
  const medicalShare =
    (economy.expenses.hospital ?? 0) / sum(Object.values(economy.income));
  return `1. **Ending separation:** ${neglect.filter((run) => run.physicallyAlive).length}/${neglect.length}
   Neglect runs remain physically alive and ${neglect.filter((run) => run.reachedHorizon).length}/${neglect.length}
   complete 60 days, versus ${runs.filter((run) => run.profile !== 'Neglect' && run.physicallyAlive).length}/40
   physically alive and ${runs.filter((run) => run.profile !== 'Neglect' && run.reachedHorizon).length}/40 completed managed runs.
2. **Progression consistency:** ${focused.filter((run) => run.targetDay !== null).length}/${focused.length}
   Focused runs and ${optimal.filter((run) => run.targetDay !== null).length}/${optimal.length}
   Optimal runs hit their targets. Compare survivor medians and boost loads
   before changing a global audience rate.
3. **Condition pressure:** ${kidney.runsWithStone}/50 runs develop Kidney Stone.
   The response table and affected-run appendix show whether Hospital,
   hydration, or waiting explains physical survival and repeat treatment.
4. **Medical economy:** actual medical payments consume ${percent(medicalShare)}
   of recorded income while $${integer(kidney.remainingPrincipal)} remains.
   Principal and cash are separate, so a nonnegative balance is not evidence of
   affordable care.
5. **Counterfactual boundary:** this report contains diagnosis only. Test one
   coherent lever family with paired seeds before recommending production
   numbers.`;
}
