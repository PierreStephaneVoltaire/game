/* eslint-disable no-undef */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const SOURCE_FILES = [
  'src/lib/data/catalogue/food-items.jsonl',
  'src/lib/data/catalogue/non-food-items.jsonl',
];
const NUTRITION_FILE = 'src/lib/data/catalogue/food-nutrition.jsonl';
const CANONICAL_IDS_FILE = 'src/lib/data/catalogue/canonical-item-ids.json';
const OUTPUT_FILE = 'src/lib/data/shop-items.json';
const NUTRIENT_FIELDS = [
  'calories',
  'sodiumMg',
  'sugarG',
  'proteinG',
  'waterG',
  'caffeineMg',
];

function readJsonLines(relativePath) {
  const source = readFileSync(new URL(relativePath, ROOT), 'utf8').trim();
  return source ? source.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, ROOT), 'utf8'));
}

function assertUniqueIds(records, label) {
  const ids = new Set();
  for (const record of records) {
    if (!record.id) throw new Error(`${label} record is missing an id`);
    if (ids.has(record.id))
      throw new Error(`${label} contains duplicate id ${record.id}`);
    ids.add(record.id);
  }
}

function notApplicableNutrition(item) {
  const reason = 'Not applicable to a non-food catalogue item.';
  return {
    serving: 'Not applicable',
    calories: null,
    sodiumMg: null,
    sugarG: null,
    proteinG: null,
    waterG: null,
    caffeineMg: null,
    sourceType: 'not_applicable',
    sourceUrl: null,
    sourceReference: `Not applicable: ${item.name} is a non-food catalogue item.`,
    retrievalDate: '2026-08-22',
    nullReasons: Object.fromEntries(
      NUTRIENT_FIELDS.map((field) => [field, reason]),
    ),
  };
}

const canonicalIds = readJson(CANONICAL_IDS_FILE);
const unorderedItemSources = SOURCE_FILES.flatMap(readJsonLines);
const nutritionSources = readJsonLines(NUTRITION_FILE);
assertUniqueIds(unorderedItemSources, 'Catalogue source');
assertUniqueIds(nutritionSources, 'Nutrition source');

if (
  canonicalIds.length !== 216 ||
  new Set(canonicalIds).size !== canonicalIds.length
)
  throw new Error('Canonical item ID allowlist must contain 216 unique IDs');
if (unorderedItemSources.length !== 216)
  throw new Error(
    `Expected 216 catalogue source records, found ${unorderedItemSources.length}`,
  );
if (nutritionSources.length !== 108)
  throw new Error(
    `Expected 108 nutrition source records, found ${nutritionSources.length}`,
  );

const nutritionById = new Map(
  nutritionSources.map((nutrition) => [nutrition.id, nutrition]),
);
const sourceById = new Map(
  unorderedItemSources.map((source) => [source.id, source]),
);
const unexpectedIds = [...sourceById.keys()].filter(
  (id) => !canonicalIds.includes(id),
);
const missingIds = canonicalIds.filter((id) => !sourceById.has(id));
if (missingIds.length || unexpectedIds.length)
  throw new Error(
    `Catalogue source IDs differ from canonical allowlist (missing: ${missingIds.join(', ') || 'none'}; unexpected: ${unexpectedIds.join(', ') || 'none'})`,
  );
const itemSources = canonicalIds.map((id) => sourceById.get(id));
const items = itemSources.map((source) => {
  const nutrition = nutritionById.get(source.id);
  const expectsSourcedNutrition =
    source.category === 'food' || source.id === 'salt-tablet';
  if (expectsSourcedNutrition && !nutrition)
    throw new Error(`Missing sourced nutrition for ${source.id}`);
  if (!expectsSourcedNutrition && nutrition)
    throw new Error(`Unexpected sourced nutrition for ${source.id}`);
  if (nutrition) nutritionById.delete(source.id);
  return {
    ...source,
    image: `/items/generated/${source.id}.png`,
    nutrition: nutrition
      ? Object.fromEntries(
          Object.entries(nutrition).filter(([key]) => key !== 'id'),
        )
      : notApplicableNutrition(source),
  };
});
if (nutritionById.size)
  throw new Error(
    `Nutrition records do not match catalogue ids: ${[...nutritionById.keys()].join(', ')}`,
  );

const output = `${JSON.stringify(items, null, 2)}\n`;
const outputUrl = new URL(OUTPUT_FILE, ROOT);
if (process.argv.includes('--check')) {
  const existing = readFileSync(outputUrl, 'utf8');
  if (existing !== output)
    throw new Error(
      'shop-items.json has drifted; run node scripts/generate-canonical-catalogue.mjs',
    );
  console.log(
    'Catalogue compiler drift check passed (216 items, 108 sourced nutrition records).',
  );
} else {
  writeFileSync(outputUrl, output);
  console.log(
    'Generated 216 canonical catalogue items from maintained JSONL sources.',
  );
}
