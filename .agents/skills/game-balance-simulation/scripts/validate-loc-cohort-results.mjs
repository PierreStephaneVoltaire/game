#!/usr/bin/env node
/* global process */
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'docs/LOC_BALANCE_RESULTS.json';
const partial = process.argv.includes('--partial');
const document = JSON.parse(readFileSync(path, 'utf8'));
const errors = [];
if (document?.study?.engine !== 'real') errors.push('study.engine must be real');
const expected = partial ? 25 : 400;
if (!Array.isArray(document?.runs) || document.runs.length !== expected)
  errors.push(`runs must contain exactly ${expected} entries`);
if (!partial && document?.study?.batchCount !== 16)
  errors.push('study.batchCount must be exactly 16');
if (!partial && document?.study?.batchSize !== 25)
  errors.push('study.batchSize must be exactly 25');
const ids = (document.runs ?? []).map((run) => run.id);
if (new Set(ids).size !== ids.length) errors.push('runs must have unique IDs');
const cohorts = new Set((document.runs ?? []).map((run) => run.label));
if (!partial && cohorts.size !== 4) errors.push('runs must contain four LOC cohorts');
if (!partial) {
  const expectedQuestion =
    'How do the four controlled line-of-credit cohorts affect survival, debt repayment, target attainment, and Financial Ruin over 60 game-days?';
  if (document.study?.question !== expectedQuestion)
    errors.push('study.question must be the LOC-specific cohort question');
  if (!document.cohortSummaries || typeof document.cohortSummaries !== 'object')
    errors.push('cohortSummaries must be present');
  else {
    for (const label of cohorts) {
      const summary = document.cohortSummaries[label];
      if (!summary) {
        errors.push(`cohortSummaries.${label} is required`);
        continue;
      }
      validateCohortSummary(errors, label, summary);
    }
    if (Object.keys(document.cohortSummaries).length !== cohorts.size)
      errors.push('cohortSummaries must contain exactly the four run cohorts');
  }
  const configuredCohorts = document.configured?.cohort;
  if (!configuredCohorts || typeof configuredCohorts !== 'object')
    errors.push('configured.cohort is required');
  else
    for (const label of cohorts)
      if (configuredCohorts[label] !== document.cohortSummaries?.[label]?.runCount)
        errors.push(`configured.cohort.${label} must match its run count`);
}
for (const [index, run] of (document.runs ?? []).entries()) {
  if (!run.financial || !run.economy)
    errors.push(`runs[${index}] must contain financial and economy diagnostics`);
  if (run.financial?.lineOfCredit?.cumulativeOpenCharges !== undefined)
    errors.push(`runs[${index}] must not contain LOC open-charge diagnostics`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`validated ${document.runs.length} LOC cohort runs`);

function validateCohortSummary(errors, label, summary) {
  if (summary.runCount !== 100)
    errors.push(`cohortSummaries.${label}.runCount must be 100`);
  if (!summary.outcomeCounts || typeof summary.outcomeCounts !== 'object')
    errors.push(`cohortSummaries.${label}.outcomeCounts is required`);
  else {
    const outcomeTotal = Object.values(summary.outcomeCounts).reduce(
      (total, count) => total + count,
      0,
    );
    if (outcomeTotal !== summary.runCount)
      errors.push(`cohortSummaries.${label}.outcomeCounts must sum to runCount`);
  }
  for (const field of ['medianPeakDebt', 'maximumPeakDebt'])
    if (!Number.isFinite(summary[field]))
      errors.push(`cohortSummaries.${label}.${field} must be numeric`);
  if (summary.medianEndingDay !== null && !Number.isFinite(summary.medianEndingDay))
    errors.push(`cohortSummaries.${label}.medianEndingDay must be numeric or null`);
  const loc = summary.lineOfCredit;
  if (!loc || typeof loc !== 'object')
    errors.push(`cohortSummaries.${label}.lineOfCredit is required`);
  else {
    for (const field of [
      'opened',
      'closed',
      'repaymentUnitsPurchased',
      'remainingClosureCost',
    ])
      if (!Number.isFinite(loc[field]))
        errors.push(`cohortSummaries.${label}.lineOfCredit.${field} must be numeric`);
  }
  const target = summary.targetAttainment;
  if (!target || !Number.isInteger(target.count) || !Number.isFinite(target.rate))
    errors.push(`cohortSummaries.${label}.targetAttainment is required`);
  else if (target.rate !== target.count / summary.runCount)
    errors.push(`cohortSummaries.${label}.targetAttainment.rate is inconsistent`);
  if (!Number.isInteger(summary.madeItCount))
    errors.push(`cohortSummaries.${label}.madeItCount must be an integer`);
  if (
    !summary.financialRuinTriggerCauses ||
    typeof summary.financialRuinTriggerCauses !== 'object'
  )
    errors.push(`cohortSummaries.${label}.financialRuinTriggerCauses is required`);
  else if (
    Object.values(summary.financialRuinTriggerCauses).reduce(
      (total, count) => total + count,
      0,
    ) !== summary.outcomeCounts?.financial_ruin
  )
    errors.push(
      `cohortSummaries.${label}.financialRuinTriggerCauses must match Financial Ruin outcomes`,
    );
}
