import { writable } from 'svelte/store';
import roomSvg from '$lib/assets/room/room.svg?raw';
import { simulationRules as rules } from '$lib/runtime-definition';
import type { CareerTier } from '$lib/game-types';

const PICKER_SLOTS = ['wall', 'poster', 'second-poster'];

const slotVariants: Record<string, string[]> = {};
const defaults: Record<string, string> = {};
for (const [, slot, variant, isDefault] of roomSvg.matchAll(
  /<g data-slot="([^"]+)" data-variant="([^"]+)"( data-default="")?>/g,
)) {
  (slotVariants[slot] ??= []).push(variant);
  if (isDefault) defaults[slot] = variant;
}

export { roomSvg };

export const swappableSlots = Object.entries(slotVariants).filter(
  ([slot, variants]) => PICKER_SLOTS.includes(slot) && variants.length > 1,
);

export const roomLook = writable({ variants: { ...defaults } });

// GAME_RULES "Room sets": one set per distinct Subscriber Revenue multiplier.
export function roomSetForTier(tier: CareerTier): number {
  let multiplier = 1;
  let set = 1;
  for (const milestone of rules.progression.milestones as Array<{
    id: string;
    subscriberRevenueMultiplier?: number;
  }>) {
    const next = milestone.subscriberRevenueMultiplier;
    if (next !== undefined && next !== multiplier) {
      multiplier = next;
      set += 1;
    }
    if (milestone.id === tier) return set;
  }
  return set;
}

export function roomVariantFor(
  slot: string,
  look: {
    set: number;
    placed: Record<string, string>;
    picked: Record<string, string>;
  },
): string {
  if (look.placed[slot]) return look.placed[slot];
  if (PICKER_SLOTS.includes(slot)) return look.picked[slot] ?? defaults[slot];
  const setVariant = String(look.set);
  return slotVariants[slot]?.includes(setVariant) ? setVariant : defaults[slot];
}
