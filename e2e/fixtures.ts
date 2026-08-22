import { expect, test as base, type Page } from '@playwright/test';

export const test = base.extend<{ requestViolations: string[] }>({
  requestViolations: [
    async ({ page, baseURL }, use) => {
      const violations: string[] = [];
      const expectedOrigin = new URL(baseURL!).origin;
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.origin !== expectedOrigin || url.pathname.startsWith('/api'))
          violations.push(request.url());
      });
      await use(violations);
      expect(violations).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function signInAndChooseMode(
  page: Page,
  mode: 'Realtime mode' | 'Streaming mode',
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill('playtester');
  await page.getByRole('button', { name: /generate a key/i }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: mode }).click();
  await expect(page).toHaveURL(/\/game$/);
}
