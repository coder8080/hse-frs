// Страница «Источники»: тексты по остановкам, атрибуция всех фото (из frontmatter, R12) и данных карты.
import type { RouteData } from '../content-types';
import { DATA_ATTRIBUTION } from './attribution';

let dialog: HTMLDialogElement | null = null;

export function openSources(route: RouteData): void {
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'app-sources';
    dialog.append(buildSources(route));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog!.close();
    });
    document.body.append(dialog);
  }
  dialog.showModal();
}

function buildSources(route: RouteData): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'app-sources__inner';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'app-btn app-sources__close';
  close.textContent = 'Закрыть';
  close.addEventListener('click', () => dialog?.close());
  const h = document.createElement('h2');
  h.textContent = 'Источники';
  wrap.append(close, h);

  for (const s of route.stops) {
    const sec = document.createElement('section');
    const t = document.createElement('h3');
    t.textContent = `${s.index}. ${s.title}`;
    sec.append(t);
    const texts = document.createElement('ul');
    for (const src of s.sources) {
      const li = document.createElement('li');
      if (src.url) {
        const a = document.createElement('a');
        a.href = src.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = src.title;
        li.append(a);
      } else li.textContent = src.title;
      texts.append(li);
    }
    sec.append(texts);
    const photos = document.createElement('ul');
    photos.className = 'app-sources__photos';
    for (const p of s.photos) {
      const li = document.createElement('li');
      li.textContent = `Фото «${p.caption}»: ${p.author}, ${p.license}`;
      if (p.source) {
        const a = document.createElement('a');
        a.href = p.source;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = ' (источник)';
        li.append(a);
      }
      photos.append(li);
    }
    sec.append(photos);
    wrap.append(sec);
  }
  const data = document.createElement('section');
  const dh = document.createElement('h3');
  dh.textContent = 'Данные карты';
  const dp = document.createElement('p');
  dp.textContent = DATA_ATTRIBUTION;
  data.append(dh, dp);
  wrap.append(data);
  return wrap;
}
