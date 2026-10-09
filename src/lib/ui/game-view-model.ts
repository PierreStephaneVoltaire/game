import type { GameDefinition } from '$lib/game-definition';
import type { GameState, StatusName } from '$lib/game-types';
import { companionFromDefinition, type CompanionProfile } from './companion';
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
import {
  ADVANCE_TIME_HOURS,
  LINE_OF_CREDIT_OFFER_ID,
} from '$lib/game-constants';
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
import {
  careActionChoices,
  roomPlacementChoices,
  roomActionChoices,
  type InventoryActionChoice,
} from './room-action-view-model';
import { metricPresentation, type MetricViewModel } from './metric-view-model';
export type { ItemActionViewModel, ItemViewModel } from './item-view-model';
export type { ShopOfferViewModel } from './shop-offer-view-model';
export type { EndingRiskViewModel, EndingViewModel } from './ending-view-model';
export type { MetricViewModel } from './metric-view-model';
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
  | { type: 'wait'; hours?: number }
  | { type: 'rest' | 'socialize' | 'play' | 'medical_care' };
export type GameViewModel = {
  companion: CompanionProfile;
  mode: GameState['mode'];
  waitHours: number[];
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
  careChoices: {
    socialize: InventoryActionChoice[];
    play: InventoryActionChoice[];
  };
  roomChoices: InventoryActionChoice[];
  anchors: Array<{
    key: string;
    label: string;
    item: ItemViewModel | null;
    placementChoices: InventoryActionChoice[];
  }>;
  inventory: ItemViewModel[];
  shop: ShopOfferViewModel[];
  catalogue: ItemViewModel[];
  cart: ShopOfferViewModel[];
  cartTotal: number;
  cartResultingBalance: number;
  cartCheckoutAllowed: boolean;
  categories: string[];
};

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
  const companion = companionFromDefinition(definition);
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
    waitHours: ADVANCE_TIME_HOURS,
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
    metrics: metricPresentation(state),
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
    careChoices: {
      socialize: careActionChoices(state, definition, ownership, 'mood'),
      play: careActionChoices(state, definition, ownership, 'creativity'),
    },
    roomChoices: roomActionChoices(state, definition, ownership),
    anchors: anchorKeys.map((key) => ({
      key,
      label: gameCopy.anchors[key as keyof typeof gameCopy.anchors],
      item: itemFor(state, definition, state.room[key], ownership),
      placementChoices: roomPlacementChoices(state, definition, key),
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
      (state.balance < 0 || cartTotal <= state.balance) &&
      !(
        state.lineOfCredit.status === 'open' &&
        state.balance <
          (state.shop.cart[LINE_OF_CREDIT_OFFER_ID] ?? 0) *
            finances.lineOfCredit.repaymentUnitPrice
      ),
    categories: [...new Set(shop.map((item) => item.category))].sort(),
  };
}

export { intentToCommand } from './intent-command';
