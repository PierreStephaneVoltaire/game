import { expect, test } from './fixtures';

test('keeps every displayed Feed quantity synchronized with the submitted batch', async ({
  page,
}) => {
  await page.goto('/game');
  await page.getByRole('button', { name: 'Feed' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose something to feed' });
  const water = dialog.getByLabel('Water selected');
  const pretzel = dialog.getByLabel('Pretzel selected');
  await expect(water).toHaveText('0');
  await expect(pretzel).toHaveText('0');

  await dialog
    .getByRole('button', { name: 'Add Water to feed selection' })
    .click();
  await dialog
    .getByRole('button', { name: 'Add Pretzel to feed selection' })
    .click();
  await expect(water).toHaveText('1');
  await expect(pretzel).toHaveText('1');
  await expect(
    dialog.getByRole('button', { name: 'Feed selected (2)' }),
  ).toBeEnabled();

  await dialog
    .getByRole('button', { name: 'Remove Pretzel from feed selection' })
    .click();
  await expect(pretzel).toHaveText('0');
  await expect(
    dialog.getByRole('button', { name: 'Feed selected (1)' }),
  ).toBeEnabled();
  await dialog
    .getByRole('button', { name: 'Add Pretzel to feed selection' })
    .click();
  await expect(pretzel).toHaveText('1');
  await dialog.getByRole('button', { name: 'Feed selected (2)' }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole('button', { name: 'Feed' }).click();
  const reopened = page.getByRole('dialog', {
    name: 'Choose something to feed',
  });
  await expect(reopened.getByText('Water', { exact: true })).toHaveCount(0);
  await expect(reopened.getByText('Pretzel', { exact: true })).toHaveCount(0);
});
