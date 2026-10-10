// Загрузчик контента: порядок из route.json, понятные ошибки, factcheck, фото «Доклада».
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentError, formatIssue, loadContent } from '../vite-plugin-content/load.ts';
import content, { generateModule } from '../vite-plugin-content/index.ts';
import { build } from 'vite';

const ROOT = join(import.meta.dirname, '..');
const FIXTURE = join(ROOT, 'tests/fixtures/content');
const temps: string[] = [];

/** Копия фикстуры во временной папке: <tmp>/content */
async function fixture(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), 'po-content-'));
  temps.push(tmp);
  const dir = join(tmp, 'content');
  await cp(FIXTURE, dir, { recursive: true });
  return dir;
}

async function edit(dir: string, rel: string, fn: (s: string) => string) {
  const file = join(dir, rel);
  await writeFile(file, fn(await readFile(file, 'utf8')));
}

async function errorsOf(dir: string): Promise<string[]> {
  try {
    await loadContent(dir, { photos: false });
  } catch (e) {
    if (e instanceof ContentError) return e.issues.map(formatIssue);
    throw e;
  }
  throw new Error('ожидалась ошибка контента');
}

afterEach(async () => {
  await Promise.all(temps.splice(0).map((t) => rm(t, { recursive: true, force: true })));
});

