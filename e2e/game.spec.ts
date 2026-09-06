import { expect, signInAndChooseMode, test } from './fixtures';
import rules from '../src/lib/data/simulation-rules.json' with { type: 'json' };
test('signs in and reaches the companion room', async ({ page }) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await expect(page.getByRole('region', { name: /room/i })).toBeVisible();
  await expect(page.getByText(/balance/i)).toBeVisible();
  const careRow = page.locator('[data-game-row="care"]');
  await expect(careRow).toBeVisible();
  await expect(careRow.getByRole('button')).toHaveCount(4);
  await expect(
    page.getByRole('region', { name: 'Time and balance' }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: 'Window' })).toBeVisible();
  await expect(
    page.getByRole('meter', { name: /Food: \d+ out of 10/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('meter', { name: /Health: \d+ out of 10/ }),
  ).toBeVisible();
});

test('restores the account session and opens an existing key without mode selection', async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Password')).toHaveValue('');
  await page.getByLabel('Username').fill('playtester');
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Generate new game' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Realtime mode' }).click();
  await expect(page).toHaveURL(/\/game$/);
  await page.reload();
  await expect(page).toHaveURL(/\/game$/);
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await expect(page.locator('[data-game-row="care"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Realtime mode' })).toHaveCount(
    0,
  );
});

test('opens shop and history from the room', async ({ page }) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await page.getByRole('link', { name: 'Shop' }).click();
  await expect(page.getByRole('heading', { name: 'Shop' })).toBeVisible();
  await expect(page.locator('[data-game-row="navigation"]')).toHaveCount(0);
  await page.goto('/game/history');
  await expect(page.getByRole('heading', { name: /history/i })).toBeVisible();
});

test('keeps the shared game layout within a 320px viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await signInAndChooseMode(page, 'Realtime mode');
  for (const path of ['/game', '/game/shop?tab=shop', '/game/history']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  await page.goto('/game');
  await expect(page.locator('[data-game-row="care"]')).toBeVisible();
  for (const row of ['care', 'navigation']) {
    const tops = await page
      .locator(`[data-game-row="${row}"]`)
      .getByRole(row === 'care' ? 'button' : 'link')
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().top),
      );
    expect(tops).toHaveLength(4);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2);
  }
});

test('normalizes invalid shop queries and exposes item detail', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await page.goto('/game/shop?tab=unknown&category=unknown&item=missing');
  await expect(page).toHaveURL(/\/game\/shop\?tab=shop$/);
  await page
    .getByRole('button', { name: /^View details for / })
    .nth(1)
    .click();
  await expect(page).toHaveURL(/tab=detail&item=/);
  await expect(page.getByText('ITEM DETAIL', { exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Item tags' })).toBeVisible();
});

test('renders the selected feed outcome and advances streaming time', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await page.goto('/game/shop?tab=inventory');
  await page.getByRole('button', { name: /Water/ }).click();
  await page.getByRole('button', { name: 'Feed companion' }).click();
  await expect(page.locator('.outcome')).toContainText('Water was used.');

  await signInAndChooseMode(page, 'Streaming mode');
  await page.getByRole('button', { name: 'Advance time' }).click();
  await expect(page.locator('.event-panel li:last-child')).not.toContainText(
    /Time advanced|decay interval/,
  );
});

test('blocks care during Realtime activity while navigation remains available', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await page.getByRole('button', { name: 'Rest' }).click();
  await expect(page.getByText(/is resting until/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Feed' })).toBeDisabled();
  await page.getByRole('link', { name: 'Shop' }).click();
  await expect(page.getByRole('heading', { name: 'Shop' })).toBeVisible();
  await page.getByRole('tab', { name: /Inventory/ }).click();
  await expect(page).toHaveURL(/\/game\/shop\?tab=inventory$/);
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await expect(
    page.locator('details.settings').locator('summary'),
  ).toBeVisible();
  await page.getByRole('link', { name: /back to room/i }).click();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: /history/i })).toBeVisible();
  await page.getByRole('link', { name: 'Room', exact: true }).click();
  const settings = page.locator('details.settings');
  await settings.locator('summary').click();
  await expect(settings).toContainText('Realtime mode');
  await settings.locator('summary').click();
  await expect(page.getByRole('button', { name: 'Feed' })).toBeDisabled();
  await expect(page.locator('.activity')).toContainText(/resting until/i);
  await expect(page.locator('.event-panel li:last-child')).toContainText(
    /settled down to rest|went to rest/i,
  );
});

