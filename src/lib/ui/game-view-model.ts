import type { GameDefinition } from '$lib/game-definition';
import type {
  GameCommand,
  GameState,
  MetricName,
  StatusName,
} from '$lib/game-types';
import { companion } from './companion';
import { gameCopy, statusLabel } from './game-copy';
import {
  projectCausalJourney,
  projectJourney,
  type JourneyEntryViewModel,
} from './journey-events';
import {
  createActionOwnership,
  itemFor,
  type ItemViewModel,
} from './item-view-model';
import {
  progressionPresentation,
  type CareerViewModel,
  type HospitalViewModel,
  type ProjectViewModel,
  type TimedEffectViewModel,
} from './progression-view-model';
import type { CompanionAppearance } from './companion';
import { LINE_OF_CREDIT_OFFER_ID, metricMaximum } from '$lib/game-constants';
import {
  endingPresentation,
  endingRiskPresentation,
  type EndingRiskViewModel,
  type EndingViewModel,
} from './ending-view-model';
import {
  financialPresentation,
  type FinancialViewModel,
} from './financial-view-model';
import {
  catalogueShopOffer,
  lineOfCreditShopOffer,
  type ShopOfferViewModel,
} from './shop-offer-view-model';

export type { ItemActionViewModel, ItemViewModel } from './item-view-model';
export type { ShopOfferViewModel } from './shop-offer-view-model';
export type { EndingRiskViewModel, EndingViewModel } from './ending-view-model';

export type MetricViewModel = {
  key: MetricName;
  label: string;
  value: number;
  maximum: number;
  percentage: number;
};
export type EventViewModel = JourneyEntryViewModel;
export type ActivityViewModel = {
  label: string;
  endsAt: number;
};
export type GameIntent =
  | { type: 'use_item'; itemId: string }
  | { type: 'feed_items'; items: Array<{ itemId: string; quantity: number }> }
  | { type: 'item_action'; itemId: string; action: string }
  | { type: 'unplace_item'; slot: string }
  | { type: 'place_item'; itemId: string; slot: string }
  | { type: 'set_cart_quantity'; itemId: string; quantity: number }
  | { type: 'checkout_cart' }
  | { type: 'pay_medical_debt' }
  | { type: 'rest' | 'socialize' | 'play' | 'medical_care' | 'wait' };
export type GameViewModel = {
  companion: typeof companion;
  mode: GameState['mode'];
  modeLabel: string;
  now: number;
  runStartedAt: number;
  formattedTime: string;
  timezone: string;
  seed: string;
  stateVersion?: number;
  balance: number;
  medicalDebt: FinancialViewModel['medicalDebt'];
  followers: number;
  peakFollowers: number;
  streamStats: GameState['progression']['streamStats'];
  career: CareerViewModel;
  debt: FinancialViewModel['debt'];
  lineOfCredit: FinancialViewModel['lineOfCredit'];
  madeItUnlocked: boolean;
  effects: TimedEffectViewModel[];
  projects: ProjectViewModel[];
  activeAvatar: CompanionAppearance;
  hospital: HospitalViewModel;
  metrics: MetricViewModel[];
  statuses: Array<{ key: StatusName; label: string }>;
  endingRisks: EndingRiskViewModel[];
  activity: ActivityViewModel | null;
  ending: EndingViewModel | null;
  commandsDisabled: boolean;
  events: EventViewModel[];
  causalEvents: EventViewModel[];
  anchors: Array<{ key: string; label: string; item: ItemViewModel | null }>;
  inventory: ItemViewModel[];
  shop: ShopOfferViewModel[];
  catalogue: ItemViewModel[];
  cart: ShopOfferViewModel[];
  cartTotal: number;
  cartResultingBalance: number;
  cartCheckoutAllowed: boolean;
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

function formatTime(value: number, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(value);
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
  const ownership = createActionOwnership(state, definition);
  const catalogue = definition.items
    .map((item) => itemFor(state, definition, item.id, ownership))
    .filter((item): item is ItemViewModel => Boolean(item));
  const inventory = catalogue.filter((item) => item.owned > 0);
  const shopItems = state.shop.itemIds
    .map((id) => itemFor(state, definition, id, ownership))
    .filter((item): item is ItemViewModel => Boolean(item));
  const shop = [
    lineOfCreditShopOffer(state),
    ...shopItems.map(catalogueShopOffer),
  ];
  const cart = Object.keys(state.shop.cart)
    .map((id) => shop.find((offer) => offer.id === id))
    .filter((offer): offer is ShopOfferViewModel => Boolean(offer));
  const events = projectJourney(state.events, companion.name, state.seed);
  const finances = financialPresentation(state);
  const causalEventViews = state.ending
    ? projectCausalJourney(
        state.events,
        state.ending.eventIds,
        companion.name,
        state.seed,
      )
    : [];
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.inCart,
    0,
  );
  const cartCheckoutAllowed =
    cart.length > 0 &&
    cart.every(
      (item) => item.purchaseAllowed && item.inCart <= item.maximumCartQuantity,
    );
  return {
    companion,
    mode: state.mode,
    modeLabel: gameCopy.mode[state.mode],
    now: state.now,
    runStartedAt: state.history.runStartedAt,
    formattedTime: formatTime(state.now, state.timezone, locale),
    timezone: state.timezone,
    seed: state.seed,
    stateVersion: state.stateVersion,
    balance: state.balance,
    ...finances,
    madeItUnlocked: state.endingUnlocks.made_it !== null,
    ...progressionPresentation(state, definition),
    metrics: metricKeys.map((key) => {
      const maximum = metricMaximum(key);
      return {
        key,
        label: gameCopy.metrics[key],
        value: state.metrics[key],
        maximum,
        percentage: (state.metrics[key] / maximum) * 100,
      };
    }),
    endingRisks: endingRiskPresentation(state),
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
    ending: endingPresentation(state),
    commandsDisabled: state.ending !== null,
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
    cartTotal,
    cartResultingBalance:
      state.balance -
      cartTotal +
      (state.lineOfCredit.status === 'available' &&
      (state.shop.cart[LINE_OF_CREDIT_OFFER_ID] ?? 0) === 1
        ? finances.lineOfCredit.cashAdvance
        : 0),
    cartCheckoutAllowed:
      cartCheckoutAllowed &&
      !(
        state.lineOfCredit.status === 'open' &&
        state.balance <
          (state.shop.cart[LINE_OF_CREDIT_OFFER_ID] ?? 0) *
            finances.lineOfCredit.repaymentUnitPrice
      ),
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
  if (intent.type === 'feed_items')
    return { ...base, type: 'feed_items', items: intent.items };
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
  if (intent.type === 'pay_medical_debt')
    return { ...base, type: 'pay_medical_debt' };
  return { ...base, type: intent.type } as GameCommand;
}
