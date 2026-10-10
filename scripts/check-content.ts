// Проверка контента без сборки сайта.
//
//   npm run check:content   — схема, route.json, файлы фото (и сжатие в кэш)
//   npm run check:release   — то же + падает, если у остановки нет factcheck (R11)
//
// Необязательно: --dir <папка контента> (для тестов).
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentError, formatIssue, loadContent } from '../vite-plugin-content/load.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const release = args.includes('--release');
const dirArg = args.indexOf('--dir');
const contentDir = dirArg >= 0 ? args[dirArg + 1] : join(ROOT, 'content');
const inCI = !!process.env.GITHUB_ACTIONS;

// В GitHub Actions ошибка ещё и подсвечивается прямо на строке файла
function annotate(kind: 'error' | 'warning', file: string, line: number | undefined, text: string) {
  if (!inCI) return;
  const esc = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const loc = `file=${relative(process.cwd(), file)}${line ? `,line=${line}` : ''}`;
  console.log(`::${kind} ${loc}::${esc(text)}`);
}

try {
  const { route, warnings, unchecked } = await loadContent(contentDir);
  const photos = route.stops.reduce((n, s) => n + s.photos.length, 0);
  if (warnings.length) {
    console.warn(`Предупреждения (${warnings.length}):`);
    for (const w of warnings) console.warn('  • ' + w);
  }
  if (release && unchecked.length) {
    console.error(
      `\nВыпуск не готов: у ${unchecked.length} остановок нет factcheck: ${unchecked.join(', ')}.\n` +
        'Проверьте факты и добавьте в файл остановки:\nfactcheck:\n  by: Имя Фамилия\n  date: 2026-11-01',
    );
    for (const slug of unchecked)
      annotate('error', join(contentDir, 'stops', `${slug}.md`), 1, 'нет поля factcheck: факты не проверены');
    process.exit(1);
  }
  console.log(`Контент в порядке: ${route.stops.length} остановок, ${photos} фото.`);
} catch (e) {
  if (e instanceof ContentError) {
    console.error(e.message);
    console.error('\nИсправьте файлы и запустите проверку снова. Подсказки — в README.md.');
    for (const i of e.issues) annotate('error', i.file, i.line, formatIssue(i));
    process.exit(1);
  }
  throw e;
}
