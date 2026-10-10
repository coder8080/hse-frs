// Точка входа: выбор режима, проверка WebGL, ленивая загрузка 3D (three.js не нужен HTML-версии).
import route from 'virtual:content';
import { chooseMode, hasWebGL } from './app/mode';
import { detectDevice } from './device';

const root = document.querySelector<HTMLElement>('#app')!;
const params = new URLSearchParams(location.search);

async function fallback(reason: string) {
  const { renderFallback } = await import('./app/fallback');
  document.body.classList.add('is-fallback');
  renderFallback(root, route, reason);
}

async function boot() {
  if (params.has('html') || !hasWebGL()) {
    await fallback(
      params.has('html')
        ? 'Текстовая версия маршрута.'
        : 'Ваш браузер не поддерживает 3D (WebGL), поэтому открыта текстовая версия маршрута.',
    );
    return;
  }
  const { startApp } = await import('./app/app');
  await startApp(root, route, { mode: chooseMode(location.search), device: detectDevice(), debug: params.has('debug') });
}

boot().catch((err) => {
  console.error(err);
  void fallback('3D-карта не запустилась, поэтому открыта текстовая версия маршрута.');
});
