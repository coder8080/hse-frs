import { expect, test } from '@playwright/test';
import { press, ready, settled, talkState } from './helpers';

test.describe('«Доклад»', () => {
  test('полный прогон с кликера: от обложки до финала, без внешних запросов', async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url());
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/?mode=talk');
    await ready(page);
    await expect(page.locator('.app-cover')).toBeVisible();
    await press(page, 'PageDown');
    await expect(page.locator('.app-cover')).toBeHidden();
    expect(await settled(page)).toBe('0:0:slideshow');

    // листаем до конца: каждое нажатие — следующее фото или следующая остановка
    let last = '';
    for (let i = 0; i < 80; i++) {
      const s = await settled(page);
      if (s === last) break; // «Вперёд» на финале ничего не делает
      last = s;
      await press(page, 'PageDown');
      // полёт доводится вторым нажатием, как докладчик с кликером (иначе прогон слишком долгий на CI)
      if ((await talkState(page))?.endsWith(':flying')) await press(page, 'PageDown');
    }
    expect(last.startsWith('12:')).toBe(true);
    await expect(page.locator('.app-qr')).toBeVisible();
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('двойное нажатие в пределах 300 мс сдвигает только на один шаг', async ({ page }) => {
    await page.goto('/?mode=talk#s=0&p=0');
    await ready(page);
    await settled(page, '0:0:slideshow');
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(80);
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(400);
    expect(await talkState(page)).toBe('0:1:slideshow');
  });

  test('нажатие во время полёта мгновенно доводит переход', async ({ page }) => {
    await page.goto('/?mode=talk#s=0&p=2');
    await ready(page);
    await settled(page, '0:2:slideshow');
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(350);
    expect(await talkState(page)).toBe('1:0:flying');
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(150);
    expect(await talkState(page)).toBe('1:0:slideshow');
  });

  test('F5 посреди доклада возвращает на то же место без полёта', async ({ page }) => {
    await page.goto('/?mode=talk#s=3&p=0');
    await ready(page);
    await settled(page, '3:0:slideshow');
    await press(page, 'PageDown');
    expect(page.url()).toContain('#s=3&p=1');
    await page.reload();
    await ready(page);
    expect(await talkState(page)).toBe('3:1:slideshow');
    await expect(page.locator('.app-cover')).toBeHidden();
  });

  test('битый хэш открывает остановку 0', async ({ page }) => {
    await page.goto('/?mode=talk#s=99&p=abc');
    await ready(page);
    expect(await settled(page)).toBe('0:0:slideshow');
  });

  test('«Назад» в ключевую остановку открывает её последнее фото, в пролётную — карточку', async ({ page }) => {
    await page.goto('/?mode=talk#s=2&p=0');
    await ready(page);
    await settled(page, '2:0:card');
    await expect(page.locator('.ui-card')).toBeVisible();
    await press(page, 'PageUp');
    expect(await settled(page)).toMatch(/^1:(\d):slideshow$/);
    const [, photo] = (await talkState(page))!.split(':');
    expect(Number(photo)).toBeGreaterThan(0);
    await press(page, 'PageDown');
    await settled(page, '2:0:card');
  });

  test('потеря WebGL-контекста не останавливает доклад', async ({ page }) => {
    // пролётная остановка: карта видна и рендерится (слайдшоу ставит рендер на паузу)
    await page.goto('/?mode=talk#s=2&p=0');
    await ready(page);
    await settled(page, '2:0:card');
    await page.evaluate(() => {
      const r = (window as any).__app.renderer;
      (window as any).__lose = r.getContext().getExtension('WEBGL_lose_context');
      (window as any).__lose.loseContext();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).__lose.restoreContext());
    await page.waitForTimeout(500);
    const f1 = await page.evaluate(() => (window as any).__app.stats().frame);
    await page.waitForTimeout(500);
    const f2 = await page.evaluate(() => (window as any).__app.stats().frame);
    expect(f2).toBeGreaterThan(f1);
    await press(page, 'PageDown');
    expect(await settled(page)).toBe('3:0:slideshow');
  });

  test('сломанное фото показывает заглушку с подписью', async ({ page }) => {
    await page.route(/bolgar-1-.*\.webp$/, (r) => r.fulfill({ status: 404, body: '' }));
    await page.goto('/?mode=talk#s=1&p=0');
    await ready(page);
    await settled(page, '1:0:slideshow');
    await expect(page.locator('.ui-slideshow .ui-photo.is-broken').first()).toBeVisible();
    await expect(page.locator('.ui-photo__ph-note').first()).toHaveText('Фото не загрузилось');
    await press(page, 'PageDown');
    expect(await talkState(page)).toBe('1:1:slideshow');
  });

  test('B — чёрный экран', async ({ page }) => {
    await page.goto('/?mode=talk#s=0&p=0');
    await ready(page);
    await page.keyboard.press('b');
    await expect(page.locator('.ui-black')).toBeVisible();
    await page.keyboard.press('b');
    await expect(page.locator('.ui-black')).toBeHidden();
  });
});
