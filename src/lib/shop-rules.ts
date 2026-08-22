import { actionRandom } from './seeded-rng';
import type { GameDefinition } from './game-definition';
import type { GameState, ShopState } from './game-types';
import rules from './data/simulation-rules.json';
import { DAY_MS, HOUR_MS, LOCAL_MIDNIGHT_SEARCH_HOURS } from './game-constants';

export function rotateShop(
  state: GameState,
  definition: GameDefinition,
  date: string,
): ShopState {
  const candidates = [...definition.items].sort(
    (a, b) =>
      actionRandom(
        state.seed,
        state.stateVersion,
        date,
        'shop_rotation',
        a.id,
      ) -
      actionRandom(state.seed, state.stateVersion, date, 'shop_rotation', b.id),
  );
  const chosen: typeof candidates = [];
  const take = (
    count: number,
    eligible: (item: (typeof candidates)[number]) => boolean,
  ) => {
    for (const item of candidates)
      if (
        chosen.length < rules.shop.maximumItems &&
        eligible(item) &&
        !chosen.includes(item)
      ) {
        chosen.push(item);
        if (chosen.filter(eligible).length >= count) break;
      }
  };
  take(rules.shop.mix.food, (item) => item.category === 'food');
  take(
    rules.shop.mix.medicineOrCare,
    (item) => item.category === 'medicine' || item.category === 'care',
  );
  take(rules.shop.mix.reusable, (item) => item.category === 'reusable');
  take(rules.shop.mix.upgrade, (item) => item.category === 'upgrade');
  take(rules.shop.mix.decoration, (item) => item.category === 'decoration');

  const replaceFood = (
    eligible: (item: (typeof candidates)[number]) => boolean,
    preserveAffordable = false,
  ) => {
    if (chosen.some(eligible)) return;
    const replacement = candidates.find(
      (item) => eligible(item) && !chosen.includes(item),
    );
    const affordableCount = chosen.filter(
      (item) => item.edible && item.price <= state.balance,
    ).length;
    const replaceAt = chosen.findIndex(
      (item) =>
        item.category === 'food' &&
        (!preserveAffordable ||
          item.price > state.balance ||
          affordableCount > rules.shop.guarantees.minimumAffordableCount),
    );
    if (replacement && replaceAt >= 0) chosen[replaceAt] = replacement;
  };
  if (rules.shop.guarantees.affordableFood)
    replaceFood((item) => item.edible && item.price <= state.balance);
  if (rules.shop.guarantees.hydratingFood)
    replaceFood(
      (item) =>
        item.edible &&
        (item.tags.includes('hydrating') ||
          (item.properties?.water ?? 0) >=
            rules.shop.guarantees.hydratingWaterMinimum),
      true,
    );
  const stock = Object.fromEntries(
    chosen.map((item) => [
      item.id,
      rules.shop.stock.minimum +
        Math.floor(
          actionRandom(
            state.seed,
            state.stateVersion,
            date,
            'shop_stock',
            item.id,
          ) * rules.shop.stock.range,
        ),
    ]),
  );
  return {
    localDate: date,
    itemIds: chosen.map((item) => item.id),
    stock,
    cart: {},
  };
}

export function localDate(now: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

export function nextLocalMidnight(now: number, timezone: string): number {
  const current = localDate(now, timezone);
  let low = now;
  let high = now + LOCAL_MIDNIGHT_SEARCH_HOURS * HOUR_MS;
  while (localDate(high, timezone) === current) high += DAY_MS;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(middle, timezone) === current) low = middle;
    else high = middle;
  }
  return high;
}
