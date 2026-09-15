import { expect, test } from 'vitest';
import { BUNDLED_GAME_DEFINITION as definition } from '../test-game-definition';
import { dispatchCommand, startRun } from '../game-engine';
import type { GameEvent } from '../game-types';
import { selectQuote, transitionSpeech } from './companion-speech';

function initial() {
  return startRun(
    { mode: 'realtime', now: 0, seed: '12345678', timezone: 'UTC' },
    definition,
  );
}

test.each(['buy_item', 'checkout_cart'] as const)(
  '%s does not trigger purchase speech',
  (type) => {
    const before = initial();
    before.balance = 1000;
    before.shop.itemIds = ['water', 'socks-plushie'];
    before.shop.stock = { water: 2, 'socks-plushie': 2 };
    before.shop.cart = { water: 1, 'socks-plushie': 1 };
    const command = {
      type,
      itemId: 'water',
      commandId: 'purchase',
      now: 0,
    };
    const result = dispatchCommand(before, command, definition);
    expect(result.outcomes[0].accepted).toBe(true);
    const session = {
      state: result.state,
      definition,
      command,
      outcome: result.outcomes[0],
    };
    const pools = {
      'buy_item:water': ['Water quote'],
      buy_item: ['General purchase'],
      'event:item_purchased': ['Item purchase event'],
      'event:cart_checked_out': ['Checkout event'],
    };
    const snapshot = structuredClone(result.state);
    expect(transitionSpeech(before, session, 1, pools)).toBeNull();
    expect(transitionSpeech(before, session, 1)).toBeNull();
    expect(result.state).toEqual(snapshot);
    expect(
      transitionSpeech(
        before,
        {
          ...session,
          state: before,
          outcome: { ...session.outcome, accepted: false },
        },
        1,
        pools,
      ),
    ).toBeNull();
  },
);

test('non-food use and item actions share dedicated item-use fallback quotes', () => {
  const state = initial();
  const pools = {
    'use_item:3d-printer': ['Item-specific use'],
    use_item: ['General use'],
  };
  const outcome = {
    accepted: true,
    kind: 'item_used',
    message: '',
    eventIds: [],
  };
  for (const command of [
    {
      type: 'use_item' as const,
      itemId: '3d-printer',
      commandId: 'use',
      now: 0,
    },
    {
      type: 'perform_item_action' as const,
      itemId: '3d-printer',
      action: 'print',
      commandId: 'print',
      now: 0,
    },
  ]) {
    const trigger = transitionSpeech(
      state,
      { state, definition, command, outcome },
      1,
      pools,
    )!;
    expect(selectQuote(pools, trigger, state)).toBe('Item-specific use');
  }
});

test.each([
  [
    {
      type: 'life_event_resolved',
      lifeEventId: 'twitter_cancellation',
      selectedOutcomeId: 'minor',
    },
    'life_event:twitter_cancellation:minor',
  ],
  [{ type: 'status_added', status: 'hungry' }, 'status:hungry:added'],
  [{ type: 'status_cleared', status: 'hungry' }, 'status:hungry:cleared'],
  [{ type: 'rain' }, 'event:rain'],
] as const)(
  'supports specific event and status transitions: %s',
  (fields, key) => {
    const before = initial();
    const event: GameEvent = { id: 'new-event', at: 0, message: '', ...fields };
    const state = { ...before, events: [...before.events, event] };
    const pools = { [key]: ['Specific event'] };
    const trigger = transitionSpeech(before, { state, definition }, 1, pools)!;
    expect(selectQuote(pools, trigger, state)).toBe('Specific event');
    expect(transitionSpeech(before, { state, definition }, 1, {})).toBeNull();
  },
);

test('return-to-idle quotes are available when the activity completion pool is empty', () => {
  const before = initial();
  before.activity = {
    type: 'play',
    id: 'playing',
    startedAt: 0,
    endsAt: 1000,
    sourceActionId: 'play',
  };
  const event: GameEvent = {
    id: 'complete',
    at: 1000,
    message: '',
    type: 'activity_completed',
    activityType: 'play',
  };
  const state = {
    ...before,
    now: 1000,
    activity: null,
    events: [...before.events, event],
  };
  const pools = { 'idle:from_play': ['Back to idle'] };
  const trigger = transitionSpeech(before, { state, definition }, 1, pools)!;
  expect(selectQuote(pools, trigger, state)).toBe('Back to idle');
  const streamingTrigger = transitionSpeech(
    { ...before, activity: null },
    { state, definition },
    1,
    pools,
  )!;
  expect(selectQuote(pools, streamingTrigger, state)).toBe('Back to idle');
});

test('hourly idle speech prefers an active status pool and falls back to idle', () => {
  const before = initial();
  const state = {
    ...before,
    now: 3_600_000,
    statuses: { hungry: { since: 0, source: 'test' } },
  };
  const pools = { 'idle:hungry': ['Hungry idle'], idle: ['General idle'] };
  const trigger = transitionSpeech(before, { state, definition }, 1, pools)!;
  expect(selectQuote(pools, trigger, state)).toBe('Hungry idle');
  expect(selectQuote({ idle: ['General idle'] }, trigger, state)).toBe(
    'General idle',
  );
});
