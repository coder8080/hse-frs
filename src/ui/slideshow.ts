// Слайдшоу остановки поверх размытого канваса.
// talk — «Доклад»: фото доклада (R13) + 3–4 тезиса крупно, листает машина состояний;
// tour — «Путешествие»: все фото с кнопками/свайпом, полный текст, источники, связка.
// В DOM живут только текущее и соседние фото (остальные освобождаются).
import type { PhotoData, StopData } from '../content-types';
import { FADE_MS, h, reducedMotion, setShown, typo } from './dom';
import { createPhotoFigure, releasePhotoFigure } from './photo';

export type SlideshowVariant = 'talk' | 'tour';

export interface SlideshowOptions {
  variant: SlideshowVariant;
  /** Куда вставить оверлей (по умолчанию document.body) */
  parent?: HTMLElement;
  /** Оверлей открылся — поставить 3D-рендер на паузу */
  onOpen?: () => void;
  /** Оверлей закрылся — продолжить рендер */
  onClose?: () => void;
  /** tour: фото сменилось кнопкой/свайпом/стрелкой */
  onPhotoChange?: (photoIndex: number) => void;
  /** tour: крестик, Esc или клик по фону. Закрыть должен вызывающий (close()). */
  onRequestClose?: () => void;
  /** tour: кнопки «предыдущая/следующая остановка» (появляются, если задано) */
  onStopNav?: (dir: -1 | 1) => void;
  /** tour: стрелки ←/→ и Esc, пока слайдшоу открыто (по умолчанию да) */
  keyboard?: boolean;
}

export interface SlideshowOpenOptions {
  /** Строка над заголовком (по умолчанию категория остановки) */
  label?: string;
  /** tour: подписи кнопок перехода между остановками; без названия кнопка неактивна */
  prevTitle?: string;
  nextTitle?: string;
}

const SWIPE_PX = 40;

export class Slideshow {
  readonly el: HTMLElement;
  private readonly opts: SlideshowOptions;
  private readonly sheet: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly count: HTMLElement;
  private readonly dots: HTMLElement;
  private readonly prevBtn?: HTMLButtonElement;
  private readonly nextBtn?: HTMLButtonElement;

  private stop: StopData | null = null;
  private photos: PhotoData[] = [];
  private index = 0;
  private opened = false;
  private readonly figures = new Map<number, HTMLElement>();
  private readonly pruneTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(opts: SlideshowOptions) {
    this.opts = opts;
    const tour = opts.variant === 'tour';

    this.stage = h('div.ui-ss__stage');
    this.dots = h('span.ui-ss__dots', { 'aria-hidden': 'true' });
    this.count = h('span.ui-ss__count-num');
    // индикатор «2 / 3»: в «Докладе» внизу этикетки (виден докладчику), в «Путешествии» на фото
    this.progress = h('p.ui-ss__count', {}, this.dots, this.count);

    const media = h('div.ui-ss__media', {}, this.stage);
    if (tour) {
      this.prevBtn = h('button.ui-ss__nav.ui-ss__nav--prev', { type: 'button', 'aria-label': 'Предыдущее фото' }, '‹');
      this.nextBtn = h('button.ui-ss__nav.ui-ss__nav--next', { type: 'button', 'aria-label': 'Следующее фото' }, '›');
      this.prevBtn.addEventListener('click', () => this.step(-1));
      this.nextBtn.addEventListener('click', () => this.step(1));
      media.append(this.prevBtn, this.nextBtn);
      this.attachSwipe();
    }
    if (tour) media.append(this.progress);

    this.panel = h('div.ui-ss__panel');
    this.sheet = h('div.ui-ss__sheet', { tabindex: '-1' }, media, this.panel);
    this.el = h(
      'section.ui-slideshow.ui-layer',
      { 'data-variant': opts.variant, role: 'dialog', 'aria-modal': 'true', hidden: true, 'data-state': 'closed' },
      this.sheet,
    );
    if (tour) {
      this.el.addEventListener('click', (e) => {
        if (e.target === this.el) this.opts.onRequestClose?.();
      });
    }
    (opts.parent ?? document.body).append(this.el);
    // метрики шрифтов меняются после их загрузки — подгоняем этикетку ещё раз
    if (!tour) document.fonts?.ready.then(() => this.fitPanel());
  }

