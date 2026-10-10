import { expect, signInAndChooseMode, test } from './fixtures';
import { BUNDLED_GAME_DEFINITION as definition } from '../src/lib/test-game-definition';

test('purchases into Inventory and preserves pagination, search, and placement', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Streaming mode');
  await page.evaluate(
    async (ids) => {
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
              record.state.inventory = Object.fromEntries(
                ids.map((id) => [id, 1]),
              );
              record.state.balance = 5000;
              record.state.shop.itemIds = [
                ...new Set([...record.state.shop.itemIds, 'giant-plushie']),
              ];
              record.state.shop.stock['giant-plushie'] = 1;
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
    },
    definition.items
      .filter((item) => item.id !== 'giant-plushie')
      .slice(0, 30)
      .map((item) => item.id),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('button', { name: 'decoration', exact: true }).click();
  await page
    .getByRole('button', { name: 'Add one Giant Plushie', exact: true })
    .click();
  await page.getByRole('tab', { name: /Cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Cart/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Close Shop' }).click();
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await expect(page.locator('.inventory-card')).toHaveCount(24);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  const secondPageItem = page.locator('.inventory-card').first();
  await secondPageItem.click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await expect(secondPageItem).toBeFocused();
  await page
    .getByRole('searchbox', { name: 'Search inventory' })
    .fill('Giant Plushie');
  await expect(page.locator('.inventory-card')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'View Giant Plushie, 1 owned', exact: true })
    .click();
  await page.getByRole('button', { name: 'Place item', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Unplace', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Unplace', exact: true }).click();
  await expect(page.locator('.outcome')).toContainText('Removed');
  await page.getByRole('button', { name: 'Place item', exact: true }).click();
  await page.getByRole('button', { name: 'Close item details' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('Giant Plushie');
  await page.getByRole('button', { name: 'Close Inventory' }).click();
  await expect(
    page.getByRole('button', { name: 'Unplace Giant Plushie', exact: true }),
  ).toBeVisible();
});
