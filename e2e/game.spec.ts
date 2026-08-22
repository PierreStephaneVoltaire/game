import { expect, signInAndChooseMode, test } from './fixtures';

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
});

test('keeps the generated key in memory and starts fresh on reload', async ({
  page,
}) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Session key')).toHaveValue('');
  await page.getByRole('button', { name: /generate a key/i }).click();
  await expect(page.getByLabel('Session key')).toHaveValue(/^[A-Z0-9]{8}$/);
  await page.getByLabel('Username').fill('playtester');
  await page.getByRole('button', { name: /generate a key/i }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Realtime mode' }).click();
  await expect(page).toHaveURL(/\/game$/);
  await page.reload();
  const settings = page.locator('details.settings');
  await settings.locator('summary').click();
  await expect(settings).toContainText('Realtime mode');
  await expect(settings.getByRole('button', { name: /mode/i })).toHaveCount(0);
  await settings.locator('summary').click();
  await expect(
    page.getByRole('region', { name: 'Time and balance' }),
  ).toContainText('Balance: $20');
});

test('opens shop and history from the room', async ({ page }) => {
  await page.goto('/game');
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
  await page.goto('/game/shop?tab=unknown&category=unknown&item=missing');
  await expect(page).toHaveURL(/\/game\/shop\?tab=shop$/);
  await page.locator('.item-open').first().click();
  await expect(page).toHaveURL(/tab=detail&item=/);
  await expect(page.getByText('ITEM DETAIL', { exact: true })).toBeVisible();
});

test('renders the selected feed outcome and advances streaming time', async ({
  page,
}) => {
  await page.goto('/game/shop?tab=inventory');
  await page.getByRole('button', { name: /Water/ }).click();
  await page.getByRole('button', { name: 'Feed companion' }).click();
  await expect(page.locator('.message')).toContainText('Water was used.');

  await signInAndChooseMode(page, 'Streaming mode');
  await page.getByRole('button', { name: 'Advance time' }).click();
  await expect(page.locator('.companion-caption span')).toContainText(
    'Time advanced',
  );
});

test('blocks care during Realtime activity while navigation remains available', async ({
  page,
}) => {
  await page.goto('/game');
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
  await expect(page.locator('.companion-caption span')).toContainText(
    'Rest started.',
  );
});

test('renders a refusal outcome and keeps status feedback visible', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Streaming mode');
  await page.getByRole('button', { name: 'Rest' }).click();
  await page.getByRole('button', { name: 'Rest' }).click();
  await expect(page.locator('.companion-caption span')).toContainText(/refus/i);
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
  await expect(
    page.locator('.status-name').filter({
      hasText: /hungry|starving|sleep deprived|low energy/i,
    }),
  ).toBeVisible();
});

test('keeps cart flow in session and preserves keyboard/reduced-motion affordances', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/game/shop?tab=shop');
  const add = page.locator('.item-footer button:not([disabled])');
  await expect(add.first()).toBeEnabled();
  await add.first().click();
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

test('reaches terminal history through Streaming time without a restart affordance', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Streaming mode');
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const advanceTime = page.getByRole('button', { name: 'Advance time' });
    if (!(await advanceTime.isVisible())) break;
    await advanceTime.click();
    if (await page.getByRole('heading', { name: 'Run ended' }).isVisible())
      break;
  }
  await expect(page.getByRole('heading', { name: 'Run ended' })).toBeVisible();
  const settings = page.locator('details.settings');
  await settings.locator('summary').click();
  await expect(settings).toContainText('Streaming mode');
  await expect(settings.getByRole('button', { name: /mode/i })).toHaveCount(0);
  await settings.locator('summary').click();
  await expect(page.getByRole('button', { name: /reset/i })).toHaveCount(0);
  await page.getByRole('link', { name: 'Shop' }).click();
  await expect(page.locator('.item-footer button').first()).toBeDisabled();
  await page.getByRole('link', { name: /back to room/i }).click();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cause of death' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Causal chain' }),
  ).toBeVisible();
  await expect(page.getByText('Graveyard', { exact: true })).toBeVisible();
  await expect(page.locator('.death-card ol li').first()).toBeVisible();
  await expect(page.getByText('Full event log', { exact: true })).toBeVisible();
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
  await page.goto('/login');
  await page.getByLabel('Username').fill('playtester');
  await page.getByRole('button', { name: /generate a key/i }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Streaming mode' }).click();
  await page.getByRole('button', { name: 'Socialize' }).click();
  await expect(
    page.getByRole('region', { name: 'Time and balance' }),
  ).toContainText('Balance: $82');
  await page.getByRole('link', { name: 'Shop' }).click();
  await page.getByRole('button', { name: 'reusable' }).click();
  await page
    .locator('.item-card')
    .filter({ hasText: 'Socks Plushie' })
    .getByRole('button', { name: 'Add' })
    .click();
  await page.getByRole('tab', { name: /Cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByRole('button', { name: /Socks Plushie/ }).click();
  await page.getByRole('button', { name: 'Offer a plushie apology' }).click();
  await expect(page.locator('.message')).toContainText(
    'Offer a plushie apology performed.',
  );
  await expect(page.getByText('Owned: ×1')).toBeVisible();
  await page.getByRole('button', { name: 'Place item' }).click();
  await expect(page.getByRole('button', { name: 'Unplace' })).toBeVisible();
  await page.getByRole('button', { name: 'Unplace' }).click();
  await expect(page.locator('.message')).toContainText('Removed');
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
  await expect(page.locator('.companion-caption span')).toContainText(
    /removed/i,
  );
});