describe('корректный контент', () => {
  it('загружается в порядке route.json с индексом и переходом', async () => {
    const dir = await fixture();
    const { route, files } = await loadContent(dir);
    expect(route.title).toBe('Тестовый маршрут');
    expect(route.stops.map((s) => s.slug)).toEqual(['alpha', 'beta', 'gamma']);
    expect(route.stops.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(route.stops[1].transition).toEqual({ type: 'river', river: 'volga' });
    expect(route.stops[0].html).toContain('<strong>альфы</strong>');
    expect(route.stops[0].factcheck).toEqual({ by: 'Проверяющий', date: '2026-11-01' });
    expect(route.stops[2].theses).toEqual([]);
    expect(files).toContain(join(dir, 'stops/alpha.md'));
  });

  it('фото сжаты в WebP с размерами; одинаковый исходник — один файл', async () => {
    const dir = await fixture();
    const { route } = await loadContent(dir);
    const [alpha, beta, gamma] = route.stops;
    for (const p of [...alpha.photos, ...gamma.photos]) {
      expect(p.webp).toMatch(/\.webp$/);
      expect(existsSync(p.webp)).toBe(true);
      expect(p.width).toBeGreaterThan(0);
    }
    expect(alpha.photos[0]).toMatchObject({ width: 48, height: 32, author: 'Автор Один', license: 'CC BY-SA 4.0' });
    expect(alpha.photos[0].source).toBe('https://commons.wikimedia.org/wiki/File:P1.jpg');
    expect(gamma.photos[0]).toMatchObject({ width: 24, height: 40 });
    expect(beta.photos[0].webp).toBe(alpha.photos[0].webp);
  });

  it('talkPhotos — первые 3 фото (R13)', async () => {
    const { route } = await loadContent(await fixture(), { photos: false });
    const alpha = route.stops[0];
    expect(alpha.photos).toHaveLength(4);
    expect(alpha.talkPhotos.map((p) => p.caption)).toEqual(['Первое фото', 'Второе фото', 'Третье фото']);
    expect(route.stops[1].talkPhotos).toHaveLength(1);
  });

  it('модуль virtual:content импортирует WebP и не содержит путей к исходникам', async () => {
    const { route } = await loadContent(await fixture());
    const code = generateModule(route);
    expect(code).toMatch(/^import photo0 from ".*\.webp";/);
    expect(code).toContain('"src": photo0');
    expect(code).not.toContain('original');
    expect(code).not.toContain('p1.jpg');
    // все 5 разных исходников → 5 импортов
    expect(code.match(/^import /gm)).toHaveLength(5);
  });
  it('vite build с base ./ выкладывает WebP в assets и ссылается на них относительно', async () => {
    const dir = await fixture();
    const root = join(dir, '..');
    await writeFile(join(root, 'index.html'), '<!doctype html><script type="module" src="./main.js"></script>');
    await writeFile(join(root, 'main.js'), "import route from 'virtual:content'; console.log(route);");
    await build({ root, configFile: false, base: './', logLevel: 'silent', plugins: [content()], build: { assetsInlineLimit: 0 } });
    const assets = await readdir(join(root, 'dist/assets'));
    expect(assets.filter((f) => f.endsWith('.webp'))).toHaveLength(5);
    const js = await readFile(join(root, 'dist/assets', assets.find((f) => f.endsWith('.js'))!), 'utf8');
    expect(js).toMatch(/new URL\(`p1-[0-9a-f]{16}-[\w-]+\.webp`,import\.meta\.url\)/);
    expect(js).toContain('Тестовый маршрут');
  }, 30_000);
});

describe('понятные ошибки', () => {
  it('сломанный YAML: файл, строка и что не так', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/beta.md', (s) => s.replace('title: Бета\n', 'title: Бета\ntitle: Ещё раз\n'));
    const errors = await errorsOf(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^beta\.md:3 — ошибка YAML: это поле уже есть выше/);
  });

  it('сломанный отступ в YAML', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/beta.md', (s) => s.replace('lat: 55.8\n', '   lat: 55.8\n'));
    const [e] = await errorsOf(dir);
    expect(e).toMatch(/^beta\.md:\d+ — ошибка YAML: /);
  });

  it('нет автора у фото — строка этого фото', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/alpha.md', (s) => s.replace('    author: Автор Два\n', ''));
    expect(await errorsOf(dir)).toEqual([
      'alpha.md:18: поле photos[1].author (фото № 2) — у фото должен быть автор',
    ]);
  });

  it('пустая лицензия', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/gamma.md', (s) => s.replace('license: CC BY 4.0', 'license: ""'));
    expect(await errorsOf(dir)).toEqual([
      'gamma.md:12: поле photos[0].license (фото № 1) — у фото должна быть лицензия',
    ]);
  });

  it('нет файла фото', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/alpha.md', (s) => s.replace('file: p3.jpg', 'file: nope.jpg'));
    expect(await errorsOf(dir)).toEqual([
      'alpha.md:22: поле photos[2].file (фото № 3) — нет такого файла content/photos/nope.jpg',
    ]);
  });

  it('файл фото с другим регистром букв — подсказка', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/gamma.md', (s) => s.replace('file: p5.png', 'file: P5.png'));
    const [e] = await errorsOf(dir);
    expect(e).toContain('есть «p5.png»');
  });

  it('опечатка в имени поля', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/beta.md', (s) => s.replace('card:', 'crad:'));
    const errors = await errorsOf(dir);
    expect(errors).toContain('beta.md:7: поле crad — лишнее поле, возможно опечатка: имелось в виду «card»?');
    expect(errors).toContain('beta.md: поле card — нужна короткая подпись-карточка (одна строка)');
  });

  it('число в кавычках', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/beta.md', (s) => s.replace('duration: 90', 'duration: "90"'));
    expect(await errorsOf(dir)).toEqual(['beta.md:19: поле duration — длительность — целое число секунд без кавычек']);
  });

  it('slug в route.json без файла', async () => {
    const dir = await fixture();
    await edit(dir, 'route.json', (s) =>
      s.replace('{ "slug": "gamma"', '{ "slug": "delta", "transition": { "type": "arc" } },\n    { "slug": "gamma"'),
    );
    expect(await errorsOf(dir)).toEqual([
      'route.json:7: поле stops[2].slug (остановка № 3) — нет файла content/stops/delta.md для остановки «delta»',
    ]);
  });

  it('файл остановки, которого нет в route.json', async () => {
    const dir = await fixture();
    await writeFile(join(dir, 'stops/extra.md'), await readFile(join(dir, 'stops/gamma.md'), 'utf8'));
    const [e] = await errorsOf(dir);
    expect(e).toMatch(/^extra\.md — этой остановки нет в content\/route\.json/);
  });

  it('повтор slug и переходы start/final не на своих местах', async () => {
    const dir = await fixture();
    await edit(dir, 'route.json', (s) =>
      s
        .replace('"slug": "alpha", "transition": { "type": "start" }', '"slug": "alpha", "transition": { "type": "arc" }')
        .replace('"type": "river", "river": "volga"', '"type": "start"')
        .replace('{ "slug": "gamma", "transition": { "type": "final" } }', '{ "slug": "gamma", "transition": { "type": "final" } },\n    { "slug": "beta", "transition": { "type": "arc" } }'),
    );
    const errors = await errorsOf(dir);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^route\.json:5: поле stops\[0\]\.transition .*должен быть \{ "type": "start" \}/),
        expect.stringMatching(/^route\.json:6: поле stops\[1\]\.transition .*только у первой/),
        expect.stringMatching(/^route\.json:7: поле stops\[2\]\.transition .*только у последней/),
        expect.stringMatching(/^route\.json:8: поле stops\[3\]\.slug .*«beta» уже есть/),
      ]),
    );
  });

  it('неизвестный тип перехода', async () => {
    const dir = await fixture();
    await edit(dir, 'route.json', (s) => s.replace('"type": "river", "river": "volga"', '"type": "boat"'));
    expect(await errorsOf(dir)).toEqual([
      'route.json:6: поле stops[1].transition.type (остановка № 2) — тип перехода — одно из: start, arc, river, final',
    ]);
  });

  it('сломанный route.json — строка ошибки JSON', async () => {
    const dir = await fixture();
    await edit(dir, 'route.json', (s) => s.replace('"Три остановки",', '"Три остановки"'));
    const [e] = await errorsOf(dir);
    expect(e).toMatch(/^route\.json:4 — ошибка JSON/);
  });

  it('у ключевой остановки нужно 2–4 тезиса, у пролётной можно без них', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/beta.md', (s) => s.replace('  - Тезис беты два\n', ''));
    expect(await errorsOf(dir)).toEqual(['beta.md:8: поле theses — у ключевой остановки нужно 2–4 тезиса']);
  });

  it('показывает все ошибки сразу', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/alpha.md', (s) => s.replace('    author: Автор Два\n', ''));
    await edit(dir, 'stops/gamma.md', (s) => s.replace('file: p5.png', 'file: nope.png'));
    await writeFile(join(dir, 'stops/extra.md'), '---\ntitle: [\n---\n');
    const errors = await errorsOf(dir);
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).toMatch(/alpha\.md.*автор/);
    expect(errors.join('\n')).toMatch(/gamma\.md.*nope\.png/);
    expect(errors.join('\n')).toMatch(/extra\.md:\d+ — ошибка YAML/);
    expect(errors.join('\n')).toMatch(/extra\.md — этой остановки нет/);
  });
});

