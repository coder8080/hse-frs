// Vite-плагин контента: `import route from 'virtual:content'` → RouteData.
// Данные готовит loadContent (load.ts); фото импортируются из кэша WebP,
// поэтому Vite сам хэширует и выкладывает их в dist/assets (работает и с base './').
import { join, relative, resolve, sep, isAbsolute } from 'node:path';
import { normalizePath, searchForWorkspaceRoot, type Plugin, type ResolvedConfig } from 'vite';
import { ContentError, loadContent, type LoadedRoute, type LoadResult } from './load.ts';

const ID = 'virtual:content';
const RESOLVED = '\0' + ID;

export interface ContentPluginOptions {
  /** Папка контента (по умолчанию <root>/content) */
  contentDir?: string;
  /** Кэш сжатых фото (по умолчанию <root>/.cache/photos) */
  cacheDir?: string;
}

/** Код модуля: фото — import'ы WebP, остальное — JSON */
export function generateModule(route: LoadedRoute): string {
  const imports = new Map<string, string>();
  const name = (path: string) => {
    if (!imports.has(path)) imports.set(path, `photo${imports.size}`);
    return imports.get(path)!;
  };
  const toData = (p: LoadedRoute['stops'][number]['photos'][number]) => {
    const { original: _o, webp, ...rest } = p;
    return { src: `\0photo:${name(webp)}\0`, ...rest };
  };
  const data = {
    ...route,
    stops: route.stops.map((s) => ({ ...s, photos: s.photos.map(toData), talkPhotos: s.talkPhotos.map(toData) })),
  };
  const json = JSON.stringify(data, null, 1).replace(/"\\u0000photo:(photo\d+)\\u0000"/g, '$1');
  const head = [...imports].map(([path, n]) => `import ${n} from ${JSON.stringify(normalizePath(path))};`);
  return `${head.join('\n')}\nexport default ${json};\n`;
}

export default function content(opts: ContentPluginOptions = {}): Plugin {
  let config: ResolvedConfig;
  let contentDir = '';
  let cacheDir = '';
  let pending: Promise<LoadResult> | null = null;
  let lastWarnings = '';

  const load = () => {
    pending ??= loadContent(contentDir, { cacheDir }).then(
      (r) => {
        const text = r.warnings.join('\n');
        if (text && text !== lastWarnings) {
          config.logger.warn(
            `\nКонтент: предупреждения (${r.warnings.length}):\n` + r.warnings.map((w) => '  • ' + w).join('\n'),
          );
        }
        lastWarnings = text;
        return r;
      },
      (e) => {
        pending = null; // следующая попытка перечитает файлы
        throw e;
      },
    );
    return pending;
  };

  return {
    name: 'po-content',

    config(user) {
      const root = resolve(user.root ?? process.cwd());
      const cache = resolve(root, opts.cacheDir ?? '.cache/photos');
      const rel = relative(root, cache);
      // кэш вне корня проекта нужно явно разрешить dev-серверу
      if (rel.startsWith('..') || isAbsolute(rel)) {
        return { server: { fs: { allow: [searchForWorkspaceRoot(root), cache] } } };
      }
    },

    configResolved(c) {
      config = c;
      contentDir = resolve(c.root, opts.contentDir ?? 'content');
      cacheDir = resolve(c.root, opts.cacheDir ?? '.cache/photos');
    },

    async buildStart() {
      // в сборке проверяем контент всегда, даже если модуль ещё никто не импортирует
      if (config.command !== 'build') return;
      try {
        await load();
      } catch (e) {
        this.error(e instanceof ContentError ? e.message : String(e));
      }
    },

    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },

    async load(id) {
      if (id !== RESOLVED) return;
      let r: LoadResult;
      try {
        r = await load();
      } catch (e) {
        if (config.command === 'serve') this.addWatchFile(join(contentDir, 'route.json'));
        throw e instanceof ContentError ? new Error(e.message) : e;
      }
      for (const f of r.files) this.addWatchFile(f);
      return generateModule(r.route);
    },

    configureServer(server) {
      server.watcher.add(contentDir);
      const onChange = (file: string) => {
        if (!file.startsWith(contentDir + sep) || file.endsWith('.ts')) return;
        pending = null;
        const graph = server.environments.client.moduleGraph;
        const mod = graph.getModuleById(RESOLVED);
        if (mod) graph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
