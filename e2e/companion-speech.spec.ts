import type { Page } from '@playwright/test';
import type { Activity } from '../src/lib/game-types';
import { expect, signInAndChooseMode, test } from './fixtures';

const hour = 3_600_000;
const quotes = {
  idle: ['Idle test quote.'],
  click: ['Click test one.', 'Click test two.'],
  'click:stream': ['Stream click test.'],
  feed: ['Feed test quote.'],
  stream: ['Hourly stream test.'],
  'stream:start': ['Starting stream test.'],
  'rest:complete': ['Wake-up test quote.'],
  'medical_care:complete': ['Hospital return test quote.'],
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-08-22T17:00:00Z') });
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value: (values: Uint32Array) => {
        values.fill(1);
        return values;
      },
    });
  });
  await page.route('**/api/content/quotes', (route) =>
    route.fulfill({ json: quotes }),
  );
  await signInAndChooseMode(page, 'Realtime mode');
});

async function prepareRoom(
  page: Page,
  type: Activity['type'] | null = null,
  duration = 2 * hour,
) {
  await page.evaluate(
    async ({ type, duration }) => {
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
              const now = Date.now();
              record.state.now = record.state.lastResolvedAt = now;
              record.state.history.runStartedAt = now;
              record.state.history.nextAutonomousAt = now + 1000 * 3_600_000;
              record.state.metrics = {
                food: 10,
                rest: 10,
                health: 24,
                mood: 8,
                bond: 8,
                creativity: 8,
              };
              record.state.statuses =
                type === 'rest'
                  ? {
                      sick: {
                        since: now,
                        source: 'speech-test',
                        lastPenaltyAt: now,
                      },
                    }
                  : {};
              record.state.inventory = { water: 4, 'desk-chair': 1 };
              record.state.activity = type
                ? {
                    id: 'speech-activity',
                    type,
                    startedAt: now,
                    endsAt: now + duration,
                    sourceActionId: 'speech-test',
                    payload: {
                      startingRest: 4,
                      startingMood: 8,
                      hourlyRate: 1,
                      startingCriticalMetrics: '',
                      principal: 0,
                      scheduledDailyPayment: 0,
                      insuredAtStart: false,
                    },
                  }
                : null;
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
    { type, duration },
  );
  const loaded = page.waitForResponse('**/api/content/quotes');
  await page.reload();
  await loaded;
  await expect(page.getByRole('button', { name: 'Talk to Bri' })).toBeVisible();
}

test('clicks and keyboard activation speak without advancing time', async ({
  page,
}) => {
  await prepareRoom(page);
  const avatar = page.getByRole('button', { name: 'Talk to Bri' });
  const bubble = page.locator('.speech-bubble');
  const before = await page.locator('.session-clock').innerText();
  await avatar.focus();
  await page.keyboard.press('Enter');
  const first = await bubble.innerText();
  await page.keyboard.press('Space');
  await expect(bubble).not.toHaveText(first);
  await page.screenshot({ path: '/tmp/companion-speech-desktop.png' });
  await page.clock.runFor(11_000);
  await expect(bubble).toBeVisible();
  await avatar.blur();
  await page.clock.runFor(4000);
  await bubble.hover();
  await page.clock.runFor(11_000);
  await expect(bubble).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.runFor(6500);
  await expect(bubble).toHaveCount(0);
  await expect(page.locator('.session-clock')).toHaveText(before);
});

test('hourly stream speech works while care is blocked and sleep clears it', async ({
  page,
}) => {
  await prepareRoom(page, 'stream', 8 * hour);
  await expect(
    page.getByRole('button', { name: 'Feed', exact: true }),
  ).toBeDisabled();
  await page.clock.runFor(hour + 1000);
  await expect(page.locator('.speech-bubble')).toHaveText(
    'Hourly stream test.',
  );
  await page.getByRole('button', { name: 'Talk to Bri' }).click();
  await expect(page.locator('.speech-bubble')).toHaveText('Stream click test.');
  await prepareRoom(page, 'rest');
  await expect(page.locator('.speech-bubble')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Talk to Bri' }),
  ).toBeDisabled();
});

for (const type of ['rest', 'medical_care'] as const) {
  test(`${type} stays silent and speaks immediately on completion`, async ({
    page,
  }) => {
    await prepareRoom(page, type, hour / 2);
    const avatar = page.getByRole('button', { name: 'Talk to Bri' });
    await expect(avatar).toBeDisabled();
    await page.clock.runFor(hour / 2 + 1000);
    await expect(avatar).toBeEnabled();
    await expect(page.locator('.speech-bubble')).toHaveText(
      quotes[`${type}:complete`][0],
    );
  });
}

test('feeding shows one response after the picker closes', async ({ page }) => {
  await prepareRoom(page);
  await page.getByRole('button', { name: 'Feed', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add Water to selection' }).click();
  await dialog.getByRole('button', { name: 'Feed selected' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.speech-bubble')).toHaveText('Feed test quote.');
});

test('room navigation clears speech and timers; modal controls and narrow layout still work', async ({
  page,
}) => {
  await prepareRoom(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Talk to Bri' }).click();
  const bubble = page.locator('.speech-bubble');
  const bounds = await bubble.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: '/tmp/companion-speech-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByRole('dialog').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Choose an item for Chair', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('.companion-avatar')).toHaveCount(0);
  await page.clock.runFor(2 * hour);
  const loaded = page.waitForResponse('**/api/content/quotes');
  await page.getByRole('link', { name: 'Room', exact: true }).click();
  await loaded;
  await expect(bubble).toHaveCount(0);
});

test('unavailable quotes leave the game usable', async ({ page }) => {
  await page.route('**/api/content/quotes', (route) =>
    route.fulfill({ status: 503 }),
  );
  await prepareRoom(page);
  await page.getByRole('button', { name: 'Talk to Bri' }).click();
  await expect(page.locator('.speech-bubble')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Feed', exact: true }),
  ).toBeEnabled();
});
