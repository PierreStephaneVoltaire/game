import { expect, signInAndChooseMode, test } from './fixtures';
import rules from '../src/lib/data/simulation-rules.json' with { type: 'json' };
import financialRules from '../src/lib/data/financial-rules.json' with { type: 'json' };

const openedBalance =
  rules.startingCurrency -
  financialRules.lineOfCredit.applicationPrice +
  financialRules.lineOfCredit.cashAdvance;
const firstRepaymentBalance =
  openedBalance - financialRules.lineOfCredit.repaymentUnitPrice;
const currency = (value: number) => `$${value.toLocaleString('en-CA')}`;

test('keeps cards inert and settles the permanent LOC offer through the cart', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  await page.goto('/game/shop?tab=shop');
  const grid = page.locator('.item-grid');
  const locCard = page.locator('.item-card').filter({
    hasText: 'Line of Credit',
  });
  const locQuantity = locCard.locator('.quantity-stepper output');
  await expect(locCard).toBeVisible();
  await expect(locQuantity).toHaveText('0');
  await expect(page.locator('body')).not.toContainText('Cart updated');

  await locCard.locator('.item-body').click();
  await expect(locQuantity).toHaveText('0');
  await locCard
    .getByRole('button', { name: 'View details for Line of Credit' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Line of Credit' }),
  ).toBeVisible();
  await expect(locQuantity).toHaveText('0');
  await page.getByRole('button', { name: 'Close offer details' }).click();

  const catalogueCard = page.locator('.item-card').nth(1);
  const catalogueQuantity = catalogueCard.locator('.quantity-stepper output');
  const catalogueDescription = catalogueCard.locator('.item-summary p');
  await expect(catalogueDescription).toBeVisible();
  await expect(catalogueDescription).not.toBeEmpty();
  await expect(locCard.locator('.item-summary p')).toHaveCount(0);
  await expect(catalogueQuantity).toHaveText('0');
  await catalogueCard.locator('.item-body').click();
  await expect(catalogueQuantity).toHaveText('0');
  await catalogueCard
    .getByRole('button', { name: /^View details for / })
    .click();
  await expect(page).toHaveURL(/tab=detail&item=/);
  await page.getByRole('button', { name: 'Close item details' }).click();

  const repeatCard = page
    .locator('.item-card')
    .filter({ hasText: /[2-9][0-9]* available/ })
    .first();
  const repeatOutput = repeatCard.locator('.quantity-stepper output');
  const gridBefore = await grid.boundingBox();
  const increase = repeatCard.getByRole('button', { name: /^Add one / });
  await increase.hover();
  await page.mouse.down();
  await page.waitForTimeout(620);
  await page.mouse.up();
  await expect
    .poll(async () => Number(await repeatOutput.textContent()))
    .toBeGreaterThan(1);
  await repeatCard.getByRole('button', { name: /^Remove one / }).click();
  const gridAfter = await grid.boundingBox();
  expect(gridAfter?.y).toBeCloseTo(gridBefore?.y ?? 0, 0);
  expect(gridAfter?.height).toBeCloseTo(gridBefore?.height ?? 0, 0);
  await expect(page.locator('body')).not.toContainText('Cart updated');

  while ((await repeatOutput.textContent()) !== '0')
    await repeatCard.getByRole('button', { name: /^Remove one / }).click();
  await locCard.getByRole('button', { name: 'Add one Line of Credit' }).click();
  await expect(locQuantity).toHaveText('1');
  await expect(page.locator('.balance')).toHaveText(
    `Cash: $${rules.startingCurrency}`,
  );
  await page.getByRole('tab', { name: /Inventory/ }).click();
  await expect(page.getByText('4 kinds owned')).toBeVisible();
  await page.getByRole('tab', { name: /Cart/ }).click();
  await expect(
    page.getByText('Cash after checkout').locator('..'),
  ).toContainText(currency(openedBalance));
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.locator('.balance')).toHaveText(
    `Cash: ${currency(openedBalance)}`,
  );
  await expect(page.getByText('4 kinds owned')).toBeVisible();

  await page.getByRole('tab', { name: 'Shop' }).click();
  const repaymentCard = page.locator('.item-card').filter({
    hasText: 'Line of Credit',
  });
  await expect(repaymentCard).toContainText('$600 · 20 remaining');
  await repaymentCard
    .getByRole('button', { name: 'Add one Line of Credit' })
    .click();
  await page.getByRole('tab', { name: /Cart/ }).click();
  await expect(
    page.getByText('Cash after checkout').locator('..'),
  ).toContainText(currency(firstRepaymentBalance));
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.locator('.balance')).toHaveText(
    `Cash: ${currency(firstRepaymentBalance)}`,
  );
});
