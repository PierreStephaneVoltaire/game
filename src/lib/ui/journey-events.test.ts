import { describe, expect, test } from 'vitest';

import type { GameEvent } from '$lib/game-types';
import { companion } from './companion';
import { projectCausalJourney, projectJourney } from './journey-events';
import eventTexts from '$lib/data/event-texts.json';
import { interpolateText } from '$lib/seeded-text';

function resolvedTemplates(
  id: keyof typeof eventTexts.eventTemplates,
  values: Record<string, string | number>,
): string[] {
  return eventTexts.eventTemplates[id].map((template) =>
    interpolateText(template, values),
  );
}

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

    const messages = projectJourney(events, 'Nova').map(
      (event) => event.message,
    );
    expect(messages.slice(0, 2)).toEqual([
      "Nova's journey began.",
      'Nova is starving.',
    ]);
    expect(
      resolvedTemplates('journey_player_purchase', {
        pet: 'Nova',
        item: 'Water ×2',
      }),
    ).toContain(messages[2]);
    expect(
      resolvedTemplates('journey_player_purchase', {
        pet: 'Nova',
        item: 'Cake',
      }),
    ).toContain(messages[3]);
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

  test('keeps duplicate raw event ids renderable with unique Journey keys', () => {
    const entries = projectJourney(
      [
        {
          id: 'duplicate',
          type: 'stream_candidate',
          at: 1,
          message: 'Companion started streaming.',
        },
        {
          id: 'duplicate',
          type: 'stream_candidate',
          at: 2,
          message: 'Companion started streaming.',
        },
      ],
      'Nova',
    );

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.id)).toEqual([
      'duplicate',
      'duplicate:duplicate:2',
    ]);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
  });

  test('distinguishes player purchases, autonomous purchases, gifts, and subscriber counts', () => {
    const entries = projectJourney(
      [
        {
          id: 'player',
          type: 'cart_checked_out',
          at: 1,
          message: 'complete',
          purchaseActor: 'player',
          purchases: [
            { itemId: 'painkillers', itemName: 'Painkillers', quantity: 1 },
            { itemId: 'water', itemName: 'Water', quantity: 3 },
          ],
        },
        {
          id: 'autonomous-purchase',
          type: 'life_event_resolved',
          at: 2,
          message: 'Companion bought Painkillers.',
          purchaseActor: 'companion',
          purchases: [
            { itemId: 'painkillers', itemName: 'Painkillers', quantity: 1 },
          ],
        },
        {
          id: 'gift',
          type: 'moms_care_package',
          at: 3,
          message: 'Mom sent a Care Package gift with Water and Pretzel.',
        },
        {
          id: 'one',
          type: 'natural_audience_growth',
          at: 4,
          message: 'internal',
          followerDelta: 1,
        },
        {
          id: 'many',
          type: 'natural_audience_growth',
          at: 5,
          message: 'internal',
          followerDelta: 4,
        },
      ],
      companion.name,
    );
    const messages = entries.map(({ message }) => message);
    expect(
      resolvedTemplates('journey_player_purchase', {
        pet: companion.name,
        item: 'Painkillers',
      }),
    ).toContain(messages[0]);
    expect(
      resolvedTemplates('journey_player_purchase', {
        pet: companion.name,
        item: 'Water ×3',
      }),
    ).toContain(messages[1]);
    expect(
      resolvedTemplates('journey_companion_purchase', {
        pet: companion.name,
        item: 'Painkillers',
      }),
    ).toContain(messages[2]);
    expect(
      resolvedTemplates('journey_care_package', {
        pet: companion.name,
        message: 'Mom sent a Care Package gift with Water and Pretzel.',
      }),
    ).toContain(messages[3]);
    expect(
      resolvedTemplates('journey_subscriber_growth_one', {
        pet: companion.name,
        count: '1',
      }),
    ).toContain(messages[4]);
    expect(
      resolvedTemplates('journey_subscriber_growth_many', {
        pet: companion.name,
        count: '4',
      }),
    ).toContain(messages[5]);
  });
});
