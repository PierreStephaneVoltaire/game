import { expect, test as base, type Page } from '@playwright/test';
import { BUNDLED_GAME_DEFINITION as definition } from '../src/lib/test-game-definition';

const runtimeBundle = {
  version: definition.version,
  schema_version: definition.schemaVersion,
  shop_items: definition.items,
  activity_rules: definition.activityRules,
  ending_rules: definition.endingRules,
  event_texts: definition.eventTexts,
  financial_rules: definition.financialRules,
  life_events: definition.lifeEvents,
  pet_profile: definition.petProfile,
  simulation_rules: definition.simulationRules,
};

export const test = base.extend<{ requestViolations: string[] }>({
  requestViolations: [
    async ({ page, context, baseURL }, use) => {
      const violations: string[] = [];
      const expectedOrigin = new URL(baseURL!).origin;
      await context.addCookies([
        {
          name: 'virtual_pet_session',
          value: 'test-session',
          url: baseURL!,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      await page.route('**/api/**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const authenticated = request
          .headers()
          .cookie?.includes('virtual_pet_session=test-session');
        const user = { userId: 'test-user', username: 'playtester' };
        const json = (body: unknown, status = 200, cookie?: string) =>
          route.fulfill({
            status,
            contentType: 'application/json',
            headers: cookie ? { 'set-cookie': cookie } : undefined,
            body: JSON.stringify(body),
          });
        if (path === '/api/content/manifest') {
          if (
            request.headers()['if-none-match'] === `"${definition.version}"`
          ) {
            await route.fulfill({ status: 304 });
            return;
          }
          await json({ version: definition.version, schemaVersion: 1 });
          return;
        }
        if (path === `/api/content/${definition.version}`) {
          await json(runtimeBundle);
          return;
        }
        if (path === '/api/me') {
          await json(
            authenticated
              ? { user, serverNow: '2026-08-30T20:00:00.000Z' }
              : {
                  error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Sign in to continue.',
                  },
                },
            authenticated ? 200 : 401,
          );
          return;
        }
        if (path === '/api/auth/register' || path === '/api/auth/login') {
          await json(
            { user, serverNow: '2026-08-30T20:00:00.000Z' },
            path.endsWith('register') ? 201 : 200,
            'virtual_pet_session=test-session; Path=/; HttpOnly; SameSite=Lax',
          );
          return;
        }
        if (path === '/api/auth/logout') {
          await json(
            { serverNow: '2026-08-30T20:00:00.000Z' },
            200,
            'virtual_pet_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
          );
          return;
        }
        await route.fulfill({ status: 404 });
      });
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.origin !== expectedOrigin) violations.push(request.url());
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
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Username').fill('playtester');
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/key$/);
  await page.getByRole('button', { name: 'Generate new game' }).click();
  await expect(page.getByRole('textbox', { name: 'Game key' })).toHaveValue(
    /^\d{8}$/,
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/mode\?key=\d{8}$/);
  await page.getByRole('button', { name: mode }).click();
  await expect(page).toHaveURL(/\/game$/);
}
