import { describe, expect, test } from 'vitest';

import { BUNDLED_GAME_DEFINITION } from './game-definition';
import { dispatchCommand, reconcileTime } from './game-engine';
import type { GameState } from './game-types';
import rules from './data/simulation-rules.json';
import { actionRandom } from './seeded-rng';
import { streamWeightDiagnostics } from './stream-rules';
import {
  eligibleRun,
  eligibleRunAt,
  HOUR,
  NOW,
  opportunityCause,
  opportunityCauseAt,
} from './stream-protection-test-fixtures';

describe('autonomous stream drought protection', () => {
  test('the stream weight begins ramping after the 12-hour grace window', () => {
    let contrast:
      { grace: string | undefined; ramped: string | undefined } | undefined;
    for (let index = 0; index < 10_000 && !contrast; index += 1) {
      const seed = `pity-ramp-${index}`;
      const grace = opportunityCause(seed, 12);
      const ramped = opportunityCause(seed, 13);
      if (grace !== 'stream' && ramped === 'stream')
        contrast = { grace, ramped };
    }

    expect(contrast?.grace).not.toBe('stream');
    expect(contrast?.ramped).toBe('stream');
  });

  test.each([
    [12, 0],
    [13, 6],
    [61, 294],
    [62, 300],
    [1_000, 300],
  ])('at %i drought hours the bonus is %i', (hours, expected) => {
    expect(
      streamWeightDiagnostics(eligibleRun('pity-bounds', hours), 'pity-bounds')
        .streamDroughtBonus,
    ).toBe(expected);
  });

  test('adds the flat bonus before final multipliers', () => {
    const state = eligibleRun('flat-bonus', 0);
    const commandId = 'flat-bonus';
    const diagnostics = streamWeightDiagnostics(state, commandId);
    const roll = actionRandom(
      state.seed,
      state.stateVersion,
      commandId,
      'autonomous_event',
      'stream',
    );

    expect(diagnostics.streamFlatBonus).toBe(20);
    expect(diagnostics.streamRawWeight).toBe(
      rules.stream.weight.base * roll + 20,
    );
    expect(diagnostics.streamFinalWeight).toBe(diagnostics.streamRawWeight);
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

  test('an ordinary stream resets the drought anchor only after qualifying completion', () => {
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

    const oldAnchor = NOW - 100 * HOUR;
    expect(selected?.progression.lastQualifyingOrdinaryStreamStartedAt).toBe(
      oldAnchor,
    );
    const completed = reconcileTime(
      selected!,
      selected!.activity!.endsAt,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect(completed.progression.lastQualifyingOrdinaryStreamStartedAt).toBe(
      NOW,
    );
    expect(
      completed.events.find(
        (event) =>
          event.type === 'activity_completed' &&
          event.activityType === 'stream',
      ),
    ).toMatchObject({
      ordinaryStream: true,
      droughtResetQualified: true,
      droughtResetAnchorAt: NOW,
    });
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

    expect(result.progression.lastQualifyingOrdinaryStreamStartedAt).toBe(
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

      expect(result.progression.lastQualifyingOrdinaryStreamStartedAt).toBe(
        now - 100 * HOUR,
      );
    },
  );

  test('a too-tired ordinary winner preserves the drought anchor', () => {
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

    expect(selected?.progression.lastQualifyingOrdinaryStreamStartedAt).toBe(
      NOW - 100 * HOUR,
    );
  });

  test('a local-midnight-capped ordinary stream preserves the drought anchor', () => {
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

    const completed = reconcileTime(
      selected!,
      midnight,
      BUNDLED_GAME_DEFINITION,
    ).state;
    expect({
      lastAnchor: completed.progression.lastQualifyingOrdinaryStreamStartedAt,
      completion: completed.events.find(
        (event) =>
          event.type === 'activity_completed' &&
          event.activityType === 'stream',
      ),
    }).toMatchObject({
      lastAnchor: now - 100 * HOUR,
      completion: {
        midnightCapped: true,
        droughtResetQualified: false,
      },
    });
  });

  test('an interrupted ordinary stream preserves the drought anchor', () => {
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
      lastAnchor: interrupted.progression.lastQualifyingOrdinaryStreamStartedAt,
    }).toEqual({ interrupted: true, lastAnchor: NOW - 100 * HOUR });
  });

  test.each([
    [59_000, false],
    [60_000, true],
  ])(
    'an otherwise qualifying %i-millisecond ordinary stream reset is %s',
    (duration, qualifies) => {
      const initial = eligibleRun(`minimum-${duration}`, 100);
      const activity: NonNullable<GameState['activity']> = {
        id: `minimum-${duration}`,
        type: 'stream',
        startedAt: NOW,
        endsAt: NOW + duration,
        sourceActionId: `minimum-${duration}`,
        payload: {
          ordinaryStream: true,
          intendedDurationMs: duration,
          midnightCapped: false,
          hourlyRate: 8,
          startingCriticalMetrics: '',
        },
      };
      const completed = reconcileTime(
        { ...initial, activity },
        activity.endsAt,
        BUNDLED_GAME_DEFINITION,
      ).state;
      expect(completed.progression.lastQualifyingOrdinaryStreamStartedAt).toBe(
        qualifies ? NOW : NOW - 100 * HOUR,
      );
      expect(
        completed.events.find(
          (event) =>
            event.type === 'activity_completed' &&
            event.sourceActionId === activity.sourceActionId,
        )?.droughtResetQualified,
      ).toBe(qualifies);
      expect(
        reconcileTime(completed, activity.endsAt, BUNDLED_GAME_DEFINITION)
          .state,
      ).toEqual(completed);
    },
  );
});
