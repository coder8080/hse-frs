// Фото с заглушкой (R18): при ошибке загрузки — рисунок в палитре сайта с подписью и автором.
import type { PhotoData } from '../content-types';
import { attributionText, h } from './dom';

// Простой пейзаж-заглушка: холмы и река в цветах диорамы (src/palette.ts).
const PLACEHOLDER_SVG = `
<svg viewBox="0 0 160 100" aria-hidden="true" focusable="false">
  <circle cx="118" cy="30" r="11" fill="#e0b44c" opacity=".85"/>
  <path d="M0 70 C25 52 45 50 70 62 S120 48 160 58 V100 H0Z" fill="#c2cf8e"/>
  <path d="M0 80 C30 66 60 70 90 78 S140 70 160 74 V100 H0Z" fill="#a8c686"/>
  <path d="M-4 92 C40 82 70 96 104 88 S150 84 164 90" fill="none" stroke="#6aaed2" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export interface PhotoFigureOptions {
  /** cover — кадрировать (карточка), contain — целиком (слайдшоу) */
  fit?: 'contain' | 'cover';
  /** Показывать подпись внутри заглушки */
  placeholderCaption?: boolean;
  /** Добавить <figcaption> с подписью и автором под фото (слайдшоу) */
  caption?: boolean;
}

/** Создаёт <figure> с <img>; при ошибке заменяет его заглушкой. */
export function createPhotoFigure(photo: PhotoData | undefined, opts: PhotoFigureOptions = {}): HTMLElement {
  const fig = h('figure.ui-photo', { 'data-fit': opts.fit ?? 'contain' });
  if (!photo) {
    fig.append(placeholder(undefined, opts.placeholderCaption ?? true));
    return fig;
  }
  const caption = opts.caption
    ? h(
        'figcaption.ui-photo__caption',
        {},
        h('span.ui-photo__caption-text', {}, photo.caption),
        h('span.ui-photo__credit', {}, attributionText(photo)),
      )
    : null;
  const img = h('img', {
    alt: photo.caption,
    decoding: 'async',
    draggable: 'false',
    width: photo.width || undefined,
    height: photo.height || undefined,
  });
  img.addEventListener('load', () => fig.classList.add('is-loaded'), { once: true });
  img.addEventListener(
    'error',
    () => {
      if (fig.dataset.released) return;
      console.error('[ui] фото не загрузилось:', photo.src);
      img.remove();
      fig.classList.add('is-broken');
      fig.prepend(placeholder(photo, opts.placeholderCaption ?? true));
    },
    { once: true },
  );
  img.src = photo.src;
  fig.append(img);
  if (caption) fig.append(caption);
  return fig;
}

function placeholder(photo: PhotoData | undefined, withCaption: boolean): HTMLElement {
  const box = h('div.ui-photo__placeholder', { role: 'img', 'aria-label': photo?.caption ?? 'Фото недоступно' });
  // заглушка тех же пропорций, что и фото, чтобы раскладка не прыгала
  if (photo && photo.width > 0 && photo.height > 0) {
    box.style.setProperty('--ph-ar', String(Math.min(2.4, Math.max(0.5, photo.width / photo.height))));
  }
  const art = h('div.ui-photo__art');
  art.innerHTML = PLACEHOLDER_SVG;
  box.append(art);
  if (withCaption && photo) {
    box.append(
      h('p.ui-photo__ph-caption', {}, photo.caption),
      h('p.ui-photo__ph-credit', {}, attributionText(photo)),
    );
  }
  box.append(h('p.ui-photo__ph-note', {}, 'Фото не загрузилось'));
  return box;
}

/** Освободить картинку (figure или обёртку с ним): сброс src, чтобы браузер отпустил пиксели. */
export function releasePhotoFigure(el: HTMLElement): void {
  const fig = el.matches('.ui-photo') ? el : el.querySelector<HTMLElement>('.ui-photo');
  if (fig) fig.dataset.released = '1';
  el.querySelector('img')?.removeAttribute('src');
  el.remove();
}
