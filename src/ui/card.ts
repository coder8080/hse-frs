// Компактная карточка пролётной остановки в «Докладе»: одно фото, название, одна строка.
// Прижата к левому нижнему углу, карта остаётся видна (без размытия и паузы рендера).
import type { StopData } from '../content-types';
import { attributionText, h, setShown, typo } from './dom';
import { createPhotoFigure, releasePhotoFigure } from './photo';

export interface CardOptions {
  parent?: HTMLElement;
}

export class Card {
  readonly el: HTMLElement;
  private readonly media: HTMLElement;
  private readonly body: HTMLElement;
  private fig: HTMLElement | null = null;
  private stop: StopData | null = null;
  private opened = false;

  constructor(opts: CardOptions = {}) {
    this.media = h('div.ui-card__media');
    this.body = h('div.ui-card__body');
    this.el = h('aside.ui-card.ui-layer', { hidden: true, 'data-state': 'closed', 'aria-live': 'polite' }, this.media, this.body);
    (opts.parent ?? document.body).append(this.el);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Показать карточку остановки (фото — первое из talkPhotos). */
  show(stop: StopData, o: { label?: string } = {}): void {
    if (stop !== this.stop) {
      this.stop = stop;
      const photo = stop.talkPhotos[0] ?? stop.photos[0];
      if (this.fig) releasePhotoFigure(this.fig);
      this.fig = createPhotoFigure(photo, { fit: 'cover', placeholderCaption: false });
      this.media.replaceChildren(this.fig);
      this.body.replaceChildren(
        h('p.ui-kicker', {}, o.label ?? stop.category),
        h('h2.ui-card__title', {}, stop.title),
        h('p.ui-card__line', {}, typo(stop.card)),
      );
      if (photo) this.body.append(h('p.ui-card__credit', {}, attributionText(photo)));
    }
    if (!this.opened) {
      this.opened = true;
      setShown(this.el, true);
    }
  }

  hide(): void {
    if (!this.opened) return;
    this.opened = false;
    setShown(this.el, false);
  }

  destroy(): void {
    if (this.fig) releasePhotoFigure(this.fig);
    this.el.remove();
  }
}
