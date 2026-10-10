// Сжатие фото (R12): любой JPG/PNG/WebP → WebP ≤ 1600px по длинной стороне и ≤ 300 КБ.
// Результат кэшируется по хэшу содержимого файла: повторная сборка не пережимает фото.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_MAX_BYTES = 300 * 1000;
export const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** Меняется при смене алгоритма — старый кэш перестаёт совпадать */
const ALGO = 'webp-v1';
const QUALITIES = [82, 74, 66, 58, 50, 42];
const MIN_SIDE = 400;

export interface ProcessedPhoto {
  /** Абсолютный путь к готовому WebP в кэше */
  path: string;
  width: number;
  height: number;
  bytes: number;
  /** true — взят из кэша без пережатия */
  cached: boolean;
}

function cacheName(src: string, hash: string): string {
  const stem = basename(src, extname(src))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${stem || 'photo'}-${hash}.webp`;
}

async function exists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

export async function processPhoto(src: string, cacheDir: string): Promise<ProcessedPhoto> {
  const input = await readFile(src);
  const hash = createHash('sha256')
    .update(`${ALGO}:${PHOTO_MAX_SIDE}:${PHOTO_MAX_BYTES}:`)
    .update(input)
    .digest('hex')
    .slice(0, 16);
  const out = join(cacheDir, cacheName(src, hash));

  if (await exists(out)) {
    const meta = await sharp(out).metadata();
    const { size } = await stat(out);
    return { path: out, width: meta.width ?? 0, height: meta.height ?? 0, bytes: size, cached: true };
  }

  // Декодируем и уменьшаем один раз, дальше кодируем из сырых пикселей
  let side = PHOTO_MAX_SIDE;
  let raw = await sharp(input, { failOn: 'none' })
    .rotate() // поворот по EXIF: фото с телефона не лягут на бок
    .resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (;;) {
    const { width, height, channels } = raw.info;
    for (const quality of QUALITIES) {
      const data = await sharp(raw.data, { raw: { width, height, channels } })
        .webp({ quality, effort: 4 })
        .toBuffer();
      if (data.length <= PHOTO_MAX_BYTES) {
        await mkdir(cacheDir, { recursive: true });
        // через временный файл: параллельные сборки не увидят недописанный WebP
        const tmp = `${out}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
        await writeFile(tmp, data);
        await rename(tmp, out);
        return { path: out, width, height, bytes: data.length, cached: false };
      }
    }
    // Даже низкое качество не влезло (шумное фото) — уменьшаем размер
    side = Math.round(Math.max(width, height) * 0.8);
    if (side < MIN_SIDE) throw new Error(`не удалось сжать фото до ${PHOTO_MAX_BYTES / 1000} КБ`);
    raw = await sharp(raw.data, { raw: { width, height, channels } })
      .resize({ width: side, height: side, fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
  }
}
