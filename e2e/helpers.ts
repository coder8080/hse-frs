import { expect, type Page } from '@playwright/test';

/** Ждём, пока 3D-приложение запустится. */
export async function ready(page: Page): Promise<void> {
  await page.waitForSelector('body[data-ready="1"]', { timeout: 30_000 });
}

/** Состояние «Доклада»: «остановка:фото:фаза». */
export function talkState(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.body.dataset.talk);
}

/** Ждём, пока полёт закончится и откроется слайдшоу или карточка. */
export async function settled(page: Page, expected?: string): Promise<string> {
  await expect
    .poll(async () => {
      const s = await talkState(page);
      return s && !s.endsWith(':flying') ? s : 'flying';
    }, { timeout: 15_000 })
    .not.toBe('flying');
  const s = (await talkState(page))!;
  if (expected) expect(s).toBe(expected);
  return s;
}

/** Нажатие с паузой больше антидребезга (300 мс). */
export async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(350);
}
