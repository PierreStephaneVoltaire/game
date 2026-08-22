import type { ItemDefinition } from './game-definition';

export const NUTRIENT_FIELDS = [
  'calories',
  'sodiumMg',
  'sugarG',
  'proteinG',
  'waterG',
  'caffeineMg',
] as const;
const SCORE_NAMES = ['salt', 'water', 'protein', 'sugar', 'caffeine'] as const;
const SOURCE_TYPES = new Set([
  'manufacturer_label',
  'usda_foundation',
  'usda_fndds',
  'fictional_seeded_profile',
  'not_applicable',
]);
const GENERIC_SOURCE_URLS = new Set([
  'https://fdc.nal.usda.gov/download-datasets/',
  'https://fdc.nal.usda.gov/data-documentation/',
  'https://www.fda.gov/food/nutrition-facts-label/nutrition-facts-label',
]);
const QUALIFIERS = new Set(['less_than', 'approximately']);
const COMPLETE_SOURCE_TYPE_COUNTS = {
  manufacturer_label: 6,
  usda_foundation: 35,
  usda_fndds: 65,
  fictional_seeded_profile: 1,
  not_applicable: 109,
} as const;

function validateScores(
  scores: Record<string, number> | undefined,
  label: string,
): string[] {
  if (!scores) return [`${label} must contain all 0–3 nutrition scores`];
  const issues: string[] = [];
  for (const name of SCORE_NAMES)
    if (!(name in scores)) issues.push(`${label} missing: ${name}`);
  for (const [name, score] of Object.entries(scores)) {
    if (!(SCORE_NAMES as readonly string[]).includes(name))
      issues.push(`${label} has unknown score: ${name}`);
    if (!Number.isInteger(score) || score < 0 || score > 3)
      issues.push(`${label} outside 0 through 3: ${name}`);
  }
  return issues;
}

function validateFictionalProfiles(
  nutrition: NonNullable<ItemDefinition['nutrition']>,
): string[] {
  const issues: string[] = [];
  const profiles = nutrition.fictionalProfiles ?? [];
  if (
    profiles.length !== 3 ||
    [...profiles.map((profile) => profile.id)].sort().join(',') !== 'A,B,C'
  )
    issues.push('fictional nutrition must define exactly profiles A, B, and C');
  for (const profile of profiles) {
    if (!profile.serving.trim())
      issues.push(`fictional profile ${profile.id} needs a serving`);
    for (const field of NUTRIENT_FIELDS)
      if (!Number.isFinite(profile[field]) || profile[field] < 0)
        issues.push(
          `fictional profile ${profile.id} has invalid nutrient: ${field}`,
        );
    issues.push(
      ...validateScores(
        profile.nutritionScores,
        `fictional profile ${profile.id} nutrition score`,
      ),
    );
  }
  const distinctProfiles = new Set(
    profiles.map((profile) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(profile).filter(([field]) => field !== 'id'),
        ),
      ),
    ),
  );
  if (profiles.length === 3 && distinctProfiles.size !== 3)
    issues.push('fictional nutrition profiles must be materially distinct');
  for (const field of NUTRIENT_FIELDS)
    if (nutrition[field] !== null)
      issues.push(`fictional top-level nutrient must be null: ${field}`);
  return issues;
}

