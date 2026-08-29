import financialRules from '$lib/data/financial-rules.json';
import { LINE_OF_CREDIT_OFFER_ID } from '$lib/game-constants';
import type { GameState } from '$lib/game-types';
import type { ItemViewModel } from './item-view-model';

export type ShopOfferViewModel = {
  kind: 'catalogue_item' | 'line_of_credit';
  id: string;
  name: string;
  category: string;
  price: number;
  image: string | null;
  description: string;
  availabilityLabel: string;
  inCart: number;
  maximumCartQuantity: number;
  purchaseAllowed: boolean;
  resultingBalance: number;
  item: ItemViewModel | null;
};

export function catalogueShopOffer(item: ItemViewModel): ShopOfferViewModel {
  return {
    kind: 'catalogue_item',
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    image: item.image,
    description: item.description,
    availabilityLabel: `${item.stock} available`,
    inCart: item.inCart,
    maximumCartQuantity: item.maximumCartQuantity,
    purchaseAllowed: item.purchaseAllowed,
    resultingBalance: item.resultingBalance,
    item,
  };
}

export function lineOfCreditShopOffer(
  state: GameState,
): ShopOfferViewModel {
  const terms = financialRules.lineOfCredit;
  const lineOfCredit = state.lineOfCredit;
  const open = lineOfCredit.status === 'open';
  const available = lineOfCredit.status === 'available';
  const maximum = available
    ? 1
    : open
      ? lineOfCredit.remainingUnits
      : 0;
  const price = available ? terms.applicationPrice : terms.repaymentUnitPrice;
  return {
    kind: 'line_of_credit',
    id: LINE_OF_CREDIT_OFFER_ID,
    name: 'Line of Credit',
    category: 'financial',
    price,
    image: null,
    description: available
      ? `Open the Line of Credit for $${terms.applicationPrice.toLocaleString('en-US')} and receive $${terms.cashAdvance.toLocaleString('en-US')}.`
      : open
        ? `Repay the Line of Credit in $${terms.repaymentUnitPrice.toLocaleString('en-US')} units.`
        : 'This Line of Credit has been closed.',
    availabilityLabel: available
      ? '1 available'
      : open
        ? `${maximum} remaining`
        : 'Closed',
    inCart: state.shop.cart[LINE_OF_CREDIT_OFFER_ID] ?? 0,
    maximumCartQuantity: maximum,
    purchaseAllowed: maximum > 0,
    resultingBalance:
      state.balance - price + (available ? terms.cashAdvance : 0),
    item: null,
  };
}