describe('factcheck (R11)', () => {
  it('предупреждения о непроверенных остановках', async () => {
    const { warnings, unchecked } = await loadContent(await fixture(), { photos: false });
    expect(unchecked).toEqual(['beta', 'gamma']);
    expect(warnings).toEqual([
      'beta.md — факты не проверены (нет поля factcheck)',
      'gamma.md — факты не проверены (нет поля factcheck)',
    ]);
  });

  const tsx = join(ROOT, 'node_modules/.bin/tsx');
  const run = (...args: string[]) =>
    spawnSync(tsx, ['scripts/check-content.ts', ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } });

  it('check:content проходит, check:release падает без factcheck', async () => {
    const dir = await fixture();
    const ok = run('--dir', dir);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain('Контент в порядке: 3 остановок, 6 фото');
    const rel = run('--release', '--dir', dir);
    expect(rel.status).toBe(1);
    expect(rel.stderr).toContain('beta, gamma');
  }, 30_000);

  it('check:release проходит, когда все проверены', async () => {
    const dir = await fixture();
    for (const f of ['beta', 'gamma'])
      await edit(dir, `stops/${f}.md`, (s) => s.replace(/(speaker: \d\n)/, '$1factcheck:\n  by: Кто-то\n  date: 2026-11-02\n'));
    const rel = run('--release', '--dir', dir);
    expect(rel.status, rel.stderr).toBe(0);
  }, 30_000);

  it('check:content падает с понятной ошибкой', async () => {
    const dir = await fixture();
    await edit(dir, 'stops/alpha.md', (s) => s.replace('    author: Автор Два\n', ''));
    const res = run('--dir', dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('alpha.md:18: поле photos[1].author (фото № 2) — у фото должен быть автор');
  }, 30_000);
});
