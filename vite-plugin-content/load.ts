// Загрузчик контента: общий для Vite-плагина, scripts/check-content.ts и тестов.
//
//   const { route, warnings, unchecked } = await loadContent('content');
//
// Читает content/route.json и content/stops/<slug>.md, проверяет схему и перекрёстные
// связи (R10), сжимает фото (R12). Ошибки собираются все сразу и бросаются одним
// ContentError: сообщения по-русски, с файлом и строкой — их читают не программисты.
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import matter from 'gray-matter';
import { Marked } from 'marked';
import { z } from 'zod';
import { RouteSchema, StopSchema, type Route, type Stop } from '../content/schema.ts';
import type { PhotoData, StopData } from '../src/content-types.ts';
import { PHOTO_EXTENSIONS, processPhoto } from './photos.ts';

// ---------- типы результата ----------

/** Фото до сборки: вместо URL — путь к готовому WebP (URL выдаёт Vite) */
export interface LoadedPhoto extends Omit<PhotoData, 'src'> {
  /** Абсолютный путь к исходнику в content/photos/ */
  original: string;
  /** Абсолютный путь к сжатому WebP в кэше ('' при photos: false) */
  webp: string;
}

export interface LoadedStop extends Omit<StopData, 'photos' | 'talkPhotos'> {
  photos: LoadedPhoto[];
  /** Первые 3 фото — для «Доклада» (R13) */
  talkPhotos: LoadedPhoto[];
}

export interface LoadedRoute {
  title: string;
  subtitle?: string;
  stops: LoadedStop[];
}

export interface LoadResult {
  route: LoadedRoute;
  /** Предупреждения (не валят сборку): нет фактчека, пустое описание */
  warnings: string[];
  /** slug остановок без factcheck — `check:release` падает, если список не пуст (R11) */
  unchecked: string[];
  /** Все прочитанные файлы — для слежения в dev/watch */
  files: string[];
}

export interface LoadOptions {
  /** Куда класть сжатые WebP; по умолчанию <contentDir>/../.cache/photos */
  cacheDir?: string;
  /** false — только проверить, что файлы фото есть, без сжатия (width/height = 0) */
  photos?: boolean;
}

export interface ContentIssue {
  /** Абсолютный путь к файлу с ошибкой */
  file: string;
  /** Номер строки в файле (с 1), если удалось найти */
  line?: number;
  /** Поле, например photos[1].author */
  field?: string;
  message: string;
}

export function formatIssue(i: ContentIssue): string {
  const loc = basename(i.file) + (i.line ? `:${i.line}` : '');
  return i.field ? `${loc}: поле ${i.field} — ${i.message}` : `${loc} — ${i.message}`;
}

export class ContentError extends Error {
  readonly issues: ContentIssue[];
  constructor(issues: ContentIssue[]) {
    const n = issues.length;
    super(`Ошибки в контенте (${n}):\n` + issues.map((i) => '  • ' + formatIssue(i)).join('\n'));
    this.name = 'ContentError';
    this.issues = issues;
  }
}

// ---------- русские сообщения zod ----------

const TYPE_RU: Record<string, string> = {
  string: 'текст',
  number: 'число',
  boolean: 'true или false',
  array: 'список (строки с «- »)',
  object: 'набор полей',
  date: 'дата',
};

/** Сообщения по умолчанию; свои сообщения из схемы имеют приоритет */
const ruError: z.core.$ZodErrorMap = (iss) => {
  switch (iss.code) {
    case 'invalid_type': {
      if (iss.input === undefined) return 'обязательное поле не заполнено';
      const want = TYPE_RU[iss.expected] ?? iss.expected;
      const hint = iss.expected === 'number' && typeof iss.input === 'string' ? ' (без кавычек)' : '';
      return `ожидается ${want}${hint}`;
    }
    case 'too_small':
      if (iss.origin === 'string') return 'не может быть пустым';
      if (iss.origin === 'array') return `нужно хотя бы ${iss.minimum}`;
      return `должно быть не меньше ${iss.minimum}`;
    case 'too_big':
      if (iss.origin === 'string') return `не длиннее ${iss.maximum} символов`;
      if (iss.origin === 'array') return `не больше ${iss.maximum}`;
      return `должно быть не больше ${iss.maximum}`;
    case 'invalid_value':
      return `допустимые значения: ${iss.values.map(String).join(', ')}`;
    case 'invalid_format':
      return iss.format === 'url' ? 'нужна ссылка вида https://…' : 'неверный формат';
    default:
      return 'неверное значение';
  }
};

