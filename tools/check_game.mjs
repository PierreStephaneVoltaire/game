/** Exercise deployed login and Streaming startup with a fresh browser cache. */
import { createHmac } from 'node:crypto';
import process from 'node:process';
import { chromium, expect } from '@playwright/test';

const origin = process.env.APP_URL?.replace(/\/$/, '');
const password = process.env.AUTH_TEST_PASSWORD;
if (!origin || !password)
  throw new Error('APP_URL and AUTH_TEST_PASSWORD are required.');
// Reuse one diagnostic key per deployment rather than consume the account's game quota.
const key = String(
  createHmac('sha256', password).update(origin).digest().readUInt32BE() %
    100_000_000,
).padStart(8, '0');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  const keyLeaks = [];
  page.on('request', (request) => {
    if (request.url().includes(key) || request.headers().referer?.includes(key))
      keyLeaks.push('Game key appeared in a URL or Referer.');
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/login`);
  await page
    .getByLabel('Username')
    .fill(process.env.AUTH_TEST_USERNAME ?? 'admin');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/key`, { timeout: 30_000 });
  // Override only the key-generation call in this diagnostic browser.
  const generate = page.getByRole('button', {
    name: 'Generate new game',
    exact: true,
  });
  await expect(generate).toBeEnabled();
  await generate.evaluate((button, key) => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (array) => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = Number(key);
        return array;
      }
      return original(array);
    };
    try {
      button.click();
    } finally {
      crypto.getRandomValues = original;
    }
  }, key);
  expect(
    (await page
      .getByRole('textbox', { name: 'Game key', exact: true })
      .inputValue()) === key,
  ).toBe(true);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/mode`);
  const manifestResponse = page.waitForResponse(
    `${origin}/api/content/manifest`,
  );
  const savedResponse = page.waitForResponse(
    (response) =>
      ['/api/games', '/api/games/current'].includes(
        new URL(response.url()).pathname,
      ) &&
      ['POST', 'PUT'].includes(response.request().method()) &&
      response.ok(),
  );
  await page
    .getByRole('button', { name: 'Streaming mode', exact: true })
    .click();
  const manifest = await manifestResponse;
  if (!manifest.ok())
    throw new Error(
      `Runtime content manifest returned HTTP ${manifest.status()}.`,
    );
  await expect(page).toHaveURL(`${origin}/game`, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: /room/i })).toBeVisible();
  await savedResponse;
  const { version } = await manifest.json();
  const saved = await page.request.get(`${origin}/api/games/current`, {
    headers: { 'x-game-key': key, 'x-content-version': version },
  });
  expect(saved.status()).toBe(200);
  const canonical = await saved.json();
  expect(canonical.gameHash === key && canonical.state.seed === key).toBe(true);
  expect(errors).toEqual([]);
  expect(keyLeaks).toEqual([]);
  await page.request.post(`${origin}/api/auth/logout`, {
    headers: { Origin: origin },
  });
  console.log(
    'Deployed login, runtime content loading, and Streaming room startup passed.',
  );
} finally {
  await browser.close();
}
