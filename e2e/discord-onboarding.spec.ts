import { expect, test } from '@playwright/test';

test('Discord onboarding prefills the name and keeps it editable after a collision', async ({
  page,
}) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' },
      },
    }),
  );
  const submitted: unknown[] = [];
  await page.route('**/api/auth/discord/complete', async (route) => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: 'USERNAME_TAKEN',
          message: 'That username is already in use.',
        },
      },
    });
  });
  const onboardingToken = 'discord-onboarding-test-token';
  const fragment = new URLSearchParams({
    'discord-onboarding': onboardingToken,
    username: 'Discord_Player',
  });
  await page.goto(`/login#${fragment}`);
  const username = page.getByRole('textbox', { name: 'Choose a username' });
  await expect(username).toHaveValue('discord_player');
  await expect(page).toHaveURL(/\/login$/);
  const finish = page.getByRole('button', { name: 'Finish Discord sign in' });
  await finish.click();
  await expect(page.getByRole('alert')).toHaveText(
    'That username is already in use.',
  );
  await expect(username).toHaveValue('discord_player');
  await username.fill('another_name');
  await finish.click();
  await expect(finish).toBeEnabled();
  expect(submitted).toEqual([
    { onboardingToken, username: 'discord_player' },
    { onboardingToken, username: 'another_name' },
  ]);
});