const KNOWN_KEYS = [
  ...Object.keys(StopSchema.shape),
  'file',
  'caption',
  'author',
  'license',
  'source',
  'url',
  'by',
  'date',
  'slug',
  'transition',
  'type',
  'height',
  'river',
  'via',
  'stops',
];

function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

function unknownKeyMessage(key: string): string {
  const near = KNOWN_KEYS.filter((k) => distance(k, key.toLowerCase()) <= 2).sort(
    (a, b) => distance(a, key) - distance(b, key),
  )[0];
  return near ? `лишнее поле, возможно опечатка: имелось в виду «${near}»?` : 'лишнее поле: такого поля нет в схеме';
}

const ARRAY_RU: Record<string, string> = { photos: 'фото', sources: 'источник', theses: 'тезис', stops: 'остановка' };

/** ['photos', 1, 'author'] → 'photos[1].author (фото № 2)' */
function fieldName(path: PropertyKey[]): string {
  let s = '';
  let hint = '';
  path.forEach((seg, i) => {
    if (typeof seg === 'number') {
      s += `[${seg}]`;
      const parent = path[i - 1];
      if (!hint && typeof parent === 'string' && ARRAY_RU[parent]) hint = ` (${ARRAY_RU[parent]} № ${seg + 1})`;
    } else s += (s ? '.' : '') + String(seg);
  });
  return s + hint;
}

function zodIssues(
  error: z.ZodError,
  file: string,
  locate: (path: PropertyKey[]) => number | undefined,
): ContentIssue[] {
  const out: ContentIssue[] = [];
  for (const iss of error.issues) {
    if (iss.code === 'unrecognized_keys') {
      for (const key of iss.keys) {
        const path = [...iss.path, key];
        out.push({ file, line: locate(path), field: fieldName(path), message: unknownKeyMessage(key) });
      }
      continue;
    }
    out.push({
      file,
      line: locate(iss.path),
      field: iss.path.length ? fieldName(iss.path) : undefined,
      message: iss.message,
    });
  }
  return out;
}

// ---------- поиск строки в YAML / JSON ----------

interface YamlRow {
  blank: boolean;
  indent: number;
  dash: boolean;
  key?: string;
  keyCol: number;
}