  get isOpen(): boolean {
    return this.opened;
  }

  get photoIndex(): number {
    return this.index;
  }

  get currentStop(): StopData | null {
    return this.stop;
  }

  /** Открыть (или перерисовать уже открытое) слайдшоу остановки на фото photoIndex. */
  open(stop: StopData, photoIndex = 0, o: SlideshowOpenOptions = {}): void {
    const sameStop = this.stop === stop;
    this.stop = stop;
    this.photos = this.opts.variant === 'talk' ? (stop.talkPhotos.length ? stop.talkPhotos : stop.photos.slice(0, 3)) : stop.photos;
    if (!sameStop) {
      this.clearFigures();
      this.renderPanel(stop, o);
      this.renderDots();
      // высоту сцены на телефоне задаёт первое фото, чтобы текст не прыгал при листании
      const first = this.photos[0];
      const ratio = first && first.width > 0 && first.height > 0 ? first.width / first.height : 1.5;
      const ar = Math.min(2, Math.max(0.8, ratio));
      this.el.style.setProperty('--ss-ar', ar.toFixed(3));
    }
    this.el.setAttribute('aria-label', stop.title);
    this.index = -1;
    this.showPhoto(photoIndex);

    if (!this.opened) {
      this.opened = true;
      setShown(this.el, true);
      if (this.opts.variant === 'talk') window.addEventListener('resize', this.onResize);
      if (this.opts.variant === 'tour') {
        if (this.opts.keyboard !== false) document.addEventListener('keydown', this.onKey);
        this.panel.scrollTop = 0;
        this.sheet.scrollTop = 0;
        this.sheet.focus({ preventScroll: true });
      }
      this.opts.onOpen?.();
    } else if (!sameStop) {
      this.panel.scrollTop = 0;
      this.sheet.scrollTop = 0;
    }
    if (!sameStop) this.fitPanel();
  }

  /**
   * talk: если тезисы не влезают в этикетку по высоте, текст мельчает ступенями (--fit 1 → 0,6).
   * Тексты правит команда — длина заранее неизвестна, а экраны ноутбуков разные.
   */
  fitPanel(): void {
    if (this.opts.variant !== 'talk' || this.el.hidden) return;
    const panel = this.panel;
    let fit = 1;
    panel.style.setProperty('--fit', '1');
    while (panel.scrollHeight > panel.clientHeight + 1 && fit > 0.6) {
      fit = Math.round((fit - 0.04) * 100) / 100;
      panel.style.setProperty('--fit', String(fit));
    }
  }

