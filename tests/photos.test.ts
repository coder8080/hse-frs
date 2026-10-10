// Сжатие фото (R12): большое шумное фото с телефона → WebP ≤ 1600px и ≤ 300 КБ, кэш по хэшу.
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PHOTO_MAX_BYTES, PHOTO_MAX_SIDE, processPhoto } from '../vite-plugin-content/photos.ts';

let tmp = '';
let big = '';

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'po-photos-'));
  big = join(tmp, 'IMG_2041.JPG');
  // 4000×3000, случайный шум: худший случай для сжатия
  const w = 4000;
  const h = 3000;
  const noise = randomBytes(w * h * 3);
  const jpg = await sharp(noise, { raw: { width: w, height: h, channels: 3 } })
    .blur(0.6)
    .jpeg({ quality: 92 })
    .toBuffer();
  await writeFile(big, jpg);
}, 60_000);

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('processPhoto', () => {
  it('исходник действительно большой', async () => {
    expect((await stat(big)).size).toBeGreaterThan(4_000_000);
  });

  it('сжимает в WebP ≤ 1600px и ≤ 300 КБ, затем берёт из кэша', async () => {
    const cache = join(tmp, 'cache');
    const first = await processPhoto(big, cache);
    expect(first.cached).toBe(false);
    expect(first.path).toMatch(/img_2041-[0-9a-f]{16}\.webp$/);
    expect(Math.max(first.width, first.height)).toBeLessThanOrEqual(PHOTO_MAX_SIDE);
    expect(first.width / first.height).toBeCloseTo(4 / 3, 1);
    expect(first.bytes).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
    const meta = await sharp(first.path).metadata();
    expect(meta.format).toBe('webp');
    expect((await stat(first.path)).size).toBe(first.bytes);

    const t0 = performance.now();
    const second = await processPhoto(big, cache);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(second).toEqual({ ...first, cached: true });
    expect(await readdir(cache)).toHaveLength(1);
  }, 120_000);

  it('маленькое фото не увеличивает; поворот по EXIF учитывается', async () => {
    const src = join(tmp, 'small.jpg');
    // 300×200, ориентация 6 (повёрнуто на 90°) → на выходе 200×300
    await sharp({ create: { width: 300, height: 200, channels: 3, background: '#4a7' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(src);
    const res = await processPhoto(src, join(tmp, 'cache2'));
    expect([res.width, res.height]).toEqual([200, 300]);
  });
});
