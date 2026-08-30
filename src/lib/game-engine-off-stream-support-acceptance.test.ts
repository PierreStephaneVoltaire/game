import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime } from './game-engine';
import type { GameState } from './game-types';
import { projectJourney } from './ui/journey-events';
import {
  eligibleRun,
  eligibleRunAt,
  HOUR,
  NOW,
} from './stream-protection-test-fixtures';

function blockedSupport(seed: string, now = NOW): GameState {
  const initial = eligibleRunAt(seed, 100, now);
  return dispatchCommand(
    {
      ...initial,
      statuses: { sick: { since: now, source: 'test' } },
    },
    {
      type: 'use_item',
      commandId: 'blocked-support-replay',
      itemId: 'missing',
      now,
    },
    BUNDLED_GAME_DEFINITION,
  ).state;
}

describe('off-stream support', () => {
  test('can repay debt from the shared pool while activity and statuses block streaming', () => {
    let supported: GameState | undefined;
    for (let index = 0; index < 1_000 && !supported; index += 1) {
      const seed = `off-stream-blocked-${index}`;
      const initial = eligibleRun(seed, 100);
      const state: GameState = {
        ...initial,
        balance: -100,
        activity: {
          id: 'busy',
          type: 'medical_care',
          startedAt: NOW,
          endsAt: NOW + 24 * HOUR,
          sourceActionId: 'busy',
        },
        statuses: Object.fromEntries(
          [
            'hungry',
            'starving',
            'sleep_deprived',
            'sick',
            'kidney_stone',
            'depressed',
            'low_energy',
            'overstimulated',
            'dizzy_spell',
          ].map((status) => [status, { since: NOW, source: 'test' }]),
        ) as GameState['statuses'],
      };
      const result = dispatchCommand(
        state,
        {
          type: 'use_item',
          commandId: 'blocked-support-opportunity',
          itemId: 'water',
          now: NOW,
        },
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (result.events.some((event) => event.type === 'off_stream_support'))
        supported = result;
    }

    const event = supported?.events.find(
      (candidate) => candidate.type === 'off_stream_support',
    );
    expect(event?.amount).toBeGreaterThanOrEqual(5);
    expect(event?.amount).toBeLessThanOrEqual(100);
    expect(supported?.balance).toBe(-100 + event!.amount!);
    expect(supported?.progression.followers).toBe(100);
    expect(supported?.progression.lastQualifyingOrdinaryStreamStartedAt).toBe(
      NOW - 100 * HOUR,
    );
    expect(supported?.activity?.type).toBe('medical_care');
  });

  test('participates in timed autonomous opportunities while streaming is blocked', () => {
    const at = NOW + 2 * HOUR;
    let supported: GameState | undefined;
    for (let index = 0; index < 1_000 && !supported; index += 1) {
      const initial = eligibleRun(`timed-support-${index}`, 100);
      const result = reconcileTime(
        {
          ...initial,
          activity: {
            id: 'busy',
            type: 'medical_care',
            startedAt: NOW,
            endsAt: NOW + 24 * HOUR,
            sourceActionId: 'busy',
          },
          statuses: { sick: { since: NOW, source: 'test' } },
          history: { ...initial.history, nextAutonomousAt: at },
        },
        at,
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (result.events.some((event) => event.type === 'off_stream_support'))
        supported = result;
    }

    expect(
      supported?.events.find((event) => event.type === 'off_stream_support')
        ?.sourceActionId,
    ).toBe(`autonomous:${at}`);
  });

  test('becomes eligible exactly at its 12-hour game-time cooldown', () => {
    const availableAt = NOW + 12 * HOUR;
    let selectedAtBoundary = false;
    for (let index = 0; index < 1_000; index += 1) {
      const seed = `support-cooldown-${index}`;
      for (const now of [availableAt - 1, availableAt]) {
        const initial = eligibleRunAt(seed, 0, now);
        const result = dispatchCommand(
          {
            ...initial,
            statuses: { sick: { since: now, source: 'test' } },
            history: {
              ...initial.history,
              eventCooldowns: {
                ...initial.history.eventCooldowns,
                off_stream_support: availableAt,
              },
            },
          },
          {
            type: 'use_item',
            commandId: 'support-cooldown-opportunity',
            itemId: 'missing',
            now,
          },
          BUNDLED_GAME_DEFINITION,
        ).state;
        const selected = result.events.some(
          (event) => event.type === 'off_stream_support',
        );
        if (now < availableAt) expect(selected).toBe(false);
        else if (selected) selectedAtBoundary = true;
      }
      if (selectedAtBoundary) break;
    }

    expect(selectedAtBoundary).toBe(true);
  });

  test('the seeded inclusive payout reaches both $5 and $100', () => {
    const amounts = new Set<number>();
    for (
      let index = 0;
      index < 20_000 && (!amounts.has(5) || !amounts.has(100));
      index += 1
    ) {
      const event = blockedSupport(`support-range-${index}`).events.find(
        (candidate) => candidate.type === 'off_stream_support',
      );
      if (event?.amount !== undefined) amounts.add(event.amount);
    }

    expect(Math.min(...amounts)).toBe(5);
    expect(Math.max(...amounts)).toBe(100);
    expect([...amounts].every(Number.isInteger)).toBe(true);
  });

  test('replays the seeded selection and payout exactly', () => {
    let seed = '';
    for (let index = 0; index < 1_000 && !seed; index += 1) {
      const candidate = `support-replay-${index}`;
      if (
        blockedSupport(candidate).events.some(
          (event) => event.type === 'off_stream_support',
        )
      )
        seed = candidate;
    }

    expect(blockedSupport(seed)).toEqual(blockedSupport(seed));
  });

  test('ignores special-date and queued-stream donation modifiers', () => {
    const now = Date.UTC(2026, 5, 29, 10);
    let supported: GameState | undefined;
    for (let index = 0; index < 1_000 && !supported; index += 1) {
      const initial = eligibleRunAt(`support-isolation-${index}`, 100, now);
      const result = dispatchCommand(
        {
          ...initial,
          statuses: { sick: { since: now, source: 'test' } },
          progression: {
            ...initial.progression,
            permanentDonationBonus: true,
            queuedEventStreams: [
              {
                id: 'high-multiplier-stream',
                type: 'tournament',
                queuedAt: now,
                durationHours: 8,
                donationMultiplier: 100,
              },
            ],
          },
        },
        {
          type: 'use_item',
          commandId: 'isolated-support-opportunity',
          itemId: 'missing',
          now,
        },
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (result.events.some((event) => event.type === 'off_stream_support'))
        supported = result;
    }

    const event = supported?.events.find(
      (candidate) => candidate.type === 'off_stream_support',
    );
    expect({
      payoutInRange:
        event?.amount !== undefined && event.amount >= 5 && event.amount <= 100,
      donationTier: event?.donationTier,
      donationEvents: supported?.events.filter(
        (candidate) => candidate.type === 'donation_received',
      ).length,
      followers: supported?.progression.followers,
      lastSelectedAt:
        supported?.progression.lastQualifyingOrdinaryStreamStartedAt,
    }).toEqual({
      payoutInRange: true,
      donationTier: undefined,
      donationEvents: 0,
      followers: 100,
      lastSelectedAt: now - 100 * HOUR,
    });
  });

  test('does not resolve after the run has ended', () => {
    const initial = eligibleRun('terminal-support', 100);
    const result = dispatchCommand(
      {
        ...initial,
        ending: {
          kind: 'death',
          at: NOW,
          cause: 'test',
          eventIds: [],
        },
      },
      {
        type: 'use_item',
        commandId: 'terminal-support-opportunity',
        itemId: 'missing',
        now: NOW,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(
      result.events.some(
        (event) =>
          event.type === 'off_stream_support' ||
          event.type === 'random_event_opportunity',
      ),
    ).toBe(false);
  });

  test('projects every payout as offline support in Journey', () => {
    let supported: GameState | undefined;
    for (let index = 0; index < 1_000 && !supported; index += 1) {
      const result = blockedSupport(`support-journey-${index}`);
      if (result.events.some((event) => event.type === 'off_stream_support'))
        supported = result;
    }
    const event = supported!.events.find(
      (candidate) => candidate.type === 'off_stream_support',
    )!;

    expect(
      projectJourney(supported!.events, 'Nova').find((entry) =>
        entry.sourceEventIds.includes(event.id),
      )?.message,
    ).toBe(`A fan sent $${event.amount} of support while Nova was offline.`);
  });
});
