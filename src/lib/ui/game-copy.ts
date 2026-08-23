export const gameCopy = {
  room: 'Room',
  shop: 'Shop',
  cart: 'Cart',
  inventory: 'Inventory',
  history: 'History',
  settings: 'Settings',
  mode: { realtime: 'Realtime mode', streaming: 'Streaming mode' },
  metrics: {
    food: 'Food',
    health: 'Health',
    mood: 'Mood',
    rest: 'Rest',
    bond: 'Bond',
    creativity: 'Creativity',
  },
  anchors: {
    bed: 'Bed',
    desk: 'Desk',
    chair: 'Chair',
    wall: 'Wall',
    floor: 'Floor',
    shelf: 'Shelf',
    window: 'Window',
    'cat-corner': 'Cat corner',
  },
  care: {
    feed: 'Feed',
    rest: 'Rest',
    socialize: 'Socialize',
    play: 'Play',
    wait: 'Wait',
    medical: 'Hospital',
  },
  activity: {
    rest: 'resting',
    socialize: 'socializing',
    play: 'playing',
    stream: 'streaming',
    medical_care: 'at the hospital',
    commission_work: 'working on a commission',
  },
  empty: {
    run: 'Starting…',
    inventory: 'Nothing is here yet.',
    cart: 'Your cart is empty.',
  },
} as const;

export const statusLabel = (value: StatusName) => statusDisplayName(value);

import { statusDisplayName } from '$lib/event-messages';
import type { StatusName } from '$lib/game-types';
