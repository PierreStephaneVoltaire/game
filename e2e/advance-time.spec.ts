import { expect, signInAndChooseMode, test } from './fixtures';

test('chooses a duration without advancing on open or cancel', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Streaming mode');
  const opener = page.getByRole('button', {
    name: 'Advance time',
    exact: true,
  });
  const dialog = page.getByRole('dialog', {
    name: 'Advance time',
    exact: true,
  });
  const clock = page.locator('.session-clock span');
  const before = await clock.innerText();
  await opener.click();
  await expect(dialog.getByRole('button')).toHaveText([
    'Random',
    '12 hours',
    '6 hours',
    '3 hours',
    '1 hour',
    'Cancel',
  ]);
  await expect(
    dialog.getByRole('button', { name: 'Random', exact: true }),
  ).toBeFocused();
  await expect(clock).toHaveText(before);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect(clock).toHaveText(before);
  await opener.click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(clock).toHaveText(before);
  await opener.click();
  await dialog.getByRole('button', { name: '1 hour', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(clock).not.toHaveText(before);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('does not offer Advance time in Realtime mode', async ({ page }) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await expect(
    page.getByRole('button', { name: 'Advance time', exact: true }),
  ).toHaveCount(0);
});
