import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { startRun } from './game-engine';
import { eventTemplate, lifeEventMessage } from './event-messages';
import { lifeEventDefinitions, resolveLifeEvent } from './life-event-rules';

function run() {
  return startRun(
    { mode: 'streaming', now: 0, seed: 'life-events', timezone: 'UTC' },
    BUNDLED_GAME_DEFINITION,
  );
}

describe('authored life events', () => {
  test('loads every authored message reference from event text data', () => {
    const messageIds = lifeEventDefinitions.flatMap((definition) => [
      ...(definition.messageId ? [definition.messageId] : []),
      ...(definition.outcomes ?? []).map((outcome) => outcome.messageId),
    ]);

    expect(messageIds.length).toBeGreaterThan(0);
    for (const messageId of messageIds)
      expect(lifeEventMessage(messageId).trim()).not.toBe('');

    const templateIds = lifeEventDefinitions.flatMap((definition) =>
      definition.messageTemplateId ? [definition.messageTemplateId] : [],
    );
    expect(templateIds.length).toBeGreaterThan(0);
    for (const templateId of templateIds)
      expect(
        eventTemplate(templateId, { amount: '123', item: 'Monitor' }),
      ).not.toMatch(/\{\w+\}/);

    for (const definition of lifeEventDefinitions) {
      if (!definition.cashRange) continue;
      expect(Number.isInteger(definition.cashRange.minimum)).toBe(true);
      expect(Number.isInteger(definition.cashRange.maximum)).toBe(true);
      expect(definition.cashRange.minimum).toBeLessThanOrEqual(
        definition.cashRange.maximum,
      );
    }
  });

  test('replays an expense deterministically with signed ledger effects', () => {
    const initial = run();
    const first = resolveLifeEvent(initial, 'tax_bill', 0, 'tax-attempt');
    const replay = resolveLifeEvent(initial, 'tax_bill', 0, 'tax-attempt');
    const event = first.events.find(
      (candidate) => candidate.lifeEventId === 'tax_bill',
    );

    expect(first).toEqual(replay);
    expect(event?.cashDelta).toBeLessThan(0);
    expect(event?.financialEffect?.cashDelta).toBe(event?.cashDelta);
    expect(event?.cashDelta).toBeGreaterThanOrEqual(-1000);
    expect(event?.cashDelta).toBeLessThanOrEqual(-100);
    expect(first.inventory).toEqual(initial.inventory);
    expect(first.shop).toEqual(initial.shop);
    expect(first.activity).toEqual(initial.activity);
  });

  test('uses seeded values across the full tax and sponsorship ranges', () => {
    const initial = { ...run(), balance: 10_000 };
    const taxAmounts = new Set<number>();
    const sponsorAmounts = new Set<number>();

    for (let index = 0; index < 64; index += 1) {
      const tax = resolveLifeEvent(
        initial,
        'tax_bill',
        0,
        `tax-range:${index}`,
      );
      const sponsor = resolveLifeEvent(
        initial,
        'sponsored_stream_deal',
        0,
        `sponsor-range:${index}`,
      );
      taxAmounts.add(tax.events.at(-1)!.cashDelta!);
      sponsorAmounts.add(sponsor.events.at(-1)!.cashDelta!);
    }

    expect(taxAmounts.size).toBeGreaterThan(1);
    for (const amount of taxAmounts) {
      expect(amount).toBeGreaterThanOrEqual(-1000);
      expect(amount).toBeLessThanOrEqual(-100);
    }
    expect(sponsorAmounts.size).toBeGreaterThan(1);
    for (const amount of sponsorAmounts) {
      expect(amount).toBeGreaterThanOrEqual(250);
      expect(amount).toBeLessThanOrEqual(2000);
    }
  });

  test('selects varied PC equipment and varied replacement costs', () => {
    const initial = { ...run(), balance: 10_000 };
    const definition = lifeEventDefinitions.find(
      ({ id }) => id === 'equipment_failure',
    )!;
    const eligibleIds = new Set(
      definition.behavior?.type === 'catalogue_item_expense'
        ? definition.behavior.eligibleItemIds
        : [],
    );
    const catalogueIds = new Set(
      BUNDLED_GAME_DEFINITION.items.map(({ id }) => id),
    );
    expect([...eligibleIds].every((id) => catalogueIds.has(id))).toBe(true);
    const selectedItems = new Set<string>();
    const costs = new Set<number>();

    for (let index = 0; index < 64; index += 1) {
      const resolved = resolveLifeEvent(
        initial,
        'equipment_failure',
        0,
        `equipment-range:${index}`,
      );
      const event = resolved.events.at(-1)!;
      selectedItems.add(event.cause!);
      costs.add(event.cashDelta!);
      expect(eligibleIds.has(event.cause!)).toBe(true);
      expect(event.cashDelta).toBeGreaterThanOrEqual(-500);
      expect(event.cashDelta).toBeLessThanOrEqual(-30);
      expect(event.message).toContain('$');
      expect(resolved.inventory).toEqual(initial.inventory);
    }

    expect(selectedItems.size).toBeGreaterThan(1);
    expect(costs.size).toBeGreaterThan(1);
  });

  test('adds one affordable full-catalogue personal purchase without debt', () => {
    const started = run();
    const initial = {
      ...started,
      balance: 100,
      metrics: { ...started.metrics, mood: 5 },
      shop: { ...started.shop, itemIds: [], stock: {}, cart: {} },
    };
    const resolved = resolveLifeEvent(
      initial,
      'personal_purchase',
      0,
      'purchase-attempt',
    );
    const event = resolved.events.find(
      (candidate) => candidate.lifeEventId === 'personal_purchase',
    );

    const purchase = event?.purchases?.[0];
    const item = BUNDLED_GAME_DEFINITION.items.find(
      ({ id }) => id === purchase?.itemId,
    );
    expect(event?.purchases).toHaveLength(1);
    expect(purchase?.quantity).toBe(1);
    expect(item?.price).toBeLessThanOrEqual(initial.balance);
    expect(event?.cashDelta).toBe(-item!.price);
    expect(event?.metricDeltas?.mood).toBe(1);
    expect(resolved.balance).toBe(initial.balance + event!.cashDelta!);
    expect(resolved.balance).toBeGreaterThanOrEqual(0);
    expect(resolved.inventory[item!.id]).toBe(
      (initial.inventory[item!.id] ?? 0) + 1,
    );
    expect(resolved.history.lifetimePurchases[item!.id]).toBe(
      (initial.history.lifetimePurchases[item!.id] ?? 0) + 1,
    );
    expect(resolved.shop).toEqual(initial.shop);
  });

  test('authors every cash-loss event to be ineligible below $0', () => {
    const cashLossIds = lifeEventDefinitions
      .filter(
        (definition) =>
          (definition.cashRange?.minimum ?? 0) < 0 ||
          [
            definition.effects,
            ...(definition.outcomes ?? []).map(({ effects }) => effects),
          ]
            .filter(Boolean)
            .some((effects) => (effects?.cash ?? 0) < 0),
      )
      .map(({ id }) => id);
    cashLossIds.push('personal_purchase');
    expect(new Set(cashLossIds)).toEqual(
      new Set(['personal_purchase', 'tax_bill', 'equipment_failure']),
    );
    for (const id of cashLossIds) {
      const initial = { ...run(), balance: -1 };
      expect(resolveLifeEvent(initial, id, 0, `blocked:${id}`)).toEqual(
        initial,
      );
      expect(
        lifeEventDefinitions.find((definition) => definition.id === id)
          ?.requiresNonnegativeBalance,
      ).toBe(true);
    }
  });

  test('allows a rare bill to create debt but not recur while debt remains', () => {
    const initial = { ...run(), balance: 0 };
    const billed = resolveLifeEvent(initial, 'tax_bill', 0, 'first-tax');
    const repeated = resolveLifeEvent(billed, 'tax_bill', 0, 'second-tax');
    expect(billed.balance).toBeLessThan(0);
    expect(billed.statuses.in_debt).toBeDefined();
    expect(repeated).toEqual(billed);
  });

  test('subscriber loss preserves peak audience and milestone rewards', () => {
    const initial = run();
    const established = {
      ...initial,
      progression: {
        ...initial.progression,
        followers: 10_000,
        peakFollowers: 10_000,
      },
    };
    const resolved = resolveLifeEvent(
      established,
      'twitter_cancellation',
      0,
      'twitter-attempt',
    );

    expect(resolved.progression.followers).toBeLessThan(10_000);
    expect(resolved.progression.peakFollowers).toBe(10_000);
  });

  test('agency adds Subscribers and starts a temporary natural-growth boost', () => {
    const initial = run();
    const eligible = {
      ...initial,
      progression: {
        ...initial.progression,
        followers: 100_000,
        peakFollowers: 100_000,
      },
    };
    const resolved = resolveLifeEvent(
      eligible,
      'agency_invitation',
      0,
      'agency-attempt',
    );

    expect(resolved.progression.followers).toBe(200_000);
    expect(resolved.progression.discoveryBoosts).toContainEqual(
      expect.objectContaining({
        eventId: 'agency_invitation',
        multiplier: 1.5,
        expiresAt: 168 * 60 * 60 * 1000,
      }),
    );
    expect(resolved.ending).toBeNull();
  });
});