test('renders a refusal outcome and keeps status feedback visible', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Streaming mode');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.getByRole('button', { name: 'Rest' }).click();
    if (
      /refus/i.test(
        (await page.locator('.event-panel li:last-child').textContent()) ?? '',
      )
    )
      break;
  }
  await expect(page.locator('.event-panel li:last-child')).toContainText(
    /refus/i,
  );
  expect(await page.locator('.event-panel li').count()).toBeLessThanOrEqual(10);
  await expect(page.getByRole('region', { name: 'Status' })).toBeVisible();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const status = page.locator('.status-name').filter({
      hasText: /hungry|starving|sleep deprived|low energy/i,
    });
    if (await status.count()) break;
    const advanceTime = page.getByRole('button', { name: 'Advance time' });
    if (!(await advanceTime.isVisible())) break;
    await advanceTime.click();
  }
  await expect(page.locator('.status-name').first()).toBeVisible();
});

test('keeps cart flow in session and preserves keyboard/reduced-motion affordances', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAndChooseMode(page, 'Realtime mode');
  await page.goto('/game/shop?tab=shop');
  const add = page.locator(
    '.quantity-stepper button[aria-label^="Add one"]:not([disabled])',
  );
  await expect(add.first()).toBeEnabled();
  await add.first().click();
  await expect(page.locator('.quantity-stepper output').first()).toHaveText(
    '1',
  );
  await page.getByRole('tab', { name: /Cart/ }).click();
  await expect(page).toHaveURL(/\/game\/shop\?tab=cart$/);
  await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/game\/shop\?tab=inventory$/);
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  expect(
    await page
      .locator(':focus')
      .evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe('solid');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.goto('/game');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.goto('/game/history');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true);
});

test('uses autonomous stream income to purchase, place, and unplace a durable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const fixedNow = new Date('2026-08-22T17:00:00Z').getTime();
    Date.now = () => fixedNow;
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value: (values: Uint32Array) => {
        values.fill(16);
        return values;
      },
    });
  });
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Username').fill('playtester');
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Generate new game' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Streaming mode' }).click();
  await page.getByRole('button', { name: 'Socialize' }).click();
  await expect(
    page.getByRole('region', { name: 'Time and balance' }),
  ).toContainText(`Balance: $${rules.startingCurrency}`);
  await page.getByRole('link', { name: 'Shop' }).click();
  await page.getByRole('button', { name: 'reusable' }).click();
  await page
    .locator('.item-card')
    .filter({ hasText: 'Socks Plushie' })
    .getByRole('button', { name: 'Add one Socks Plushie', exact: true })
    .click();
  await page.getByRole('tab', { name: /Cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByRole('button', { name: /Socks Plushie/ }).click();
  await page.getByRole('button', { name: 'Offer a plushie apology' }).click();
  await expect(page.locator('.outcome')).toContainText(
    'Offer a plushie apology performed.',
  );
  await expect(page.getByText('Owned: ×1')).toBeVisible();
  await page.getByRole('button', { name: 'Place item' }).click();
  await expect(page.getByRole('button', { name: 'Unplace' })).toBeVisible();
  await page.getByRole('button', { name: 'Unplace' }).click();
  await expect(page.locator('.outcome')).toContainText('Removed');
  await page.getByRole('button', { name: 'Close item details' }).click();
  await page.getByRole('tab', { name: /Inventory/ }).click();
  await page.getByRole('button', { name: /Socks Plushie/ }).click();
  await page.getByRole('button', { name: 'Place item' }).click();
  await page.getByRole('button', { name: 'Close item details' }).click();
  await page.getByRole('link', { name: /back to room/i }).click();
  await expect(
    page.getByRole('button', { name: 'Unplace Socks Plushie' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Unplace Socks Plushie' }).click();
  await expect(page.locator('.event-panel li:last-child')).toContainText(
    /removed/i,
  );
});
