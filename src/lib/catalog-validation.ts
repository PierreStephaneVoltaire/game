import type { GameDefinition, ItemDefinition } from './game-definition';
import {
  validateEffects,
  validateItemStructure,
} from './catalog-structure-validation';
import canonicalItemIds from './data/catalogue/canonical-item-ids.json';
import petProfile from './data/pet-profile.json';
import {
  validateItemNutrition,
  validateNutritionSourceMix,
} from './nutrition-validation';
import { isStatusName } from './status-rules';

const CATEGORY_BANDS: Record<string, [number, number]> = {
  food: [1, 8],
  medicine: [5, 15],
  care: [5, 15],
  accessory: [25, 250],
  reusable: [25, 250],
  upgrade: [25, 250],
  decoration: [25, 250],
};
const COMPLETE_CATEGORY_COUNTS: Record<string, number> = {
  food: 107,
  medicine: 1,
  care: 1,
  reusable: 73,
  upgrade: 20,
  decoration: 14,
};
const METRICS = new Set([
  'food',
  'health',
  'mood',
  'rest',
  'bond',
  'creativity',
]);
const PREFERENCES = new Set([
  'liked',
  'disliked',
  'specific_preparation',
  'variable',
  'never_had',
]);
const ROOM_SLOTS = new Set([
  'bed',
  'desk',
  'chair',
  'wall',
  'floor',
  'shelf',
  'window',
  'cat-corner',
]);
const STATUS_HOOKS = new Set(['rolling_salt']);
const FORBIDDEN_ALIASES = new Set([
  'salted-pretzels',
  'pretzels',
  'pizza-slice',
  'potatoe-chips',
  'hash-browns',
  'lollipops',
  'cupcakes',
  'chicken-fingers',
  'onions',
  'acai-bowls',
  'sweet-potatoes',
  'fruit-smoothies',
  'brownies',
]);
const GENERIC_COPY = new Set([
  'A varied everyday choice.',
  'Not a food or drink.',
  'A useful room item.',
]);
const companionNamePattern = new RegExp(
  `\\b${petProfile.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s)?\\b`,
  'i',
);

export type CatalogIssue = { itemId?: string; message: string };

function validateItem(
  item: ItemDefinition,
  allIds: Set<string>,
  allTags: Set<string>,
): string[] {
  const issues: string[] = [];
  if (!item.id || !item.name || !item.description)
    issues.push('missing identity/display field');
  if (FORBIDDEN_ALIASES.has(item.id))
    issues.push('catalogue contains a non-canonical alias');
  if (!(item.category in CATEGORY_BANDS)) issues.push('unknown item category');
  const band = CATEGORY_BANDS[item.category];
  if (band && (item.price < band[0] || item.price > band[1]))
    issues.push(`price outside ${item.category} band`);
  if (item.image !== `/items/generated/${item.id}.png`)
    issues.push('catalogue item must reference its stable generated PNG asset');
  if (
    !item.qualitativeNutritionHint?.trim() ||
    GENERIC_COPY.has(item.qualitativeNutritionHint) ||
    /\bis non-edible\b/i.test(item.qualitativeNutritionHint)
  )
    issues.push('qualitative nutrition hint is missing or generic');
  if (
    companionNamePattern.test(
      `${item.description} ${item.qualitativeNutritionHint}`,
    )
  )
    issues.push('catalogue copy hardcodes the companion name');

  if (!Array.isArray(item.tags)) issues.push('tags missing');
  else {
    if (new Set(item.tags).size !== item.tags.length)
      issues.push('duplicate tags');
    if (item.tags.some((tag) => !tag.trim())) issues.push('empty tag');
    if (!item.tags.includes(item.category)) issues.push('category tag missing');
  }
  const preferences = item.preferences ?? [];
  if (new Set(preferences).size !== preferences.length)
    issues.push('duplicate preferences');
  for (const preference of preferences)
    if (!PREFERENCES.has(preference))
      issues.push(`unknown preference: ${preference}`);
  if (item.edible && preferences.length !== 1)
    issues.push('edible items need exactly one authored preference');

  issues.push(...validateEffects(item.effects, 'consume effect'));
  const context = item.context;
  for (const [name, value] of Object.entries({
    refusalProbability: context?.refusalProbability,
    preparationAcceptance: context?.preparationAcceptance,
  }))
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > 1)
    )
      issues.push(`invalid context probability: ${name}`);
  const preparationSpecific = preferences.includes('specific_preparation');
  const disliked = preferences.includes('disliked') || preparationSpecific;
  if (disliked && !context?.dislikedEffects)
    issues.push('disliked behavior needs authored disliked effects');
  if (disliked && item.effects?.mood)
    issues.push('disliked mood effects must not be top-level consume effects');
  if (
    preparationSpecific &&
    (!(context?.refusalProbability && context.refusalProbability > 0) ||
      !(context.preparationAcceptance && context.preparationAcceptance < 1))
  )
    issues.push('specific preparation needs authored acceptance and refusal');
  if (context?.dislikedEffects)
    issues.push(...validateEffects(context.dislikedEffects, 'disliked effect'));

  if (!item.properties || typeof item.properties !== 'object')
    issues.push('hidden properties missing');
  issues.push(...validateItemNutrition(item));
  const scores = item.nutritionScores;
  if (
    (scores?.salt ?? 0) >= 2 &&
    (!item.tags.includes('salty') ||
      !item.statusHooks?.includes('rolling_salt'))
  )
    issues.push('high-salt item needs salty tag and rolling_salt hook');
  if ((scores?.water ?? 0) >= 2 && !item.tags.includes('hydrating'))
    issues.push('hydration score needs hydrating tag');
  if ((scores?.sugar ?? 0) >= 2 && !item.tags.includes('sugar'))
    issues.push('high-sugar item needs sugar tag');
  if (
    item.tags.includes('stream-snack') &&
    (!item.edible || (item.effects?.food?.max ?? 0) <= 0)
  )
    issues.push('stream-snack must be an edible feeding option');

  if (item.roomSlot !== null && !ROOM_SLOTS.has(item.roomSlot ?? ''))
    issues.push('invalid room slot');
  const roomEffects = item.roomEffects ?? {};
  for (const [metric, value] of Object.entries(roomEffects))
    if (!METRICS.has(metric) || !Number.isFinite(value) || value === 0)
      issues.push(`invalid room effect: ${metric}`);
  if (item.roomSlot && !Object.keys(roomEffects).length)
    issues.push('placeable item needs an authored room effect');
  if (!item.roomSlot && Object.keys(roomEffects).length)
    issues.push('unplaceable item cannot have room effects');

  if (!Array.isArray(item.statusHooks)) issues.push('status hooks missing');
  else
    for (const hook of item.statusHooks)
      if (!STATUS_HOOKS.has(hook)) issues.push(`unknown status hook: ${hook}`);
  if ('hooks' in item) issues.push('legacy hooks field is not supported');
  for (const status of item.clearsStatuses ?? [])
    if (!isStatusName(status)) issues.push(`unknown cleared status: ${status}`);
  if (
    item.id === 'salt-tablet' &&
    item.clearsStatuses?.includes('kidney_stone')
  )
    issues.push('Salt Tablet must not clear kidney_stone');

  issues.push(...validateItemStructure(item, allIds, allTags));
  return issues;
}

