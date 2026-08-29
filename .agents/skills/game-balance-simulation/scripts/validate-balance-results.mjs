#!/usr/bin/env node
/* global process */
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) fail('usage: validate-balance-results.mjs <results.json|->');
const input =
  path === '-' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8');
let document;
try {
  document = JSON.parse(input);
} catch (error) {
  fail(`invalid JSON: ${error.message}`);
}

const errors = [];
const outcomes = new Set([
  'horizon',
  'death',
  'quit_streaming',
  'financial_ruin',
]);
if (document?.study?.engine !== 'real')
  errors.push('study.engine must be "real"');
if (!(document?.study?.horizonDays > 0))
  errors.push('study.horizonDays must be positive');
if (!Array.isArray(document?.runs) || document.runs.length === 0)
  errors.push('runs must be a non-empty array');
const runIds = (document.runs ?? []).map((run) => run.id);
if (new Set(runIds).size !== runIds.length)
  errors.push('runs must have unique ids');

for (const [index, run] of (document.runs ?? []).entries()) {
  const label = run.id ?? `runs[${index}]`;
  for (const field of ['id', 'profile', 'seed'])
    if (typeof run[field] !== 'string' || !run[field])
      errors.push(`${label}.${field} is required`);
  for (const field of ['elapsedDays', 'subscribers', 'peakSubscribers'])
    if (!Number.isFinite(run[field]))
      errors.push(`${label}.${field} must be numeric`);
  if ('survived' in run)
    errors.push(`${label}.survived is ambiguous and must be removed`);
  if (!outcomes.has(run.outcome))
    errors.push(`${label}.outcome must be a recognized ending or horizon`);
  if (typeof run.reachedHorizon !== 'boolean')
    errors.push(`${label}.reachedHorizon must be boolean`);
  if (typeof run.physicallyAlive !== 'boolean')
    errors.push(`${label}.physicallyAlive must be boolean`);
  if (typeof run.madeItUnlocked !== 'boolean')
    errors.push(`${label}.madeItUnlocked must be boolean`);
  if (run.physicallyAlive !== (run.outcome !== 'death'))
    errors.push(`${label}.physicallyAlive disagrees with outcome`);
  if (run.outcome === 'horizon') {
    if (run.ending !== null)
      errors.push(`${label}.ending must be null at the horizon`);
    if (!run.reachedHorizon)
      errors.push(`${label}.reachedHorizon must be true for horizon outcome`);
  } else {
    if (run.ending?.kind !== run.outcome)
      errors.push(`${label}.ending.kind must match outcome`);
    if (run.reachedHorizon)
      errors.push(`${label}.reachedHorizon must be false after an ending`);
  }
  requireNumbers(errors, `${label}.streams`, run.streams, [
    'started',
    'completed',
    'interrupted',
    'hours',
  ]);
  requireNumbers(errors, `${label}.checks`, run.checks, [
    'scheduled',
    'attended',
    'busy',
    'skipped',
    'retries',
  ]);
  if (!Array.isArray(run.kidneyStoneEpisodes))
    errors.push(`${label}.kidneyStoneEpisodes must be an array`);
  if (!run.events || !Number.isFinite(run.events.opportunities))
    errors.push(`${label}.events.opportunities must be numeric`);
  if (!run.statusHours || !run.healthDamage)
    errors.push(`${label} must capture statusHours and healthDamage`);
  if (!run.financial || !run.lifeEvents)
    errors.push(`${label} must capture financial and life-event diagnostics`);
  if (!run.lifeEventScheduler)
    errors.push(`${label} must capture life-event scheduler counters`);
  else
    requireNumbers(errors, `${label}.lifeEventScheduler`, run.lifeEventScheduler, [
      'boundariesProcessed',
      'suppressedAgencyInvitations',
      'multiSuccessBoundaries',
    ]);
  if (!run.lifeEvents?.impacts)
    errors.push(`${label} must capture per-life-event impacts`);
  if (!run.rotisserieChicken)
    errors.push(`${label} must capture Rotisserie Chicken diagnostics`);
  else
    requireNumbers(errors, `${label}.rotisserieChicken`, run.rotisserieChicken, [
      'shopAppearances',
      'purchaseEvents',
      'purchases',
      'manualUses',
      'automaticUses',
      'healthDamage',
      'lethalUses',
      'deathWithin24Hours',
    ]);
  if (run.rotisserieChicken) {
    if (run.rotisserieChicken.purchases > 1)
      errors.push(`${label}.rotisserieChicken.purchases must be at most 1`);
    if (
      run.rotisserieChicken.manualUses + run.rotisserieChicken.automaticUses >
      1
    )
      errors.push(
        `${label}.rotisserieChicken manual and automatic uses must total at most 1`,
      );
    if (
      run.rotisserieChicken.healthDamage < 0 ||
      run.rotisserieChicken.healthDamage > 8
    )
      errors.push(
        `${label}.rotisserieChicken.healthDamage must be between 0 and 8`,
      );
  }
  if (run.studyGroup === 'heterogeneous') {
    if (!run.healthProfile || !run.careBehavior)
      errors.push(
        `${label} must capture heterogeneous health and care behavior`,
      );
    if (!run.nutritionBehavior || !run.economyBehavior || !run.autonomousLife)
      errors.push(
        `${label} must capture heterogeneous nutrition, economy, and autonomy behavior`,
      );
    if (!run.rescues?.followup)
      errors.push(`${label} must capture rescue follow-up behavior`);
    if (!Array.isArray(run.overlays))
      errors.push(`${label}.overlays must be an array`);
  }

  const economy = run.economy;
  requireNumbers(errors, `${label}.economy`, economy, [
    'startingBalance',
    'endingBalance',
    'maximumDebt',
    'hoursInDebt',
  ]);
  if (!economy?.income || !economy?.expenses) {
    errors.push(`${label}.economy must contain income and expenses`);
    continue;
  }
  if ('cumulativeOpenCharges' in (run.financial?.lineOfCredit ?? {}))
    errors.push(`${label}.financial.lineOfCredit must not report LOC open charges`);
  const income = sumNumeric(errors, `${label}.economy.income`, economy.income);
  const expenses = sumNumeric(
    errors,
    `${label}.economy.expenses`,
    economy.expenses,
  );
  const expected = economy.startingBalance + income - expenses;
  if (
    Number.isFinite(expected) &&
    Math.abs(expected - economy.endingBalance) > 0.01
  )
    errors.push(
      `${label}.economy does not reconcile: expected ${expected}, got ${economy.endingBalance}`,
    );
}

if (errors.length) fail(errors.join('\n'));
console.log(
  `validated ${document.runs.length} balance runs with reconciled economy`,
);

function requireNumbers(errors, label, value, fields) {
  if (!value) {
    errors.push(`${label} is missing a required object`);
    return;
  }
  for (const field of fields)
    if (!Number.isFinite(value[field]))
      errors.push(`${label}.${field} must be numeric`);
}

function sumNumeric(errors, label, values) {
  let sum = 0;
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) errors.push(`${label}.${key} must be numeric`);
    else sum += value;
  }
  return sum;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