  /** Показать фото с индексом (с плавной сменой ≤ 250 мс). */
  showPhoto(photoIndex: number): void {
    const n = Math.max(1, this.photos.length);
    const i = Math.min(Math.max(0, Math.floor(photoIndex) || 0), n - 1);
    if (i === this.index) return;
    const prev = this.index;
    this.index = i;

    // текущее и соседние
    for (const j of [i - 1, i, i + 1]) {
      if (j < 0 || j >= n || this.figures.has(j)) continue;
      const slot = h('div.ui-ss__photo', {}, createPhotoFigure(this.photos[j], { fit: 'contain', placeholderCaption: false, caption: true }));
      this.figures.set(j, slot);
      this.stage.append(slot);
    }
    for (const [j, fig] of this.figures) fig.classList.toggle('is-current', j === i);
    this.stage.classList.toggle('is-instant', prev === -1);

    // освобождаем дальние после окончания перехода
    const t = setTimeout(
      () => {
        this.pruneTimers.delete(t);
        for (const [j, fig] of this.figures) {
          if (Math.abs(j - this.index) > 1) {
            releasePhotoFigure(fig);
            this.figures.delete(j);
          }
        }
      },
      reducedMotion() ? 0 : FADE_MS + 30,
    );
    this.pruneTimers.add(t);

    this.count.textContent = `${i + 1} / ${n}`;
    this.progress.hidden = n < 2;
    this.dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('is-on', j === i));
    if (this.prevBtn) this.prevBtn.disabled = i === 0;
    if (this.nextBtn) this.nextBtn.disabled = i >= n - 1;
    this.el.classList.toggle('has-many', n > 1);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    document.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    setShown(this.el, false);
    this.opts.onClose?.();
  }

  destroy(): void {
    this.close();
    for (const t of this.pruneTimers) clearTimeout(t);
    this.clearFigures();
    this.el.remove();
  }

  // ——— внутреннее ———

  private step(dir: -1 | 1): void {
    const before = this.index;
    this.showPhoto(this.index + dir);
    if (this.index !== before) this.opts.onPhotoChange?.(this.index);
  }

  private readonly onResize = () => this.fitPanel();

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowLeft') this.step(-1);
    else if (e.key === 'ArrowRight') this.step(1);
    else if (e.key === 'Escape') this.opts.onRequestClose?.();
    else return;
    e.preventDefault();
  };

  private attachSwipe(): void {
    let start: { x: number; y: number; id: number } | null = null;
    this.stage.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    this.stage.addEventListener('pointerup', (e) => {
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.3) this.step(dx < 0 ? 1 : -1);
    });
    this.stage.addEventListener('pointercancel', () => (start = null));
  }

  private clearFigures(): void {
    for (const fig of this.figures.values()) releasePhotoFigure(fig);
    this.figures.clear();
    this.index = -1;
  }

  private renderDots(): void {
    this.dots.replaceChildren(...this.photos.map(() => h('i')));
  }

  private renderPanel(stop: StopData, o: SlideshowOpenOptions): void {
    const tour = this.opts.variant === 'tour';
    const parts: HTMLElement[] = [];
    if (tour && this.opts.onRequestClose) {
      const close = h('button.ui-ss__close', { type: 'button', 'aria-label': 'Закрыть' }, h('span', { 'aria-hidden': 'true' }, '×'));
      close.addEventListener('click', () => this.opts.onRequestClose?.());
      parts.push(close);
    }
    parts.push(
      h('p.ui-kicker', {}, o.label ?? stop.category),
      h('h2.ui-ss__title', {}, stop.title),
    );
    if (stop.subtitle) parts.push(h('p.ui-ss__subtitle', {}, stop.subtitle));

    if (!tour) {
      const theses = stop.theses.slice(0, 4);
      if (theses.length) parts.push(h('ol.ui-ss__theses', {}, ...theses.map((t) => h('li', {}, typo(t)))));
      else parts.push(h('p.ui-ss__lead', {}, typo(stop.card)));
      parts.push(this.progress);
    } else {
      if (stop.link) parts.push(h('p.ui-ss__link', {}, stop.link));
      const body = h('div.ui-ss__body.ui-prose');
      body.innerHTML = stop.html || `<p>${escapeHtml(stop.card)}</p>`;
      body.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
        a.target = '_blank';
        a.rel = 'noopener';
      });
      parts.push(body);
      if (stop.sources.length) {
        parts.push(
          h(
            'section.ui-ss__sources',
            {},
            h('h3', {}, 'Источники'),
            h(
              'ol',
              {},
              ...stop.sources.map((s) =>
                h('li', {}, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title) : s.title),
              ),
            ),
          ),
        );
      }
      if (this.opts.onStopNav) {
        const prev = h('button.ui-ss__stop-btn', { type: 'button', disabled: !o.prevTitle }, h('small', {}, '← Назад'), o.prevTitle ?? '—');
        const next = h('button.ui-ss__stop-btn.ui-ss__stop-btn--next', { type: 'button', disabled: !o.nextTitle }, h('small', {}, 'Дальше →'), o.nextTitle ?? '—');
        prev.addEventListener('click', () => this.opts.onStopNav?.(-1));
        next.addEventListener('click', () => this.opts.onStopNav?.(1));
        parts.push(h('nav.ui-ss__stopnav', { 'aria-label': 'Остановки' }, prev, next));
      }
    }
    this.panel.replaceChildren(...parts);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
