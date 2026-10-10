import { devices, expect, test } from '@playwright/test';
import { ready, settled, talkState } from './helpers';

test.describe('«Путешествие» на десктопе', () => {
  test('клик по остановке в списке: полёт и полное слайдшоу', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await expect(page.locator('.app-tour__list button')).toHaveCount(13);
    await page.locator('[data-stop="9"]').click();
    const show = page.locator('.ui-slideshow');
    await expect(show).toBeVisible({ timeout: 30_000 });
    await expect(show).toContainText('Елабуга');
    await expect(show).toContainText('Значение для России');
    // все фото остановки, переход к соседней остановке
    await show.getByRole('button', { name: /Набережные Челны/ }).click();
    await expect(show).toContainText('КАМАЗ', { timeout: 30_000 });
  });

  test('«Источники» перечисляют авторов всех фото и данные карты', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: 'Источники' }).click();
    const d = page.locator('.app-sources');
    await expect(d).toBeVisible();
    await expect(d).toContainText('OpenStreetMap');
    await expect(d).toContainText('Copernicus');
    expect(await d.locator('.app-sources__photos li').count()).toBeGreaterThanOrEqual(13);
  });

  test('«Начать презентацию» переключает режим', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: 'Начать презентацию' }).click();
    await page.waitForURL(/mode=talk/);
    await ready(page);
    await expect(page.locator('.app-cover')).toBeVisible();
  });
});

test.describe('телефон', () => {
  const { defaultBrowserType: _ignored, ...pixel } = devices['Pixel 7'];
  test.use(pixel);

  test('открывается «Путешествие», список в шторке, без кнопки презентации', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: 'Остановки' }).click();
    await expect(page.locator('.app-tour')).toHaveClass(/is-open/);
    await expect(page.getByRole('button', { name: 'Начать презентацию' })).toBeHidden();
    await page.locator('[data-stop="3"]').click();
    await expect(page.locator('.ui-slideshow')).toContainText('Казанский кремль', { timeout: 30_000 });
  });

  test('касания в «Презентации»: правые 2/3 — вперёд, левая 1/3 — назад', async ({ page }) => {
    await page.goto('/?mode=talk#s=0&p=0');
    await ready(page);
    await settled(page, '0:0:slideshow');
    const { width, height } = page.viewportSize()!;
    await page.touchscreen.tap(width * 0.85, height * 0.5);
    await page.waitForTimeout(400);
    expect(await talkState(page)).toBe('0:1:slideshow');
    await page.touchscreen.tap(width * 0.1, height * 0.5);
    await page.waitForTimeout(400);
    expect(await talkState(page)).toBe('0:0:slideshow');
  });
});

test('без WebGL открывается HTML-версия со всеми остановками', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return (orig as any).call(this, type, ...rest);
    } as typeof orig;
  });
  await page.goto('/');
  await expect(page.locator('.fb-stop')).toHaveCount(13);
  await expect(page.locator('.fb-note')).toContainText('WebGL');
  await expect(page.locator('.fb-stop img').first()).toBeVisible();
});
