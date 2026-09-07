import { expect, signInAndChooseMode, test } from './fixtures';
import theme from '../src/lib/data/theme.json' with { type: 'json' };

test('shows all six landing metrics and session wording', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.care-card h3')).toHaveText([
    'Food',
    'Rest',
    'Health',
    'Bond',
    'Mood',
    'Creativity',
  ]);
  await expect(
    page.getByText('Make time for small moments of happiness.'),
  ).toBeVisible();
  await expect(
    page.getByText('Keep ideas flowing with a little inspiration.'),
  ).toBeVisible();
  await expect(page.locator('.care-readout > span')).toHaveCount(6);
  await expect(page.locator('.status-card')).toHaveText('SESSION');
  await expect(page.locator('body')).not.toContainText(/care room/i);
  await expect(page.locator('body')).not.toContainText(/CARE MODE|PET-01/);
  for (const link of await page.locator('.header-links a').all()) {
    await expect(link).toHaveCSS('background-color', 'rgb(47, 209, 192)');
    await expect(link).toHaveCSS(
      'box-shadow',
      'rgb(214, 72, 111) 3px 3px 0px 0px',
    );
    await link.hover();
    await expect(link).toHaveCSS(
      'box-shadow',
      'rgb(214, 72, 111) 1px 1px 0px 0px',
    );
  }
  await expect(page.locator('.status-card')).toHaveCSS(
    'background-color',
    'rgb(212, 175, 55)',
  );
  await expect(page.locator('.status-light')).toHaveCSS(
    'background-color',
    'rgb(47, 209, 192)',
  );
  await expect(page.locator('.device-wrap > article')).toHaveCSS(
    'border-radius',
    '10px',
  );
  for (const sticker of await page.locator('.sticker').all()) {
    await expect(sticker).toHaveCSS('background-color', 'rgb(47, 209, 192)');
  }
  for (const block of await page.locator('.sticker, .status-card').all()) {
    expect(
      await block.evaluate((element) => getComputedStyle(element).boxShadow),
    ).toContain('rgb(214, 72, 111)');
  }
  const cards = await page.locator('.care-card').evaluateAll((elements) =>
    elements.map((element) => ({
      top: element.getBoundingClientRect().top,
      fill: getComputedStyle(element).backgroundColor,
      shadow: getComputedStyle(element).boxShadow,
    })),
  );
  expect(cards.slice(0, 3).every((card) => card.top === cards[0].top)).toBe(
    true,
  );
  expect(cards.slice(3).every((card) => card.top === cards[3].top)).toBe(true);
  expect(cards[3].top).toBeGreaterThan(cards[0].top);
  expect(cards.map(({ fill, shadow }) => [fill, shadow])).toEqual([
    ['rgb(212, 175, 55)', 'rgb(214, 72, 111) 5px 5px 0px 0px'],
    ['rgb(214, 72, 111)', 'rgb(212, 175, 55) 5px 5px 0px 0px'],
    ['rgb(47, 209, 192)', 'rgb(214, 72, 111) 5px 5px 0px 0px'],
    ['rgb(47, 209, 192)', 'rgb(212, 175, 55) 5px 5px 0px 0px'],
    ['rgb(212, 175, 55)', 'rgb(214, 72, 111) 5px 5px 0px 0px'],
    ['rgb(214, 72, 111)', 'rgb(47, 209, 192) 5px 5px 0px 0px'],
  ]);
  for (const width of [1280, 600, 320]) {
    await page.setViewportSize({ width, height: 720 });
    const consoleSize = await page
      .locator('.device-wrap > article')
      .evaluate((element) => ({
        width: (element as HTMLElement).offsetWidth,
        height: (element as HTMLElement).offsetHeight,
        fits: element.scrollHeight <= element.clientHeight,
      }));
    expect(consoleSize.height).toBeGreaterThan(consoleSize.width);
    expect(consoleSize.fits).toBe(true);
    if (width > 320)
      expect(consoleSize.height / consoleSize.width).toBeCloseTo(1.1, 2);
    const spacing = await page
      .locator('.care-readout > span')
      .evaluateAll((rows) =>
        rows.map((row) => {
          const style = getComputedStyle(row);
          const context = document.createElement('canvas').getContext('2d')!;
          context.font = `${style.fontSize} ${style.fontFamily}`;
          return {
            gap: parseFloat(style.columnGap),
            characters: context.measureText('000').width,
            labelWidth: parseFloat(style.gridTemplateColumns),
            longestLabel:
              context.measureText('CREATIVITY').width +
              parseFloat(style.fontSize) * 0.4,
          };
        }),
      );
    for (const row of spacing) {
      expect(row.gap).toBeCloseTo(row.characters, 1);
      expect(row.labelWidth).toBeCloseTo(row.longestLabel, 1);
    }

    expect(
      await page
        .locator('.care-readout b')
        .evaluateAll((labels) =>
          labels.every((label) => label.scrollWidth <= label.clientWidth),
        ),
    ).toBe(true);
    expect(
      await page
        .locator('.care-readout .meter')
        .evaluateAll((meters) =>
          meters.every((meter) => meter.clientWidth > 20),
        ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page
      .locator('.care-grid')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});

test('uses white game cards with pink borders and gold shadows', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  const cards = page.locator('.metrics, .status-time-card, .event-panel');
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(card).toHaveCSS('border-color', 'rgb(214, 72, 111)');
    await expect(card).toHaveCSS(
      'box-shadow',
      'rgb(212, 175, 55) 8px 8px 0px 0px',
    );
  }
  await page.getByRole('button', { name: 'Feed', exact: true }).click();
  for (const card of await page
    .locator('.selection-dialog, .item-choice')
    .all()) {
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(card).toHaveCSS('border-color', 'rgb(214, 72, 111)');
  }
  await page.keyboard.press('Escape');
  await page.screenshot({
    path: '/tmp/game-cards-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: '/tmp/game-cards-mobile.png', fullPage: true });
});

test('provides the same palette on direct route loads and native controls', async ({
  page,
}) => {
  await signInAndChooseMode(page, 'Realtime mode');
  for (const path of [
    '/',
    '/about',
    '/login',
    '/key',
    '/game',
    '/game/history',
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    expect(
      await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        return {
          cream: root.getPropertyValue('--theme-cream').trim(),
          ink: root.getPropertyValue('--theme-ink').trim(),
          pink: root.getPropertyValue('--theme-pink').trim(),
          background: getComputedStyle(document.body).backgroundColor,
        };
      }),
    ).toEqual({
      cream: theme.cream,
      ink: theme.ink,
      pink: theme.pink,
      background: 'rgb(236, 232, 225)',
    });
    expect(
      await page.locator('button, input, select').evaluateAll((elements) =>
        elements.every((element) => {
          const style = getComputedStyle(element);
          return (
            style.borderRadius === '0px' &&
            style.backgroundImage === 'none' &&
            ['rgb(27, 21, 18)', 'rgb(0, 0, 0)'].includes(style.color)
          );
        }),
      ),
    ).toBe(true);
  }
  await page.goto('/game');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'A session-only companion game.',
  );
  expect(
    await page
      .locator('meter')
      .first()
      .evaluate(
        (element) =>
          getComputedStyle(element, '::-webkit-meter-optimum-value')
            .backgroundImage,
      ),
  ).toBe('none');
  await page.screenshot({
    path: '/tmp/companion-game-theme.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.screenshot({ path: '/tmp/companion-shop-desktop.png' });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.screenshot({ path: '/tmp/companion-shop-mobile.png' });
});
