import type { GameDefinition, ItemDefinition } from '$lib/game-definition';
import type {
  GameCommand,
  GameEvent,
  GameState,
  MetricName,
  StatusName,
} from '$lib/game-types';
import { companion } from './companion';
import {
  actionOwnership,
  itemActionAvailable,
} from '$lib/item-action-prerequisites';
import { eventLabel, gameCopy, statusLabel } from './game-copy';

type CatalogueItem = ItemDefinition;
export type ItemActionViewModel = {
  id: string;
  label: string;
  available: boolean;
};

export type MetricViewModel = {
  key: MetricName;
  label: string;
  value: number;
  percentage: number;
};
export type ItemViewModel = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  edible: boolean;
  itemActions: ItemActionViewModel[];
  roomSlot: string | null;
  owned: number;
  stock: number;
  inCart: number;
  qualitativeHint: string;
  placedSlot: string | null;
};
export type EventViewModel = Pick<GameEvent, 'id' | 'at' | 'message'> & {
  label: string;
};
export type ActivityViewModel = {
  label: string;
  endsAt: number;
};
export type GameIntent =
  | { type: 'use_item'; itemId: string }
  | { type: 'item_action'; itemId: string; action: string }
  | { type: 'unplace_item'; slot: string }
  | { type: 'place_item'; itemId: string; slot: string }
  | { type: 'set_cart_quantity'; itemId: string; quantity: number }
  | { type: 'checkout_cart' }
  | { type: 'rest' | 'socialize' | 'play' | 'medical_care' | 'wait' };
export type GameViewModel = {
  companion: typeof companion;
  mode: GameState['mode'];
  modeLabel: string;
  now: number;
  formattedTime: string;
  timezone: string;
  seed: string;
  balance: number;
  metrics: MetricViewModel[];
  statuses: Array<{ key: StatusName; label: string }>;
  activity: ActivityViewModel | null;
  death: { at: number; cause: string } | null;
  eventCount: number;
  events: EventViewModel[];
  causalEvents: EventViewModel[];
  anchors: Array<{ key: string; label: string; item: ItemViewModel | null }>;
  inventory: ItemViewModel[];
  shop: ItemViewModel[];
  catalogue: ItemViewModel[];
  cart: ItemViewModel[];
  cartTotal: number;
  categories: string[];
};

const metricKeys: MetricName[] = [
  'food',
  'health',
  'mood',
  'rest',
  'bond',
  'creativity',
];
const anchorKeys = Object.keys(gameCopy.anchors);

function itemFor(
  state: GameState,
  definition: GameDefinition,
  id: string | undefined,
  ownership: ReturnType<typeof actionOwnership>,
): ItemViewModel | null {
  if (!id) return null;
  const item = definition.items.find((candidate) => candidate.id === id) as
    CatalogueItem | undefined;
  if (!item) return null;
  const owned = state.inventory[id] ?? 0;
  const placedSlot =
    Object.entries(state.room).find(([, placedId]) => placedId === id)?.[0] ??
    null;
  const itemActions = (item.itemActions ?? []).map((action) => ({
    id: action.id,
    label: action.label,
    available: itemActionAvailable(item.id, action, ownership),
  }));
  const presentationOwned = owned + (placedSlot ? 1 : 0);
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    image: item.image,
    description: item.description,
    edible: item.edible,
    itemActions,
    roomSlot: item.roomSlot ?? null,
    owned: presentationOwned,
    stock: state.shop.stock[id] ?? 0,
    inCart: state.shop.cart[id] ?? 0,
    qualitativeHint: item.qualitativeNutritionHint,
    placedSlot,
  };
}

function formatTime(value: number, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(value);
}

function personalizeEventMessage(message: string): string {
  return message.replace(/^Companion\b/, companion.name);
}

