import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime } from './game-engine';
import type { GameState } from './game-types';
import {
  eligibleRun,
  eligibleRunAt,
  HOUR,
  NOW,
  opportunityCause,
  opportunityCauseAt,
} from './stream-protection-test-fixtures';

describe('autonomous stream drought protection', () => {
  test('the stream weight begins ramping after the 24-hour grace window', () => {
    let contrast:
      { grace: string | undefined; ramped: string | undefined } | undefined;
    for (let index = 0; index < 10_000 && !contrast; index += 1) {
      const seed = `pity-ramp-${index}`;
      const grace = opportunityCause(seed, 24);
      const ramped = opportunityCause(seed, 25);
      if (grace !== 'stream' && ramped === 'stream')
        contrast = { grace, ramped };
    }

    expect(contrast?.grace).not.toBe('stream');
    expect(contrast?.ramped).toBe('stream');
  });

  test('the first 24 hours have no bonus and the drought bonus caps at 300', () => {
    for (let index = 0; index < 250; index += 1) {
      const seed = `pity-bounds-${index}`;
      expect(opportunityCause(seed, 24)).toBe(opportunityCause(seed, 0));
      expect(opportunityCause(seed, 1_000)).toBe(opportunityCause(seed, 99));
    }
  });

  test('daypart and special-date boosts multiply the pity-inclusive weight', () => {
    const ordinary = Date.UTC(2026, 0, 2, 10);
    const boostedDaypart = Date.UTC(2026, 0, 2, 14);
    const specialDate = Date.UTC(2026, 5, 29, 10);
    let daypartContrast = false;
    let specialContrast = false;
    for (
      let index = 0;
      index < 2_000 && (!daypartContrast || !specialContrast);
      index += 1
    ) {
      const seed = `pity-multiplier-${index}`;
      const baseline = opportunityCauseAt(seed, 99, ordinary);
      if (!daypartContrast)
        daypartContrast =
          baseline !== 'stream' &&
          opportunityCauseAt(seed, 99, boostedDaypart) === 'stream';
      if (!specialContrast)
        specialContrast =
          baseline !== 'stream' &&
          opportunityCauseAt(seed, 99, specialDate) === 'stream';
    }

    expect(daypartContrast).toBe(true);
    expect(specialContrast).toBe(true);
  });

  test('an ordinary stream winner resets the drought timestamp when selected', () => {
    let selected: GameState | undefined;
    for (let index = 0; index < 100 && !selected; index += 1) {
      const seed = `pity-reset-${index}`;
      const result = dispatchCommand(
        eligibleRun(seed, 100),
        {
          type: 'use_item',
          commandId: 'ordinary-stream-selection',
          itemId: 'missing',
          now: NOW,
        },
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (
        result.events.some(
          (event) =>
            event.type === 'random_event_opportunity' &&
            event.cause === 'stream',
        )
      )
        selected = result;
    }

    expect(selected?.progression.lastAutonomousStreamSelectedAt).toBe(NOW);
  });

  test('pity accrues unchanged while an ordinary stream is blocked', () => {
    const initial = eligibleRun('blocked-pity', 100);
    const result = dispatchCommand(
      {
        ...initial,
        statuses: { sick: { since: NOW, source: 'test' } },
      },
      {
        type: 'use_item',
        commandId: 'blocked-pity-opportunity',
        itemId: 'missing',
        now: NOW,
      },
      BUNDLED_GAME_DEFINITION,
    ).state;

    expect(result.progression.lastAutonomousStreamSelectedAt).toBe(
      NOW - 100 * HOUR,
    );
  });

  test.each(['tournament', 'model_debut'] as const)(
    'a forced %s stream does not reset ordinary stream pity',
    (type) => {
      const now = Date.UTC(2026, 0, 2, 14);
      const initial = eligibleRunAt(`queued-${type}`, 100, now);
      const result = dispatchCommand(
        {
          ...initial,
          progression: {
            ...initial.progression,
            queuedEventStreams: [
              {
                id: `queued-${type}`,
                type,
                queuedAt: now - HOUR,
                durationHours: 4,
                donationMultiplier: 1,
              },
            ],
          },
        },
        {
          type: 'use_item',
          commandId: `queued-${type}-opportunity`,
          itemId: 'missing',
          now,
        },
        BUNDLED_GAME_DEFINITION,
      ).state;

      expect(result.progression.lastAutonomousStreamSelectedAt).toBe(
        now - 100 * HOUR,
      );
    },
  );

  test('a too-tired ordinary winner still resets pity', () => {
    let selected: GameState | undefined;
    for (let index = 0; index < 100 && !selected; index += 1) {
      const initial = eligibleRun(`too-tired-reset-${index}`, 100);
      const result = dispatchCommand(
        { ...initial, metrics: { ...initial.metrics, rest: 0 } },
        {
          type: 'use_item',
          commandId: 'too-tired-stream-selection',
          itemId: 'missing',
          now: NOW,
        },
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (
        result.events.some(
          (event) =>
            event.type === 'stream_candidate' &&
            event.message.includes('too tired'),
        )
      )
        selected = result;
    }

    expect(selected?.progression.lastAutonomousStreamSelectedAt).toBe(NOW);
  });

  test('a local-midnight-capped ordinary stream resets pity', () => {
    const now = Date.UTC(2026, 0, 2, 23, 30);
    const midnight = Date.UTC(2026, 0, 3);
    let selected: GameState | undefined;
    for (let index = 0; index < 100 && !selected; index += 1) {
      const initial = eligibleRunAt(`midnight-reset-${index}`, 100, now);
      const result = dispatchCommand(
        initial,
        {
          type: 'use_item',
          commandId: 'midnight-capped-selection',
          itemId: 'missing',
          now,
        },
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (result.activity?.type === 'stream') selected = result;
    }

    expect({
      endsAt: selected?.activity?.endsAt,
      lastSelectedAt: selected?.progression.lastAutonomousStreamSelectedAt,
    }).toEqual({ endsAt: midnight, lastSelectedAt: now });
  });

  test('an interrupted ordinary stream keeps its selection reset', () => {
    let selected: GameState | undefined;
    for (let index = 0; index < 100 && !selected; index += 1) {
      const initial = eligibleRun(`interrupted-reset-${index}`, 100);
      const result = dispatchCommand(
        initial,
        {
          type: 'use_item',
          commandId: 'interrupted-stream-selection',
          itemId: 'missing',
          now: NOW,
        },
        BUNDLED_GAME_DEFINITION,
      ).state;
      if (result.activity?.type === 'stream') selected = result;
    }

    const interrupted = reconcileTime(
      {
        ...selected!,
        metrics: { ...selected!.metrics, food: 2 },
      },
      NOW + 1,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect({
      interrupted: interrupted.events.some(
        (event) => event.type === 'activity_interrupted',
      ),
      lastSelectedAt: interrupted.progression.lastAutonomousStreamSelectedAt,
    }).toEqual({ interrupted: true, lastSelectedAt: NOW });
  });
});
