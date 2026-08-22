import type { ItemActionDefinition, ItemDefinition } from './game-definition';

export type ActionOwnership = {
  itemIds: ReadonlySet<string>;
  tags: ReadonlySet<string>;
};

export function actionOwnership(
  inventory: Record<string, number>,
  room: Record<string, string>,
  items: readonly ItemDefinition[],
): ActionOwnership {
  const itemIds = new Set(
    Object.entries(inventory)
      .filter(([, quantity]) => quantity > 0)
      .map(([id]) => id),
  );
  for (const itemId of Object.values(room)) itemIds.add(itemId);
  const tags = new Set(
    items.filter((item) => itemIds.has(item.id)).flatMap((item) => item.tags),
  );
  return { itemIds, tags };
}

export function itemActionAvailable(
  itemId: string,
  action: ItemActionDefinition,
  ownership: ActionOwnership,
): boolean {
  if (!ownership.itemIds.has(itemId)) return false;
  const requirements = action.requirements;
  return (
    (requirements?.ownedItemIdsAll ?? []).every((id) =>
      ownership.itemIds.has(id),
    ) &&
    (!requirements?.ownedItemTagsAny?.length ||
      requirements.ownedItemTagsAny.some((tag) => ownership.tags.has(tag)))
  );
}