export function daypartFor(now: number, timezone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).format(new Date(now)),
  );
  return hour < 6
    ? 'night'
    : hour < 12
      ? 'morning'
      : hour < 18
        ? 'day'
        : hour < 22
          ? 'evening'
          : 'night';
}

export function createGameViewModel(
  state: GameState,
  definition: GameDefinition,
  locale = 'en-US',
): GameViewModel {
  const ownership = actionOwnership(
    state.inventory,
    state.room,
    definition.items,
  );
  const catalogue = definition.items
    .map((item) => itemFor(state, definition, item.id, ownership))
    .filter((item): item is ItemViewModel => Boolean(item));
  const inventory = catalogue.filter((item) => item.owned > 0);
  const shop = state.shop.itemIds
    .map((id) => itemFor(state, definition, id, ownership))
    .filter((item): item is ItemViewModel => Boolean(item));
  const cart = Object.keys(state.shop.cart)
    .map((id) => itemFor(state, definition, id, ownership))
    .filter((item): item is ItemViewModel => Boolean(item));
  const causalEvents = state.death
    ? state.events.filter((event) => state.death?.eventIds.includes(event.id))
    : [];
  const events = state.events.map((event) => ({
    id: event.id,
    at: event.at,
    message: personalizeEventMessage(event.message),
    label: eventLabel(event.type),
  }));
  const causalEventViews = causalEvents.map((event) => ({
    id: event.id,
    at: event.at,
    message: personalizeEventMessage(event.message),
    label: eventLabel(event.type),
  }));
  return {
    companion,
    mode: state.mode,
    modeLabel: gameCopy.mode[state.mode],
    now: state.now,
    formattedTime: formatTime(state.now, state.timezone, locale),
    timezone: state.timezone,
    seed: state.seed,
    balance: state.balance,
    metrics: metricKeys.map((key) => ({
      key,
      label: gameCopy.metrics[key],
      value: state.metrics[key],
      percentage: state.metrics[key] * 10,
    })),
    statuses: (Object.keys(state.statuses) as StatusName[]).map((key) => ({
      key,
      label: statusLabel(key),
    })),
    activity: state.activity
      ? {
          label: gameCopy.activity[state.activity.type],
          endsAt: state.activity.endsAt,
        }
      : null,
    death: state.death
      ? { at: state.death.at, cause: state.death.cause }
      : null,
    eventCount: state.events.length,
    events,
    causalEvents: causalEventViews,
    anchors: anchorKeys.map((key) => ({
      key,
      label: gameCopy.anchors[key as keyof typeof gameCopy.anchors],
      item: itemFor(state, definition, state.room[key], ownership),
    })),
    inventory,
    shop,
    catalogue,
    cart,
    cartTotal: cart.reduce((sum, item) => sum + item.price * item.inCart, 0),
    categories: [...new Set(shop.map((item) => item.category))].sort(),
  };
}

export function intentToCommand(
  intent: GameIntent,
  state: GameState,
  commandId: string,
): GameCommand {
  const base = {
    commandId,
    now: state.mode === 'realtime' ? Date.now() : state.now,
    expectedStateVersion: state.stateVersion,
  } as const;
  if (intent.type === 'use_item')
    return { ...base, type: 'use_item', itemId: intent.itemId };
  if (intent.type === 'item_action')
    return {
      ...base,
      type: 'perform_item_action',
      itemId: intent.itemId,
      action: intent.action,
    };
  if (intent.type === 'unplace_item')
    return { ...base, type: 'unplace_item', slot: intent.slot };
  if (intent.type === 'place_item')
    return {
      ...base,
      type: 'place_item',
      itemId: intent.itemId,
      slot: intent.slot,
    };
  if (intent.type === 'set_cart_quantity')
    return {
      ...base,
      type: 'set_cart_quantity',
      itemId: intent.itemId,
      quantity: intent.quantity,
    };
  if (intent.type === 'checkout_cart')
    return { ...base, type: 'checkout_cart' };
  return { ...base, type: intent.type } as GameCommand;
}
