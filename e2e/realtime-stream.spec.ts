import { expect, signIn, test } from './fixtures';

test('observes a deterministic autonomous stream in Realtime mode', async ({
  page,
}) => {
  const startedAt = new Date('2026-08-22T17:00:00Z').getTime();
  await page.addInitScript((initialNow) => {
    let currentNow = initialNow;
    Object.defineProperty(window, '__setPlaytestNow', {
      configurable: true,
      value: (value: number) => {
        currentNow = value;
      },
    });
    Date.now = () => currentNow;
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value: (values: Uint32Array) => {
        values.fill(16);
        return values;
      },
    });
  }, startedAt);

  await signIn(page);
  await page.getByRole('button', { name: 'Generate new game' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Realtime mode' }).click();
  await page.getByRole('button', { name: 'Socialize' }).click();
  await expect(page.getByRole('button', { name: 'Socialize' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled();

  await page.evaluate(
    (nextNow) => {
      const clock = window as typeof window & {
        __setPlaytestNow(value: number): void;
      };
      clock.__setPlaytestNow(nextNow);
      document.dispatchEvent(new Event('visibilitychange'));
    },
    startedAt + 61 * 60_000,
  );

  await expect(page.getByText(/is streaming until/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Feed' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Shop', exact: true }),
  ).toBeEnabled();
});
