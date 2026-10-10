// Скачивает фото с Wikimedia Commons в content/photos/ и печатает запись для frontmatter.
//
//   npm run photo -- "File:Kazan Kremlin.jpg" kazan-kremlin-1 ["Подпись"]
//
// Автор и лицензия берутся из extmetadata Commons. Свободные лицензии проверяются:
// файл без CC/PD/GFDL не скачивается. Сжатие в WebP делает сборка (R12),
// здесь сохраняем JPEG 2000px (~0,5–1 МБ), чтобы не хранить многомегабайтные оригиналы.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHOTOS = join(ROOT, 'content', 'photos');
const UA = 'po-techeniyu-vekov/0.1 (HSE student project; https://github.com/coder8080/hse-frs)';

export interface CommonsPhoto {
  file: string;
  caption: string;
  author: string;
  license: string;
  source: string;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FREE = /^(cc|public domain|pd|gfdl|fal|free art|attribution|copyrighted free use|no restrictions)/i;

export async function fetchCommons(title: string, name: string, caption?: string): Promise<CommonsPhoto> {
  const t = title.startsWith('File:') ? title : `File:${title}`;
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.search = new URLSearchParams({
    action: 'query',
    titles: t,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size|mime',
    iiurlwidth: '2000',
    format: 'json',
    formatversion: '2',
  }).toString();
  const res = await fetch(api, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons API: HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const page = json.query?.pages?.[0];
  if (!page || page.missing) throw new Error(`Нет такого файла на Commons: ${t}`);
  const info = page.imageinfo[0];
  const meta = info.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value ?? '');
  if (!FREE.test(license)) throw new Error(`${t}: лицензия «${license}» не похожа на свободную`);
  const author = stripHtml(meta.Artist?.value ?? '') || 'неизвестен';
  const url: string = info.thumburl ?? info.url;
  const img = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!img.ok) throw new Error(`${url}: HTTP ${img.status}`);
  await mkdir(PHOTOS, { recursive: true });
  const file = `${name}.jpg`;
  const jpg = await sharp(Buffer.from(await img.arrayBuffer()))
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await writeFile(join(PHOTOS, file), jpg);
  return {
    file,
    caption: caption ?? stripHtml(meta.ObjectName?.value ?? page.title.replace(/^File:/, '')),
    author,
    license,
    source: info.descriptionurl,
  };
}

function yamlString(s: string): string {
  return JSON.stringify(s);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [title, name, caption] = process.argv.slice(2);
  if (!title || !name) {
    console.error('Использование: npm run photo -- "File:Имя.jpg" slug-1 ["Подпись"]');
    process.exit(1);
  }
  fetchCommons(title, name, caption)
    .then((p) => {
      console.log(
        [
          `  - file: ${p.file}`,
          `    caption: ${yamlString(p.caption)}`,
          `    author: ${yamlString(p.author)}`,
          `    license: ${yamlString(p.license)}`,
          `    source: ${p.source}`,
        ].join('\n'),
      );
    })
    .catch((e) => {
      console.error(String(e.message ?? e));
      process.exit(1);
    });
}
