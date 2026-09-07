import { expect, signInAndChooseMode, test } from './fixtures';

test('shares the room artwork across the landing preview and game', async ({
  page,
}) => {
  await page.goto('/');
  const landing = page.locator('.screen .room-background');
  const landingAvatar = page.locator('.landing-companion');
  await expect(landingAvatar).toBeVisible();
  const avatarSource = await landingAvatar.getAttribute('src');
  await expect
    .poll(() =>
      landingAvatar.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(landing).toBeVisible();
  await expect(page.locator('.screen div.cat-bed')).toBeVisible();
  await expect(page.locator('.screen .room-background-frame')).toHaveClass(
    /fill/,
  );
  await expect(landing).toHaveAttribute(
    'src',
    /assets\/room\/room-front-bed\.svg#day$/,
  );
  await page.screenshot({ path: '/tmp/room-landing-desktop.png' });

  await signInAndChooseMode(page, 'Realtime mode');
  await expect(page.locator('.room-scene .companion')).toHaveAttribute(
    'src',
    avatarSource!,
  );
  const background = page.locator('.room-scene .room-background');
  await expect(background).toBeVisible();
  const daypart = await page
    .locator('.room-page')
    .evaluate((element) =>
      [...element.classList]
        .find((name) => name.startsWith('daypart-'))!
        .slice('daypart-'.length),
    );
  await expect(background).toHaveAttribute(
    'src',
    new RegExp(`assets/room/room-front-bed\\.svg#${daypart}$`),
  );

  const skyColors = await page.evaluate(async () => {
    const colors = [];
    for (const part of ['morning', 'day', 'evening', 'night']) {
      const image = new Image();
      image.src = `/assets/room/room-front-bed.svg#${part}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 680;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0, 900, 680);
      colors.push([...context.getImageData(550, 110, 1, 1).data]);
    }
    return colors;
  });
  expect(skyColors).toEqual([
    [204, 239, 232, 255],
    [243, 180, 109, 255],
    [241, 202, 208, 255],
    [141, 140, 184, 255],
  ]);

  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const scene = await page.locator('.room-scene').boundingBox();
    expect(scene!.width / scene!.height).toBeCloseTo(900 / 680, 2);
    const catBed = page.locator('.room-scene div.cat-bed');
    await expect(catBed).toHaveCSS('border-radius', '50%');
    const catBedSize = await catBed.boundingBox();
    expect(catBedSize!.width).toBeCloseTo(catBedSize!.height, 1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const button of await page.locator('.anchor-place').all()) {
      await button.click({ trial: true });
    }
    await page.locator('.room-card').screenshot({
      path: `/tmp/room-game-${width}.png`,
    });
    await page
      .getByRole('button', { name: 'Choose an item for Desk', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Room', exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }

  await page.goto('/');
  await expect(landing).toBeVisible();
  await expect(page.locator('.screen div.cat-bed')).toBeVisible();
  await page.screenshot({ path: '/tmp/room-landing-mobile.png' });
  await page.goto('/assets/room/room-svg-demo.html');
  await page.getByRole('button', { name: 'Night', exact: true }).click();
  await expect(page.locator('[data-part="window-sky"]')).toHaveAttribute(
    'fill',
    '#8D8CB8',
  );
  await expect(
    page.getByRole('link', { name: 'Download front-view SVG' }),
  ).toHaveAttribute('href', 'room-front-bed.svg');
});
