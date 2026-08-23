import rules from '$lib/data/simulation-rules.json';
import { HOUR_MS } from '$lib/game-constants';
import type { GameEvent } from '$lib/game-types';

export const ITEM_NARRATIVE_TYPES = new Set([
  'item_used',
  'item_refused',
  'item_reaction',
  'item_discovery',
  'item_preparation',
  'craving_fulfilled',
  'sickness_onset',
  'sick_feeding_harm',
  'kidney_stone_onset',
  'dizzy_spell_onset',
  'full_feed_suppressed',
]);

export function itemJourneyMessage(
  event: GameEvent,
  petName: string,
): string | undefined {
  const itemName = event.itemName ?? itemNameFromMessage(event.message);
  if (event.type === 'item_used')
    return usedItemMessage(event, itemName, petName);
  if (event.type === 'item_refused')
    return `${petName} refused ${itemName ?? 'the item'}${event.message.includes('wasted') ? ', and it went to waste' : ''}.`;
  if (event.type === 'item_reaction')
    return `${petName} ${event.discovery === 'liked' ? 'really enjoyed' : 'managed to tolerate'} ${itemName ?? 'the food'}.`;
  if (event.type === 'item_discovery')
    return `${petName} tried ${itemName ?? 'the food'} and discovered something new about this serving.`;
  if (event.type === 'item_preparation')
    return event.discovery === 'acceptable_preparation'
      ? `${petName}'s ${itemName ?? 'food'} arrived just the way they wanted it.`
      : `${petName} was unhappy with how ${itemName ?? 'the food'} was prepared.`;
  if (event.type === 'craving_fulfilled')
    return `${itemName ?? 'That treat'} was exactly what ${petName} had been craving.`;
  if (event.type === 'sickness_onset')
    return `${petName} got sick after eating past Full. A less-full stomach and proper Rest will help.`;
  if (event.type === 'sick_feeding_harm')
    return `${petName}'s sickness worsened after ${itemName ?? 'that serving'}.`;
  if (event.type === 'kidney_stone_onset')
    return `${petName} developed painful kidney stone symptoms after ${itemName ?? 'that serving'}.`;
  if (event.type === 'dizzy_spell_onset')
    return `${petName} had a dizzy spell. More salt and water may help it clear.`;
  if (event.type === 'full_feed_suppressed')
    return `${petName} was too ${event.message.includes('sick') ? 'sick' : 'full'} to get any Food from ${itemName ?? 'that serving'}.`;
  return undefined;
}

export function timedEffectJourneyMessage(
  events: GameEvent[],
  event: GameEvent,
  petName: string,
): string | undefined {
  if (event.type !== 'time_reconciled') return undefined;
  const durationMs = rules.hyperfocus.durationHours * HOUR_MS;
  const began = events.some(
    (candidate) =>
      candidate.type === 'item_used' &&
      candidate.itemName === 'Limited-Edition Dr Pepper' &&
      candidate.at + durationMs === event.at,
  );
  if (!began) return undefined;
  return `${petName}'s Hyperfocus wore off, leaving them less creative and in need of rest.`;
}

function usedItemMessage(
  event: GameEvent,
  itemName: string | undefined,
  petName: string,
): string {
  if (event.tags?.includes('pain-relief'))
    return `${petName} took Painkillers. Pain Relief will ease the recurring symptoms for a while.`;
  if (itemName === 'Limited-Edition Dr Pepper')
    return `${petName} cracked open Limited-Edition Dr Pepper and snapped into Hyperfocus.`;
  if (itemName === 'Electrolyte Sachet')
    return `${petName} mixed an Electrolyte Sachet for a measured salt-and-water boost.`;
  if (event.tags?.includes('feeding'))
    return `${petName} tried ${itemName ?? 'the food'}.`;
  if (event.actionLabel && itemName)
    return `${petName} used ${itemName} to ${event.actionLabel.toLowerCase()}.`;
  return itemName ? `${petName} used ${itemName}.` : `${petName} used an item.`;
}

function itemNameFromMessage(message: string): string | undefined {
  return message.match(
    /^(.*?) (?:was used|was refused|was enjoyed|was tolerated|fulfilled|caused|harmed|triggered|left|did not)/,
  )?.[1];
}
