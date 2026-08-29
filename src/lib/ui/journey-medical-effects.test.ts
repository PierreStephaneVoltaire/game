import { describe, expect, test } from 'vitest';

import type { GameEvent } from '$lib/game-types';
import { projectCausalJourney, projectJourney } from './journey-events';

describe('Journey status and timed-effect narration', () => {
  test('uses authored onset stories without duplicate status lines', () => {
    const events: GameEvent[] = [
      {
        id: 'sick-story',
        type: 'sickness_onset',
        at: 1,
        message: 'Cake caused sickness from overfeeding.',
        status: 'sick',
      },
      {
        id: 'sick-status',
        type: 'status_added',
        at: 1,
        message: 'Sick became active.',
        status: 'sick',
      },
      {
        id: 'dizzy-story',
        type: 'dizzy_spell_onset',
        at: 2,
        message: 'Soup left the companion feeling dizzy.',
        status: 'dizzy_spell',
      },
      {
        id: 'dizzy-status',
        type: 'status_onset',
        at: 2,
        message: 'Dizzy Spell became active.',
        status: 'dizzy_spell',
      },
    ];

    expect(
      projectJourney(events, 'Nova').map((entry) => entry.message),
    ).toEqual([
      'Nova got sick after eating past Full. A less-full stomach and proper Rest will help.',
      'Nova had a dizzy spell. More salt and water may help it clear.',
    ]);
    expect(
      projectCausalJourney(events, ['dizzy-status'], 'Nova').map(
        (entry) => entry.message,
      ),
    ).toEqual([
      'Nova had a dizzy spell. More salt and water may help it clear.',
    ]);
  });

  test('consolidates hospital clearance and distinguishes natural recovery', () => {
    const hospitalEvents: GameEvent[] = [
      {
        id: 'hospital',
        type: 'activity_completed',
        at: 10,
        message: 'The hospital visit finished.',
        activityType: 'medical_care',
      },
      {
        id: 'sick-clear',
        type: 'status_cleared',
        at: 10,
        message: 'Sick cleared.',
        status: 'sick',
      },
      {
        id: 'stone-clear',
        type: 'status_cleared',
        at: 10,
        message: 'Kidney Stone cleared.',
        status: 'kidney_stone',
      },
    ];
    expect(
      projectJourney(hospitalEvents, 'Nova').map((entry) => entry.message),
    ).toEqual([
      'Nova came home from the hospital rested and medically cleared.',
    ]);

    const naturalEvents: GameEvent[] = [
      {
        id: 'stone-passed',
        type: 'status_cleared',
        at: 20,
        message: 'The kidney stone passed. Somehow, with dignity intact.',
        status: 'kidney_stone',
      },
      {
        id: 'sick-passed',
        type: 'status_cleared',
        at: 21,
        message: 'The companion recovered from sickness.',
        status: 'sick',
      },
    ];
    expect(
      projectJourney(naturalEvents, 'Nova').map((entry) => entry.message),
    ).toEqual([
      "Nova's kidney stone passed naturally, bringing some welcome relief.",
      'Nova recovered from the sickness with time.',
    ]);
  });

  test('narrates Hyperfocus, Pain Relief, cravings, and debt naturally', () => {
    const sixHours = 6 * 3_600_000;
    const events: GameEvent[] = [
      {
        id: 'pepper',
        type: 'item_used',
        at: 0,
        message: 'Limited-Edition Dr Pepper was used.',
        itemName: 'Limited-Edition Dr Pepper',
        itemNarration:
          'cracked open Limited-Edition Dr Pepper and snapped into Hyperfocus.',
        tags: ['feeding'],
      },
      {
        id: 'painkillers',
        type: 'item_used',
        at: 1,
        message: 'Painkillers was used.',
        itemName: 'Painkillers',
        itemNarration:
          'took Painkillers, easing the kidney stone symptoms for a while.',
        tags: ['care', 'pain-relief'],
      },
      {
        id: 'craving',
        type: 'craving_expired',
        at: 2,
        message: 'The craving faded after the shop changed twice.',
      },
      {
        id: 'debt',
        type: 'cart_checked_out',
        at: 3,
        message: 'technical',
        purchases: [
          { itemId: 'soup', itemName: 'Soup', quantity: 2 },
          { itemId: 'medicine', itemName: 'Medicine', quantity: 1 },
        ],
        metricDeltas: { mood: -1 },
      },
      {
        id: 'expiry',
        type: 'time_reconciled',
        at: sixHours,
        message: 'technical',
        metricDeltas: { creativity: -2, rest: -2 },
      },
    ];

    expect(
      projectJourney(events, 'Nova').map((entry) => entry.message),
    ).toEqual([
      'Nova cracked open Limited-Edition Dr Pepper and snapped into Hyperfocus.',
      'Nova took Painkillers, easing the kidney stone symptoms for a while.',
      "Nova's craving faded before it could be fulfilled.",
      'You bought Soup ×2 for Nova.',
      'You bought Medicine for Nova.',
      "Nova's Hyperfocus wore off, leaving them less creative and in need of rest.",
    ]);
  });
});
