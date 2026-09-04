import { expect, signInAndChooseMode, test } from './fixtures';

test('moves from login through separate key and new-game mode screens', async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto('/');
  await page.locator('a[href="/login"]').first().click();
  await expect(page).toHaveURL(/\/login$/);

  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.locator('body')).not.toContainText('{pet}');

  await page.getByLabel('Username').fill('playtester');
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/key$/);
  await expect(page.getByRole('textbox', { name: 'Game key' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Generate new game' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Realtime mode' })).toHaveCount(
    0,
  );

  await page.getByRole('button', { name: 'Generate new game' }).click();
  await expect(page).toHaveURL(/\/key$/);
  await expect(page.getByRole('textbox', { name: 'Game key' })).toHaveValue(
    /^\d{8}$/,
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/mode\?key=\d{8}$/);
  await expect(page.getByRole('textbox', { name: 'Game key' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Streaming mode' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Streaming mode' }).click();
  await expect(page).toHaveURL(/\/game$/);
  await page.getByText('Settings', { exact: true }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Username')).toBeVisible();
});

test('uses the exact three-column overview, uniform control rows, and item dialogs', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');

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
  await expect(
    overviewColumn.getByText('Subscribers: 100', { exact: true }),
  ).toBeVisible();
  await expect(overviewColumn.getByText('Career: Debut')).toBeVisible();
  await expect(
    overviewColumn.getByText('Next milestone: First Model · 50 to go'),
  ).toBeVisible();
  const room = firstRow.getByRole('region', { name: /room/i });
  const eventPanel = firstRow.getByRole('complementary', {
    name: 'Recent events',
  });
  await expect(room).toBeVisible();
  await expect(eventPanel).toBeVisible();
  await expect(room.locator('img.companion')).toHaveAttribute(
    'data-appearance-id',
    'classic',
  );
  expect(
    await overviewColumn.evaluate((element) => ({
      display: getComputedStyle(element).display,
      direction: getComputedStyle(element).flexDirection,
      border: getComputedStyle(element).borderTopWidth,
    })),
  ).toEqual({ display: 'flex', direction: 'column', border: '0px' });
  const overviewBoxes = await firstRow
    .locator(
      ':scope > .overview-column, :scope > .room-card, :scope > .event-panel',
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, width: box.width };
      }),
    );
  expect(overviewBoxes).toHaveLength(3);
  expect(overviewBoxes[0].top).toBeCloseTo(overviewBoxes[1].top, 0);
  expect(overviewBoxes[1].top).toBeCloseTo(overviewBoxes[2].top, 0);
  expect(overviewBoxes[0].left).toBeLessThan(overviewBoxes[1].left);
  expect(overviewBoxes[1].left).toBeLessThan(overviewBoxes[2].left);
  expect(overviewBoxes[0].width).toBeCloseTo(overviewBoxes[2].width, 0);

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

  await expect(eventPanel.locator('li:last-child')).toHaveText(
    /journey began/i,
  );
  await expect(eventPanel.locator('li')).toHaveCount(1);
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
    feedDialog.getByRole('button', { name: /Add Uncrustables/ }),
  ).toBeVisible();
  await expect(
    feedDialog.getByRole('button', { name: /Add Water/ }),
  ).toBeVisible();
  await expect(
    feedDialog.getByRole('button', { name: /Add Pretzel/ }),
  ).toBeVisible();
  await feedDialog.getByRole('button', { name: /Add Water/ }).click();
  await feedDialog.getByRole('button', { name: /Add Pretzel/ }).click();
  await expect(
    feedDialog.getByRole('button', { name: 'Feed selected (2)' }),
  ).toBeEnabled();
});