export function validateItemNutrition(item: ItemDefinition): string[] {
  const nutrition = item.nutrition;
  if (!nutrition) return ['nutrition provenance record missing'];
  const issues: string[] = [];
  for (const field of [
    'serving',
    ...NUTRIENT_FIELDS,
    'sourceType',
    'sourceUrl',
  ])
    if (!(field in nutrition)) issues.push(`nutrition field missing: ${field}`);
  if (!nutrition.serving?.trim()) issues.push('nutrition serving is empty');
  if (!SOURCE_TYPES.has(nutrition.sourceType))
    issues.push(`unknown nutrition source type: ${nutrition.sourceType}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nutrition.retrievalDate ?? ''))
    issues.push('nutrition retrieval date must be an ISO calendar date');

  const requiredSnapshot =
    nutrition.sourceType === 'usda_foundation'
      ? '2026-04-30'
      : nutrition.sourceType === 'usda_fndds'
        ? '2024-10-31'
        : null;
  if (requiredSnapshot && nutrition.snapshotDate !== requiredSnapshot)
    issues.push(
      `${nutrition.sourceType} must use snapshot ${requiredSnapshot}`,
    );
  if (!requiredSnapshot && nutrition.snapshotDate !== undefined)
    issues.push(`${nutrition.sourceType} must not invent a snapshot date`);

  if (
    !['not_applicable', 'fictional_seeded_profile'].includes(
      nutrition.sourceType,
    ) &&
    (GENERIC_SOURCE_URLS.has(nutrition.sourceUrl ?? '') ||
      !nutrition.sourceReference ||
      /representative as-consumed or labeled serving|recorded against the april 2026 nutrition snapshot/i.test(
        nutrition.sourceReference,
      ))
  )
    issues.push('nutrition provenance must identify an exact source record');
  if (
    ['usda_foundation', 'usda_fndds'].includes(nutrition.sourceType) &&
    !/\bFDC ID \d+\b/.test(nutrition.sourceReference ?? '')
  )
    issues.push('USDA provenance must include an exact FDC ID');
  if (['usda_foundation', 'usda_fndds'].includes(nutrition.sourceType)) {
    const referenceId =
      nutrition.sourceReference?.match(/\bFDC ID (\d+)\b/)?.[1];
    let sourceId: string | undefined;
    try {
      const sourceUrl = new URL(nutrition.sourceUrl ?? '');
      sourceId = sourceUrl.pathname.match(/\/food-details\/(\d+)(?:\/|$)/)?.[1];
      if (
        sourceUrl.protocol !== 'https:' ||
        sourceUrl.hostname !== 'fdc.nal.usda.gov'
      )
        issues.push(
          'USDA source URL must use the official FoodData Central host',
        );
    } catch {
      issues.push('USDA source URL must be a valid primary-source URL');
    }
    if (referenceId && sourceId !== referenceId)
      issues.push('USDA source URL must match its referenced FDC ID');
  }
  if (
    ['manufacturer_label', 'usda_foundation', 'usda_fndds'].includes(
      nutrition.sourceType,
    ) &&
    !nutrition.sourceUrl
  )
    issues.push('sourced nutrition needs a primary source URL');

  for (const field of NUTRIENT_FIELDS) {
    const value = nutrition[field];
    if (value !== null && (!Number.isFinite(value) || value < 0))
      issues.push(`nutrition value must be non-negative or null: ${field}`);
    if (value === null && !nutrition.nullReasons?.[field])
      issues.push(`null nutrition value needs a reason: ${field}`);
  }
  for (const [field, qualifier] of Object.entries(nutrition.qualifiers ?? {})) {
    if (!(NUTRIENT_FIELDS as readonly string[]).includes(field))
      issues.push(`unknown nutrition qualifier field: ${field}`);
    if (!QUALIFIERS.has(qualifier))
      issues.push(`unknown nutrition qualifier: ${qualifier}`);
    if (nutrition[field as keyof typeof nutrition] === null)
      issues.push(`nutrition qualifier requires a numeric value: ${field}`);
  }

  if (nutrition.sourceType === 'fictional_seeded_profile') {
    if (item.id !== 'mystery-snack')
      issues.push('fictional seeded nutrition is restricted to Mystery Snack');
    if (item.nutritionScores)
      issues.push(
        'fictional seeded item must not carry fixed nutrition scores',
      );
    issues.push(...validateFictionalProfiles(nutrition));
  } else {
    issues.push(...validateScores(item.nutritionScores, 'nutrition score'));
    if (nutrition.fictionalProfiles)
      issues.push('non-fictional nutrition must not define fictional profiles');
  }
  if (nutrition.sourceType === 'not_applicable')
    for (const field of NUTRIENT_FIELDS)
      if (nutrition[field] !== null)
        issues.push(`not-applicable nutrient must be null: ${field}`);
  if (
    nutrition.sourceType === 'not_applicable' &&
    (item.edible || item.category === 'food') &&
    item.id !== 'acai-bowl'
  )
    issues.push('not-applicable food nutrition is restricted to Açaí Bowl');
  if (item.id === 'acai-bowl' && nutrition.sourceType !== 'not_applicable')
    issues.push('Açaí Bowl must retain its explicit unavailable-source record');
  if (
    item.id === 'mystery-snack' &&
    nutrition.sourceType !== 'fictional_seeded_profile'
  )
    issues.push('Mystery Snack must use seeded fictional nutrition profiles');

  return issues;
}

export function validateNutritionSourceMix(items: ItemDefinition[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const sourceType = item.nutrition?.sourceType ?? 'missing';
    counts.set(sourceType, (counts.get(sourceType) ?? 0) + 1);
  }
  return Object.entries(COMPLETE_SOURCE_TYPE_COUNTS).flatMap(
    ([sourceType, expected]) => {
      const found = counts.get(sourceType) ?? 0;
      return found === expected
        ? []
        : [
            `expected ${expected} ${sourceType} nutrition records, found ${found}`,
          ];
    },
  );
}
