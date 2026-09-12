import { expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { dispatchCommand, startRun } from '../game-engine';
import { HOUR_MS } from '../game-constants';
import type { Activity, GameEvent, GameState } from '../game-types';
import {
  clickSpeech,
  loadQuotes,
  nextSpeechBoundary,
  selectQuote,
  speechAllowed,
  transitionSpeech as resolveSpeech,
} from './companion-speech';

function initial(): GameState {
  return startRun(
    { mode: 'realtime', now: 0, seed: 'quotes-test', timezone: 'UTC' },
    definition,
  );
}

function activity(type: Activity['type']): Activity {
  return {
    id: 'activity-1',
    type,
    startedAt: 0,
    endsAt: 2 * HOUR_MS,
    sourceActionId: 'test',
  };
}

function transitionSpeech(
  before: GameState,
  session: Parameters<typeof resolveSpeech>[1],
) {
  return resolveSpeech(before, session, 1);
}

test('hourly speech follows game hours and collapses jumps to one current quote', () => {
  const before = initial();
  for (const context of [null, activity('stream')]) {
    expect(
      transitionSpeech(before, {
        definition,
        state: { ...before, activity: context, now: HOUR_MS - 1 },
      }),
    ).toBeNull();
    const state = { ...before, activity: context, now: 8 * HOUR_MS };
    expect(transitionSpeech(before, { definition, state })).toEqual({
      id: 'hour:8',
      pools: [context ? 'stream' : 'idle'],
    });
    expect(transitionSpeech(state, { definition, state })).toBeNull();
  }
  expect(
    transitionSpeech(before, {
      definition,
      state: { ...before, now: HOUR_MS, activity: activity('play') },
    }),
  ).toBeNull();
  expect(
    nextSpeechBoundary(
      {
        ...before,
        activity: { ...activity('play'), endsAt: HOUR_MS / 2 },
      },
      1,
    ),
  ).toBe(HOUR_MS / 2);
});

test.each(['rest', 'medical_care'] as const)(
  'suppresses all speech during %s and allows its completion',
  (type) => {
    const before = initial();
    const state = { ...before, activity: activity(type), now: HOUR_MS };
    expect(speechAllowed(state)).toBe(false);
    expect(
      selectQuote({ click: ['test quote'] }, clickSpeech(state, 1), state),
    ).toBe('');
    expect(transitionSpeech(before, { definition, state })).toBeNull();
    const event: GameEvent = {
      id: 'completed',
      type: 'activity_completed',
      activityType: type,
      at: 2 * HOUR_MS,
      message: '',
    };
    expect(
      transitionSpeech(state, {
        definition,
        state: {
          ...state,
          activity: null,
          now: event.at,
          events: [...state.events, event],
        },
      })?.pools,
    ).toEqual([`${type}:complete`]);
  },
);

test('recognizes actual stream starts and latest awake transitions ahead of hourly speech', () => {
  const before = initial();
  const event: GameEvent = {
    id: 'start',
    type: 'stream_candidate',
    activityType: 'stream',
    streamActivityStarted: true,
    at: HOUR_MS,
    message: '',
  };
  const state = {
    ...before,
    now: HOUR_MS,
    activity: activity('stream'),
    events: [...before.events, event],
  };
  expect(transitionSpeech(before, { definition, state })?.pools).toEqual([
    'stream:start',
    'stream',
  ]);
  const interrupted: GameEvent = {
    ...event,
    id: 'stop',
    type: 'activity_interrupted',
    streamActivityStarted: undefined,
  };
  expect(
    transitionSpeech(before, {
      definition,
      state: { ...state, events: [...state.events, interrupted] },
    })?.pools,
  ).toEqual(['stream:interrupt', 'stream']);
  expect(
    transitionSpeech(before, {
      definition,
      state: {
        ...before,
        events: [...before.events, { ...event, streamActivityStarted: false }],
      },
    }),
  ).toBeNull();
});

test('real batch feeding responds once to the last consumed food and preserves simulation state', () => {
  const state = initial();
  const foods = definition.items
    .filter((item) => item.edible && item.id.includes('water'))
    .slice(0, 2);
  expect(foods).toHaveLength(2);
  state.inventory = Object.fromEntries(foods.map((item) => [item.id, 2]));
  const command = {
    type: 'feed_items' as const,
    commandId: 'feed',
    now: 0,
    items: foods.map((item) => ({ itemId: item.id, quantity: 1 })),
  };
  const transition = dispatchCommand(state, command, definition);
  expect(transition.outcomes[0].accepted).toBe(true);
  const snapshot = structuredClone(transition.state);
  const consumed = transition.state.events
    .filter(
      (event) => event.type === 'item_used' && event.itemUseMode === 'manual',
    )
    .at(-1)!;
  expect(
    transitionSpeech(state, {
      definition,
      state: transition.state,
      command,
      outcome: transition.outcomes[0],
    })?.pools,
  ).toEqual([`feed:${consumed.itemId}`, 'feed']);
  expect(transition.state).toEqual(snapshot);
});

test('accepted item actions use overrides and rejected actions stay silent', () => {
  const before = initial();
  const command = {
    type: 'perform_item_action' as const,
    commandId: 'item',
    now: 0,
    itemId: '3d-printer',
    action: 'print',
  };
  const outcome = {
    accepted: true,
    kind: 'item_action_performed',
    message: '',
    eventIds: [],
  };
  expect(
    transitionSpeech(before, { definition, state: before, command, outcome })
      ?.pools,
  ).toEqual(['item_action:3d-printer:print', 'item_action']);
  expect(
    transitionSpeech(before, {
      definition,
      state: before,
      command,
      outcome: { ...outcome, accepted: false },
    }),
  ).toBeNull();
});

test('clicks use contextual overrides, seeded selection, non-repetition and empty fallbacks', () => {
  const state = { ...initial(), activity: activity('stream') };
  const trigger = clickSpeech(state, 1);
  const pools = { click: ['general'], 'click:stream': ['one', 'two'] };
  const first = selectQuote(pools, trigger, state);
  expect(selectQuote(pools, trigger, state)).toBe(first);
  expect(selectQuote(pools, clickSpeech(state, 2), state, first)).not.toBe(
    first,
  );
  expect(
    selectQuote({ click: ['general'], 'click:stream': [] }, trigger, state),
  ).toBe('general');
  expect(selectQuote({}, trigger, state)).toBe('');
  const ended = { ...state, ending: {} as NonNullable<GameState['ending']> };
  expect(selectQuote(pools, trigger, ended)).toBe('');
});

test('quote loading validates the response and treats failures as unavailable content', async () => {
  for (const value of [
    null,
    [],
    { click: 'text' },
    { click: [' '] },
    { click: [3] },
    { 'bad key': ['text'] },
  ]) {
    expect(
      await loadQuotes(async () => new Response(JSON.stringify(value))),
    ).toEqual({});
  }
  expect(
    await loadQuotes(async () => {
      throw new Error('offline');
    }),
  ).toEqual({});
  expect(
    await loadQuotes(async () => new Response('', { status: 503 })),
  ).toEqual({});
  const quotes = { 'item_action:3d-printer:print': ['<b>literal text</b>'] };
  expect(
    await loadQuotes(async () => new Response(JSON.stringify(quotes))),
  ).toEqual(quotes);
});