function analyzeRow(line: string): YamlRow {
  if (/^\s*(#.*)?$/.test(line)) return { blank: true, indent: 0, dash: false, keyCol: 0 };
  const indent = line.match(/^ */)![0].length;
  let rest = line.slice(indent);
  let col = indent;
  let dash = false;
  let m: RegExpMatchArray | null;
  while ((m = rest.match(/^-(\s+|$)/))) {
    dash = true;
    col += m[0].length;
    rest = rest.slice(m[0].length);
  }
  const km = rest.match(/^(["']?)([^"'\s#:][^"':]*?)\1\s*:(\s|$)/);
  return { blank: false, indent, dash, key: km?.[2], keyCol: col };
}

/**
 * Номер строки (с 0) в блоке YAML, где лежит поле по пути zod.
 * Если поля нет — строка ближайшего найденного родителя. Эвристика по отступам.
 */
export function locateYaml(lines: string[], path: PropertyKey[]): number | undefined {
  const rows = lines.map(analyzeRow);
  let s = 0;
  let e = lines.length;
  let found: number | undefined;
  const live = () => {
    const r: number[] = [];
    for (let i = s; i < e; i++) if (!rows[i].blank) r.push(i);
    return r;
  };
  for (const seg of path) {
    const idx = live();
    if (typeof seg === 'number') {
      const dashes = idx.filter((i) => rows[i].dash);
      if (!dashes.length) break;
      const ind = Math.min(...dashes.map((i) => rows[i].indent));
      const items = dashes.filter((i) => rows[i].indent === ind);
      if (seg >= items.length) break;
      found = items[seg];
      s = items[seg];
      e = items[seg + 1] ?? e;
    } else {
      const keys = idx.filter((i) => rows[i].key !== undefined);
      if (!keys.length) break;
      const col = Math.min(...keys.map((i) => rows[i].keyCol));
      const hit = keys.find((i) => rows[i].keyCol === col && rows[i].key === seg);
      if (hit === undefined) break;
      found = hit;
      let end = hit + 1;
      while (end < e && (rows[end].blank || rows[end].indent > col || (rows[end].indent === col && rows[end].dash)))
        end++;
      s = hit + 1;
      e = end;
    }
  }
  return found;
}

/** Строка (с 1) поля в route.json: для stops[i] — строка i-го "slug" */
function locateJson(text: string, path: PropertyKey[]): number | undefined {
  const lines = text.split(/\r?\n/);
  if (path[0] === 'stops' && typeof path[1] === 'number') {
    let n = -1;
    for (let i = 0; i < lines.length; i++) if (/"slug"\s*:/.test(lines[i]) && ++n === path[1]) return i + 1;
    return undefined;
  }
  if (typeof path[0] === 'string') {
    const re = new RegExp(`"${path[0]}"\\s*:`);
    const i = lines.findIndex((l) => re.test(l));
    return i >= 0 ? i + 1 : undefined;
  }
  return undefined;
}

// ---------- YAML-ошибки по-русски ----------

const YAML_RU: [RegExp, string][] = [
  [/duplicated mapping key/, 'это поле уже есть выше — поле не может повторяться'],
  [/bad indentation/, 'неверный отступ: проверьте пробелы в начале строки'],
  [/tab characters?/i, 'в отступе стоит табуляция — используйте пробелы'],
  [/within a double quoted scalar|within a single quoted scalar/, 'не закрыта кавычка (ищите выше)'],
  [/within a flow collection/, 'не закрыта скобка ] или }'],
  [/missed comma between flow collection entries/, 'не хватает запятой в списке [ … ]'],
  [
    /end of the stream or a document separator is expected/,
    'не удалось разобрать строку (или строку выше): не хватает двоеточия после имени поля или кавычек вокруг текста с двоеточием',
  ],
  [
    /multiline key may not be an implicit key|incomplete explicit mapping pair/,
    'не удалось разобрать строку: если в тексте есть двоеточие, возьмите весь текст в кавычки',
  ],
];

function yamlMessage(reason: string): string {
  for (const [re, ru] of YAML_RU) if (re.test(reason)) return `ошибка YAML: ${ru}`;
  return `ошибка YAML: ${reason}`;
}

// ---------- разбор файлов ----------

const md = new Marked({ gfm: true, async: false });

interface ParsedStop {
  slug: string;
  file: string;
  stop: Stop;
  html: string;
  body: string;
  locate: (path: PropertyKey[]) => number | undefined;
}

function parseStop(file: string, text: string, issues: ContentIssue[]): ParsedStop | undefined {
  const src = text.replace(/^﻿/, '');
  const lines = src.split(/\r?\n/);
  if (!/^---\s*$/.test(lines[0] ?? '')) {
    issues.push({ file, line: 1, message: 'файл должен начинаться со строки --- (затем поля, затем снова ---)' });
    return undefined;
  }
  const close = lines.findIndex((l, i) => i > 0 && /^---\s*$/.test(l));
  if (close < 0) {
    issues.push({ file, line: 1, message: 'не закрыт блок полей: после полей нужна строка ---' });
    return undefined;
  }
  let parsed: matter.GrayMatterFile<string>;
  try {
    // объект опций отключает кэш gray-matter
    parsed = matter(src, {});
  } catch (e) {
    const err = e as { reason?: string; message?: string; mark?: { line: number } };
    // блок gray-matter начинается сразу после '---' (с перевода строки), поэтому +1
    const line = err.mark ? err.mark.line + 1 : undefined;
    issues.push({ file, line, message: yamlMessage(err.reason ?? err.message ?? String(e)) });
    return undefined;
  }
  const front = lines.slice(1, close);
  const locate = (path: PropertyKey[]) => {
    const i = locateYaml(front, path);
    return i === undefined ? undefined : i + 2;
  };
  const res = StopSchema.safeParse(parsed.data ?? {}, { error: ruError });
  if (!res.success) {
    issues.push(...zodIssues(res.error, file, locate));
    return undefined;
  }
  const body = parsed.content.trim();
  return {
    slug: basename(file, '.md'),
    file,
    stop: res.data,
    body,
    html: body ? (md.parse(body) as string) : '',
    locate,
  };
}

async function readRoute(file: string, issues: ContentIssue[]): Promise<{ route: Route; text: string } | undefined> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    issues.push({ file, message: 'нет файла route.json со списком остановок' });
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    const msg = (e as Error).message;
    let line: number | undefined;
    const lm = msg.match(/line (\d+)/);
    const pm = msg.match(/position (\d+)/);
    if (lm) line = Number(lm[1]);
    else if (pm) line = text.slice(0, Number(pm[1])).split('\n').length;
    issues.push({ file, line, message: `ошибка JSON: проверьте запятые, кавычки и скобки рядом с этой строкой (${msg})` });
    return undefined;
  }
  const res = RouteSchema.safeParse(json, { error: ruError });
  if (!res.success) {
    issues.push(...zodIssues(res.error, file, (p) => locateJson(text, p)));
    return undefined;
  }
  return { route: res.data, text };
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true })).filter((d) => d.isFile()).map((d) => d.name);
  } catch {
    return [];
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ---------- главная функция ----------

export async function loadContent(contentDir: string, opts: LoadOptions = {}): Promise<LoadResult> {
  const dir = resolve(contentDir);
  const cacheDir = resolve(opts.cacheDir ?? join(dir, '..', '.cache', 'photos'));
  const stopsDir = join(dir, 'stops');
  const photosDir = join(dir, 'photos');
  const routeFile = join(dir, 'route.json');
  const issues: ContentIssue[] = [];

  // 1. route.json
  const r = await readRoute(routeFile, issues);
  const route = r?.route;
  const routeLine = (i: number) => (r ? locateJson(r.text, ['stops', i]) : undefined);

  if (route) {
    const seen = new Map<string, number>();
    route.stops.forEach((s, i) => {
      if (seen.has(s.slug)) {
        issues.push({
          file: routeFile,
          line: routeLine(i),
          field: fieldName(['stops', i, 'slug']),
          message: `остановка «${s.slug}» уже есть в маршруте (stops[${seen.get(s.slug)}]) — уберите повтор`,
        });
      } else seen.set(s.slug, i);
      const t = s.transition.type;
      if (i === 0 && t !== 'start')
        issues.push({
          file: routeFile,
          line: routeLine(i),
          field: fieldName(['stops', i, 'transition']),
          message: 'у первой остановки переход должен быть { "type": "start" }',
        });
      if (i > 0 && t === 'start')
        issues.push({
          file: routeFile,
          line: routeLine(i),
          field: fieldName(['stops', i, 'transition']),
          message: 'переход start бывает только у первой остановки',
        });
      if (i < route.stops.length - 1 && t === 'final')
        issues.push({
          file: routeFile,
          line: routeLine(i),
          field: fieldName(['stops', i, 'transition']),
          message: 'переход final бывает только у последней остановки',
        });
    });
  }

  // 2. файлы остановок
  const mdFiles = (await listDir(stopsDir)).filter((f) => extname(f) === '.md').sort();
  const photoFiles = new Set(await listDir(photosDir));
  const parsed = new Map<string, ParsedStop>();
  const files = [routeFile];
  for (const name of mdFiles) {
    const file = join(stopsDir, name);
    files.push(file);
    const p = parseStop(file, await readFile(file, 'utf8'), issues);
    if (p) parsed.set(p.slug, p);
  }

  // 3. перекрёстная проверка с route.json (R10)
  if (route) {
    const inRoute = new Set(route.stops.map((s) => s.slug));
    route.stops.forEach((s, i) => {
      if (!mdFiles.includes(`${s.slug}.md`))
        issues.push({
          file: routeFile,
          line: routeLine(i),
          field: fieldName(['stops', i, 'slug']),
          message: `нет файла content/stops/${s.slug}.md для остановки «${s.slug}»`,
        });
    });
    for (const name of mdFiles) {
      const slug = basename(name, '.md');
      if (!inRoute.has(slug))
        issues.push({
          file: join(stopsDir, name),
          message: `этой остановки нет в content/route.json — добавьте { "slug": "${slug}", … } в список stops или удалите файл`,
        });
    }
  }

  // 4. файлы фото
  for (const p of parsed.values()) {
    p.stop.photos.forEach((ph, i) => {
      const path = ['photos', i, 'file'];
      const bad = (message: string) =>
        issues.push({ file: p.file, line: p.locate(path), field: fieldName(path), message });
      const name = ph.file;
      if (name !== basename(name) || name.includes('\\'))
        return bad(`укажите только имя файла, без папок (например ${basename(name.replace(/\\/g, '/'))})`);
      if (!PHOTO_EXTENSIONS.includes(extname(name).toLowerCase()))
        return bad('формат не поддерживается: нужен файл .jpg, .png или .webp');
      if (!photoFiles.has(name)) {
        const near = [...photoFiles].find((f) => f.toLowerCase() === name.toLowerCase());
        return bad(
          `нет такого файла content/photos/${name}` +
            (near ? ` — есть «${near}»: проверьте большие и маленькие буквы` : ''),
        );
      }
    });
  }

  if (issues.length) throw new ContentError(issues);
  // сюда доходим только с корректным route.json
  const okRoute = route!;

  // 5. сжатие фото (R12): одинаковые исходники сжимаются один раз
  const jobs = new Map<string, { file: string; line?: number; field: string }>();
  for (const s of okRoute.stops) {
    const p = parsed.get(s.slug)!;
    p.stop.photos.forEach((ph, i) => {
      const src = join(photosDir, ph.file);
      if (!jobs.has(src))
        jobs.set(src, { file: p.file, line: p.locate(['photos', i, 'file']), field: fieldName(['photos', i, 'file']) });
    });
  }
  const processed = new Map<string, { webp: string; width: number; height: number }>();
  if (opts.photos !== false) {
    await mapLimit([...jobs], 4, async ([src, where]) => {
      try {
        const res = await processPhoto(src, cacheDir);
        processed.set(src, { webp: res.path, width: res.width, height: res.height });
      } catch (e) {
        issues.push({ ...where, message: `не удалось обработать фото: ${(e as Error).message}` });
      }
    });
    if (issues.length) throw new ContentError(issues);
  }
  files.push(...jobs.keys());

  // 6. итоговые данные в порядке route.json
  const warnings: string[] = [];
  const unchecked: string[] = [];
  const stops: LoadedStop[] = okRoute.stops.map((rs, index) => {
    const p = parsed.get(rs.slug)!;
    const s = p.stop;
    const photos: LoadedPhoto[] = s.photos.map((ph) => {
      const original = join(photosDir, ph.file);
      const done = processed.get(original);
      return {
        original,
        webp: done?.webp ?? '',
        width: done?.width ?? 0,
        height: done?.height ?? 0,
        caption: ph.caption,
        author: ph.author,
        license: ph.license,
        ...(ph.source ? { source: ph.source } : {}),
      };
    });
    if (!s.factcheck) {
      unchecked.push(rs.slug);
      warnings.push(`${rs.slug}.md — факты не проверены (нет поля factcheck)`);
    }
    if (!p.body) warnings.push(`${rs.slug}.md — нет полного описания (текст после второй строки ---)`);
    return {
      slug: rs.slug,
      index,
      title: s.title,
      ...(s.subtitle ? { subtitle: s.subtitle } : {}),
      lat: s.lat,
      lon: s.lon,
      category: s.category,
      kind: s.kind,
      card: s.card,
      theses: s.theses,
      ...(s.link ? { link: s.link } : {}),
      photos,
      talkPhotos: photos.slice(0, 3),
      sources: s.sources,
      duration: s.duration,
      speaker: s.speaker,
      ...(s.factcheck ? { factcheck: s.factcheck } : {}),
      html: p.html,
      transition: rs.transition,
    };
  });

  return {
    route: { title: okRoute.title, ...(okRoute.subtitle ? { subtitle: okRoute.subtitle } : {}), stops },
    warnings,
    unchecked,
    files,
  };
}
