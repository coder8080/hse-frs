// Мелкие оверлеи: плашка полёта, полоска предзагрузки, чёрный экран, атрибуция карты.
import { h, setShown } from './dom';

interface ParentOption {
  parent?: HTMLElement;
}

/** Плашка внизу во время полёта: «Следующая остановка» + название. */
export class FlightLabel {
  readonly el: HTMLElement;
  private readonly kicker: HTMLElement;
  private readonly title: HTMLElement;

  constructor(opts: ParentOption = {}) {
    this.kicker = h('span.ui-flight__kicker');
    this.title = h('span.ui-flight__title');
    this.el = h('div.ui-flight.ui-layer', { hidden: true, 'data-state': 'closed', 'aria-live': 'polite' }, this.kicker, this.title);
    (opts.parent ?? document.body).append(this.el);
  }

  /** kicker по умолчанию «Следующая остановка»; при «Назад» можно передать «Возвращаемся». */
  show(title: string, kicker = 'Следующая остановка'): void {
    this.kicker.textContent = kicker;
    this.title.textContent = title;
    setShown(this.el, true);
  }

  hide(): void {
    setShown(this.el, false);
  }

  destroy(): void {
    this.el.remove();
  }
}

/** «Загрузка фото N/M» с полоской прогресса (R17). */
export class PreloadBar {
  readonly el: HTMLElement;
  private readonly label: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly track: HTMLElement;

  constructor(opts: ParentOption = {}) {
    this.label = h('span.ui-preload__label');
    this.fill = h('span.ui-preload__fill');
    this.track = h('span.ui-preload__track', { role: 'progressbar', 'aria-valuemin': '0' }, this.fill);
    this.el = h('div.ui-preload.ui-layer', { hidden: true, 'data-state': 'closed' }, this.label, this.track);
    (opts.parent ?? document.body).append(this.el);
    this.update(0, 0);
  }

  show(): void {
    setShown(this.el, true);
  }

  update(done: number, total: number): void {
    const ratio = total > 0 ? Math.min(1, done / total) : 0;
    this.label.textContent = total > 0 && done >= total ? 'Фото загружены' : `Загрузка фото ${done}/${total}`;
    this.fill.style.transform = `scaleX(${ratio})`;
    this.track.setAttribute('aria-valuemax', String(total));
    this.track.setAttribute('aria-valuenow', String(done));
    this.el.classList.toggle('is-done', total > 0 && done >= total);
  }

  hide(): void {
    setShown(this.el, false);
  }

  destroy(): void {
    this.el.remove();
  }
}

/** Чёрный экран (B / «.»), поверх всего. */
export class BlackScreen {
  readonly el: HTMLElement;
  private on = false;

  constructor(opts: ParentOption = {}) {
    this.el = h('div.ui-black.ui-layer', { hidden: true, 'data-state': 'closed', 'aria-hidden': 'true' });
    (opts.parent ?? document.body).append(this.el);
  }

  get isOn(): boolean {
    return this.on;
  }

  show(): void {
    this.on = true;
    setShown(this.el, true);
  }

  hide(): void {
    this.on = false;
    setShown(this.el, false);
  }

  /** Переключить; возвращает новое состояние. */
  toggle(): boolean {
    if (this.on) this.hide();
    else this.show();
    return this.on;
  }

  destroy(): void {
    this.el.remove();
  }
}

/** Постоянная строка атрибуции карты в углу. */
export class MapAttribution {
  readonly el: HTMLElement;

  constructor(text: string, opts: ParentOption & { corner?: 'bottom-right' | 'bottom-left' } = {}) {
    this.el = h('p.ui-attrib', { 'data-corner': opts.corner ?? 'bottom-right' }, text);
    (opts.parent ?? document.body).append(this.el);
  }

  setText(text: string): void {
    this.el.textContent = text;
  }

  show(): void {
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  destroy(): void {
    this.el.remove();
  }
}
