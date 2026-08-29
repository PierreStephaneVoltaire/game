import { readFile } from 'node:fs/promises';
import { expect, signInAndChooseMode, test } from './fixtures';

test('keeps the terminal record and exports the grave with its Journey', async ({
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
  await expect(page.locator('.graveyard')).toContainText('Started');
  await expect(page.locator('.graveyard')).toContainText('Ended');
  await expect(page.locator('.graveyard')).toContainText('Duration');
  await expect(page.locator('.death-card ol li').first()).toBeVisible();
  await expect(page.locator('details.event-log summary')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', {
      name: 'Export journey and grave',
    })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /-graveyard-\d{4}-\d{2}-\d{2}\.md$/,
  );
  const path = await download.path();
  expect(path).not.toBeNull();
  const markdown = await readFile(path!, 'utf8');
  expect(markdown).toMatch(/^# .+'s Graveyard Record$/m);
  expect(markdown).toContain('## Cause of death');
  expect(markdown).toContain('- Run started:');
  expect(markdown).toContain('- Run ended:');
  expect(markdown).toContain('- Duration:');
  expect(markdown).toContain('## Causal chain');
  expect(markdown).toContain('## Journey');
});
