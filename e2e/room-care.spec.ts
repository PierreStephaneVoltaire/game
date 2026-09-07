import { expect, signInAndChooseMode, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('game-data');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('games', 'readwrite');
        const store = transaction.objectStore('games');
        const records = store.getAll();
        records.onsuccess = () => {
          for (const record of records.result) {
            record.state.inventory = {
              'new-game': 1,
              controller: 1,
              'socks-plushie': 1,
              'desk-chair': 1,
              'rigging-tablet': 1,
            };
            record.state.metrics.creativity = 5;
            store.put(record);
          }
        };
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
  await page.reload();
});

for (const [kind, item] of [
  ['Socialize', 'Socks Plushie'],
  ['Play', 'New Game'],
] as const) {
  test(`${kind} cards execute directly without quantity controls or extra copy`, async ({
    page,
  }) => {
    await page.getByRole('button', { name: kind, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('button', { name: 'Default', exact: true }),
    ).toBeVisible();
    await expect(dialog).not.toContainText(/Normal socialize|Normal play/);
    await expect(dialog.locator('.selection-quantity')).toHaveCount(0);
    await expect(
      dialog.getByRole('button', { name: /Use selected/ }),
    ).toHaveCount(0);
    await dialog.getByRole('button', { name: item, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('Room places furniture and starts owned usable actions', async ({
  page,
}) => {
  const open = page.getByRole('button', { name: 'Room', exact: true });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Room', exact: true });
  await expect(
    dialog.getByRole('button', { name: 'Rigging Tablet', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'New Game', exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Desk Chair', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Unplace Desk Chair', exact: true }),
  ).toBeVisible();
  await open.click();
  await dialog
    .getByRole('button', { name: 'Rigging Tablet', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('an empty room spot has only the Room title and one close control', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Choose an item for Desk', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Room', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('p')).toHaveCount(0);
  await expect(dialog.getByRole('button')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Close inventory choices' }).click();
  await expect(dialog).toHaveCount(0);
});