export function validateCatalog(
  definition: GameDefinition,
  requireComplete = false,
): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const ids = new Set(definition.items.map((item) => item.id));
  const allTags = new Set(definition.items.flatMap((item) => item.tags ?? []));
  if (ids.size !== definition.items.length)
    issues.push({ message: 'canonical catalogue IDs must be unique' });
  for (const item of definition.items)
    for (const message of validateItem(item, ids, allTags))
      issues.push({ itemId: item.id, message });

  const hints = new Map<string, string>();
  const hookOwners = new Map<string, string>();
  for (const item of definition.items) {
    const prior = hints.get(item.qualitativeNutritionHint);
    if (prior)
      issues.push({
        itemId: item.id,
        message: `qualitative nutrition hint duplicates ${prior}`,
      });
    hints.set(item.qualitativeNutritionHint, item.id);
    for (const hook of item.automaticEventHooks ?? []) {
      const priorOwner = hookOwners.get(hook.id);
      if (priorOwner)
        issues.push({
          itemId: item.id,
          message: `automatic event hook id duplicates ${priorOwner}: ${hook.id}`,
        });
      hookOwners.set(hook.id, item.id);
    }
  }
  if (requireComplete) {
    if (definition.items.length !== 216)
      issues.push({
        message: `expected 216 canonical items, found ${definition.items.length}`,
      });
    for (const [category, expected] of Object.entries(
      COMPLETE_CATEGORY_COUNTS,
    )) {
      const found = definition.items.filter(
        (item) => item.category === category,
      ).length;
      if (found !== expected)
        issues.push({
          message: `expected ${expected} ${category} items, found ${found}`,
        });
    }
    const actualIds = definition.items.map((item) => item.id);
    const expectedIds = canonicalItemIds as string[];
    const missingIds = expectedIds.filter((id) => !ids.has(id));
    const unexpectedIds = actualIds.filter((id) => !expectedIds.includes(id));
    if (missingIds.length || unexpectedIds.length)
      issues.push({
        message: `catalogue IDs differ from canonical allowlist (missing: ${missingIds.join(', ') || 'none'}; unexpected: ${unexpectedIds.join(', ') || 'none'})`,
      });
    else if (actualIds.some((id, index) => id !== expectedIds[index]))
      issues.push({
        message: 'catalogue order differs from canonical allowlist',
      });
    for (const message of validateNutritionSourceMix(definition.items))
      issues.push({ message });
    const hasApologyClearance = definition.items.some((item) =>
      item.itemActions?.some(
        (action) =>
          action.consumes === false &&
          action.tags?.includes('apology') &&
          action.clearsStatuses?.includes('annoyed'),
      ),
    );
    if (!hasApologyClearance)
      issues.push({
        message:
          'catalogue needs a reusable apology action that clears annoyed',
      });
  }
  return issues;
}
