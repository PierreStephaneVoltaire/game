import type { EffectRange, ItemDefinition } from './game-definition';
import { isStatusName } from './status-rules';

const METRICS = new Set([
  'food',
  'health',
  'mood',
  'rest',
  'bond',
  'creativity',
]);

export function validateEffects(
  effects: Partial<Record<string, EffectRange>> | undefined,
  label: string,
): string[] {
  if (!effects || typeof effects !== 'object') return [`${label} missing`];
  const issues: string[] = [];
  for (const [metric, range] of Object.entries(effects))
    if (!METRICS.has(metric)) issues.push(`unknown ${label} metric: ${metric}`);
    else if (
      !range ||
      !Number.isFinite(range.min) ||
      !Number.isFinite(range.max) ||
      range.min > range.max
    )
      issues.push(`invalid ${label} range for ${metric}`);
  return issues;
}

export function validateItemStructure(
  item: ItemDefinition,
  allIds: Set<string>,
  allTags: Set<string>,
): string[] {
  const issues: string[] = [];
  const actions = item.itemActions;
  if (!Array.isArray(actions)) issues.push('item actions missing');
  else {
    const actionIds = new Set<string>();
    for (const action of actions) {
      if (!action || typeof action !== 'object') {
        issues.push('item actions must be structured objects');
        continue;
      }
      if (!action.id?.trim() || !action.label?.trim())
        issues.push('item action needs an id and label');
      if (actionIds.has(action.id))
        issues.push(`duplicate item action id: ${action.id}`);
      actionIds.add(action.id);
      if (!['consume', 'interaction'].includes(action.kind))
        issues.push(`unknown item action kind: ${action.kind}`);
      if (action.effects)
        issues.push(
          ...validateEffects(action.effects, `action ${action.id} effect`),
        );
      if (typeof action.consumes !== 'boolean')
        issues.push(`action ${action.id} must explicitly author consumes`);
      for (const id of action.requirements?.ownedItemIdsAll ?? [])
        if (!allIds.has(id))
          issues.push(`action ${action.id} references unknown item: ${id}`);
      for (const tag of action.requirements?.ownedItemTagsAny ?? [])
        if (!allTags.has(tag))
          issues.push(
            `action ${action.id} references unknown item tag: ${tag}`,
          );
      for (const status of action.clearsStatuses ?? [])
        if (!isStatusName(status))
          issues.push(`action ${action.id} clears unknown status: ${status}`);
      if (
        action.clearsStatuses?.includes('kidney_stone') &&
        item.id === 'salt-tablet'
      )
        issues.push('Salt Tablet must not clear kidney_stone');
    }
  }
  if (Boolean(actions?.length) !== Boolean(item.usable))
    issues.push('usable must match the presence of item actions');
  if (
    Boolean(item.consumable) !==
    Boolean(actions?.some((action) => action.consumes))
  )
    issues.push('consumable must match an action with consumes enabled');
  if (!actions?.length && !item.roomSlot)
    issues.push('item has neither an interaction nor a room placement');

  const hooks = item.automaticEventHooks;
  if (!Array.isArray(hooks)) issues.push('automatic event hooks missing');
  else {
    const hookIds = new Set<string>();
    for (const hook of hooks) {
      if (!hook || typeof hook !== 'object') {
        issues.push('automatic event hooks must be structured objects');
        continue;
      }
      if (!hook.id?.trim() || !hook.message?.trim())
        issues.push('automatic event hook needs an id and message');
      if (hookIds.has(hook.id))
        issues.push(`duplicate automatic event hook id: ${hook.id}`);
      hookIds.add(hook.id);
      if (!Number.isFinite(hook.weight) || hook.weight <= 0)
        issues.push(`automatic event hook ${hook.id} has invalid weight`);
      if (!['owned', 'placed'].includes(hook.eligibility))
        issues.push(`automatic event hook ${hook.id} has invalid eligibility`);
      if (hook.eligibility === 'placed' && !item.roomSlot)
        issues.push(`automatic event hook ${hook.id} cannot require placement`);
      if (
        hook.cooldownHours !== undefined &&
        (!Number.isFinite(hook.cooldownHours) || hook.cooldownHours <= 0)
      )
        issues.push(`automatic event hook ${hook.id} has invalid cooldown`);
      if (hook.effects)
        issues.push(...validateEffects(hook.effects, `hook ${hook.id} effect`));
    }
  }
  return issues;
}
