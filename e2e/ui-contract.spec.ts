import { expect, test } from './fixtures';

test('moves from landing through username and generated key to time-mode choice', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('a[href="/login"]').first().click();
  await expect(page).toHaveURL(/\/login$/);

  await expect(page.getByLabel('Username')).toBeVisible();
  const key = page.getByLabel('Session key');
  await expect(key).toHaveValue('');
  await page.getByRole('button', { name: /generate a key/i }).click();
  await expect(key).toHaveValue(/^[A-Z0-9]{8}$/);
  await expect(page.locator('body')).not.toContainText('{pet}');

  await page.getByLabel('Username').fill('playtester');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('button', { name: 'Realtime mode' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Streaming mode' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Streaming mode' }).click();
  await expect(page).toHaveURL(/\/game$/);
});

test('uses the exact two-column overview, uniform control rows, and item dialogs', async ({
  page,
}) => {
  await page.goto('/game');

  const firstRow = page.locator('[data-game-row="overview"]');
  const overviewColumn = firstRow.locator(':scope > .overview-column');
  await expect(overviewColumn).toHaveCount(1);
  await expect(
    overviewColumn.getByRole('region', { name: 'Current metrics' }),
  ).toBeVisible();
  await expect(
    overviewColumn.getByRole('region', { name: 'Status' }),
  ).toBeVisible();
  await expect(overviewColumn.getByText(/Balance:/)).toBeVisible();
  const room = firstRow.getByRole('region', { name: /room/i });
  await expect(room).toBeVisible();
  expect(
    await overviewColumn.evaluate((element) => ({
      display: getComputedStyle(element).display,
      direction: getComputedStyle(element).flexDirection,
      border: getComputedStyle(element).borderTopWidth,
    })),
  ).toEqual({ display: 'flex', direction: 'column', border: '0px' });
  const overviewBoxes = await firstRow
    .locator(':scope > .overview-column, :scope > .room-card')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, width: box.width };
      }),
    );
  expect(overviewBoxes).toHaveLength(2);
  expect(overviewBoxes[0].top).toBeCloseTo(overviewBoxes[1].top, 0);
  expect(overviewBoxes[0].left).toBeLessThan(overviewBoxes[1].left);
  expect(overviewBoxes[1].width).toBeGreaterThan(700);

  const careRow = page.locator('[data-game-row="care"]');
  await expect(careRow.getByRole('button')).toHaveCount(4);
  await expect(careRow.getByRole('button', { name: 'Feed' })).toBeVisible();
  await expect(careRow.getByRole('button', { name: 'Rest' })).toBeVisible();
  await expect(
    careRow.getByRole('button', { name: 'Socialize' }),
  ).toBeVisible();
  await expect(careRow.getByRole('button', { name: 'Play' })).toBeVisible();

  const navigation = page.locator('[data-game-row="navigation"]');
  await expect(navigation.getByRole('link')).toHaveCount(4);
  await expect(navigation.getByRole('link', { name: 'Room' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Shop' })).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Inventory' }),
  ).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'History' })).toBeVisible();
  const controlBoxes = async (
    locator: ReturnType<typeof page.locator>,
    selector: 'button' | 'a',
  ) =>
    locator.locator(selector).evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, width: box.width, height: box.height };
      }),
    );
  const careBoxes = await controlBoxes(careRow, 'button');
  const navigationBoxes = await controlBoxes(navigation, 'a');
  expect(careBoxes).toHaveLength(4);
  expect(navigationBoxes).toHaveLength(4);
  for (let index = 0; index < 4; index += 1) {
    expect(careBoxes[index].left).toBeCloseTo(navigationBoxes[index].left, 0);
    expect(careBoxes[index].width).toBeCloseTo(navigationBoxes[index].width, 0);
    expect(careBoxes[index].height).toBeCloseTo(
      navigationBoxes[index].height,
      0,
    );
  }

  await page.getByRole('link', { name: 'Shop' }).click();
  await expect(page.locator('[data-game-row="navigation"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /back to room/i })).toBeVisible();
  await page.getByRole('link', { name: /back to room/i }).click();

  await expect(page.locator('.companion-caption')).toHaveText(
    'Just rainbows and sunshine.',
  );
  const settings = page.locator('details.settings');
  await settings.locator('summary', { hasText: 'Settings' }).click();
  await expect(settings).toContainText('Realtime mode');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);

  await careRow.getByRole('button', { name: 'Feed' }).click();
  const feedDialog = page.getByRole('dialog', {
    name: 'Choose something to feed',
  });
  await expect(feedDialog).toBeVisible();
  await expect(
    feedDialog.getByRole('button', { name: /Uncrustables/ }),
  ).toBeVisible();
  await expect(feedDialog.getByRole('button', { name: /Water/ })).toBeVisible();
  await expect(
    feedDialog.getByRole('button', { name: /Pretzel/ }),
  ).toBeVisible();
});
