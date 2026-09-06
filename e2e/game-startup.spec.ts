import { expect, test } from './fixtures';

test('shows a startup failure and lets the player retry Streaming mode', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let unavailable = true;
  await page.route('**/api/content/manifest', async (route) => {
    if (unavailable) await route.fulfill({ status: 404 });
    else await route.fallback();
  });
  await page.goto('/key');
  await page.getByRole('button', { name: 'Generate new game' }).click();
  const key = await page
    .getByRole('textbox', { name: 'Game key', exact: true })
    .inputValue();
  const leakedRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes(key) || request.headers().referer?.includes(key))
      leakedRequests.push('Game key appeared in a request URL or Referer.');
  });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(/\/mode$/);
  expect(
    await page.evaluate(() => JSON.stringify(history.state)),
  ).not.toContain(key);
  const streaming = page.getByRole('button', {
    name: 'Streaming mode',
    exact: true,
  });
  await streaming.click();
  await expect(page.getByRole('alert')).toHaveText(
    'The game could not start. Please try again.',
  );
  await expect(streaming).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Realtime mode', exact: true }),
  ).toBeEnabled();
  unavailable = false;
  await streaming.click();
  await expect(page).toHaveURL(/\/game$/);
  await expect(page.getByRole('region', { name: /room/i })).toBeVisible();
  expect(errors).toEqual([]);
  expect(leakedRequests).toEqual([]);
});

test('reloading mode selection discards the in-memory key', async ({
  page,
}) => {
  await page.goto('/key');
  await page.getByRole('button', { name: 'Generate new game' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(/\/mode$/);
  await page.reload();
  await expect(page).toHaveURL(/\/key$/);
});
