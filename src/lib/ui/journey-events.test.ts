import { describe, expect, test } from 'vitest';

import type { GameEvent } from '$lib/game-types';
import { projectCausalJourney, projectJourney } from './journey-events';

describe('Journey projection', () => {
  test('filters engine bookkeeping and narrates meaningful transitions', () => {
    const events: GameEvent[] = [
      { id: '1', type: 'run_started', at: 0, message: 'internal' },
      {
        id: '2',
        type: 'time_reconciled',
        at: 1,
        message: '1 decay interval resolved.',
      },
      { id: '3', type: 'shop_rotated', at: 1, message: 'shop refreshed' },
      {
        id: '4',
        type: 'status_cleared',
        at: 2,
        message: 'Hungry cleared.',
        status: 'hungry',
      },
      {
        id: '5',
        type: 'status_onset',
        at: 2,
        message: 'Starving became active.',
        status: 'starving',
      },
      {
        id: '6',
        type: 'status_recurrence',
        at: 3,
        message: 'Companion is still lonely.',
        status: 'lonely',
      },
      {
        id: '7',
        type: 'cart_checked_out',
        at: 4,
        message: 'technical checkout',
        purchases: [
          { itemId: 'water', itemName: 'Water', quantity: 2 },
          { itemId: 'cake', itemName: 'Cake', quantity: 1 },
        ],
      },
      {
        id: '8',
        type: 'command_outcome',
        at: 4,
        message: 'receipt',
      },
    ];

    expect(
      projectJourney(events, 'Nova').map((event) => event.message),
    ).toEqual([
      "Nova's journey began.",
      'Nova is starving.',
      'Bought 2 Water.',
      'Bought 1 Cake.',
    ]);
  });

  test('uses natural causal narration without exposing metric bookkeeping', () => {
    const events: GameEvent[] = [
      {
        id: 'damage',
        type: 'time_reconciled',
        at: 2,
        message: 'technical',
        metricDeltas: { health: -3 },
        healthDamageSources: [
          {
            kind: 'status',
            id: 'starving',
            name: 'Starvation',
            amount: 2,
            eventIds: [],
          },
          {
            kind: 'status',
            id: 'sleep_deprived',
            name: 'Sleep deprivation',
            amount: 1,
            eventIds: [],
          },
        ],
      },
      { id: 'death', type: 'death', at: 2, message: 'Companion died.' },
    ];

    expect(
      projectCausalJourney(events, ['damage', 'death'], 'Nova').map(
        (event) => event.message,
      ),
    ).toEqual([
      "Nova's health suffered from Starvation and Sleep deprivation.",
      'Nova died.',
    ]);
  });
});
