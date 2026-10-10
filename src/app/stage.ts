// Что режимам нужно от 3D-сцены. Реализация — src/app/app.ts.
import type { StopData } from '../content-types';

export interface Stage {
  readonly canvas: HTMLCanvasElement;
  /** Полёт к остановке; from — где камера сейчас. fast — быстрый перелёт 0,5 с. */
  flyTo(from: number, to: number, opts: { fast?: boolean; onDone: () => void }): void;
  /** Довести текущий полёт до конца (onDone вызывается сразу). */
  finishFlight(): void;
  /** Поставить камеру у остановки без полёта. */
  jumpTo(index: number): void;
  readonly flying: boolean;
  /** Пауза рендера, пока слайдшоу закрывает карту. */
  setPaused(paused: boolean): void;
  /** Свободная навигация мышью/пальцами («Путешествие»). */
  setFreeCamera(enabled: boolean): void;
  /** Клик по миниатюре на карте. */
  onPick(cb: (index: number) => void): void;
  /** Подписи остановок на карте. */
  setLabels(visible: boolean, active?: number): void;
  readonly stops: StopData[];
}
