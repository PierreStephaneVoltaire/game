import { expect, signInAndChooseMode, test } from './fixtures';

test('opens item details over the shop without navigating', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await page
    .getByRole('button', { name: /^View details for / })
    .nth(1)
    .click();
  await expect(page).toHaveURL(/\/game$/);
  await expect(page.locator('.detail-dialog')).toBeVisible();
  await expect(page.getByText('ITEM DETAIL', { exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Item tags' })).toBeVisible();
});

for (const width of [1440, 320]) {
  test(`keeps full-screen dialogs mounted, scrollable, and keyboard-contained at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    await signInAndChooseMode(page, 'Realtime mode');
    const room = await page.locator('main').elementHandle();
    for (const name of ['Shop', 'Inventory']) {
      const opener = page.getByRole('button', { name, exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog', { name, exact: true });
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(/\/game$/);
      expect(await dialog.boundingBox()).toEqual({
        x: 0,
        y: 0,
        width,
        height: 720,
      });
      expect(await room!.evaluate((element) => element.isConnected)).toBe(true);
      expect(
        await dialog.evaluate((element) => element.matches(':modal')),
      ).toBe(true);
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      const close = dialog.getByRole('button', { name: `Close ${name}` });
      await expect(close).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(
        page.locator('main :focus, .game-navigation :focus'),
      ).toHaveCount(0);
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
      if (name === 'Shop') {
        await dialog.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        expect(
          await dialog.evaluate((element) => element.scrollTop),
        ).toBeGreaterThan(0);
        expect(
          await page
            .locator('body')
            .evaluate((element) => getComputedStyle(element).overflow),
        ).toBe('hidden');
      } else {
        await expect(dialog.getByRole('tab')).toHaveCount(0);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
  });
}

test('returns from History to the game before opening either dialog', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  for (const name of ['Shop', 'Inventory']) {
    await page.getByRole('link', { name: 'History', exact: true }).click();
    const opener = page.getByRole('button', { name, exact: true });
    await opener.click();
    await expect(page).toHaveURL(/\/game$/);
    await expect(page.getByRole('dialog', { name, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await expect(page.locator('[data-game-row="care"]')).toBeVisible();
  }
});

test('restores filters and focus after nested item and offer details', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('button', { name: 'food', exact: true }).click();
  const item = page.getByRole('button', { name: /^View details for / }).first();
  await item.click();
  const detail = page.locator('.detail-dialog');
  await expect(detail).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('main :focus, .item-grid :focus')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(
    detail.getByRole('button', { name: 'Close item details' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  await expect(item).toBeFocused();
  await expect(page.locator('.categories .active')).toHaveText('food');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  const offer = page.getByRole('button', {
    name: 'View details for Line of Credit',
  });
  await offer.click();
  await page.keyboard.press('Escape');
  await expect(offer).toBeFocused();
  await page.getByRole('button', { name: 'Close Shop' }).click();
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'food', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search inventory' }).fill('Water');
  const water = page.getByRole('button', { name: /^View Water,/ });
  await water.click();
  await expect(detail).toBeVisible();
  await page.getByRole('button', { name: 'Close item details' }).click();
  await expect(water).toBeFocused();
  await expect(page.getByRole('searchbox')).toHaveValue('Water');
  await expect(page.locator('.inventory-categories .active')).toHaveText(
    'food',
  );
  await expect(page.locator('.inventory-card')).toHaveCount(1);
  await page.getByRole('searchbox').fill('no such item');
  await expect(
    page.getByText('No owned items match that filter.'),
  ).toBeVisible();
});

test('retains cart contents and feedback when checkout cannot be saved', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page
    .getByRole('button', { name: 'Add one Line of Credit', exact: true })
    .click();
  await page.getByRole('tab', { name: /Cart/ }).click();
  await expect(page.locator('.cart-line output')).toHaveText('1');
  await page.evaluate(() => {
    IDBDatabase.prototype.transaction = () => {
      throw new Error('Checkout storage unavailable.');
    };
  });
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.locator('.shop-toast')).toHaveText(
    'Checkout storage unavailable.',
  );
  await expect(page.locator('.cart-line output')).toHaveText('1');
  await expect(page.getByRole('tab', { name: /Cart/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
