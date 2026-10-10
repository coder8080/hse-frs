// Ввод «Доклада»: клавиатура/кликер и касания (R9) → TalkEvent.
// Чистые части (раскладка клавиш, антидребезг, зоны касания) вынесены для юнит-тестов.
import type { TalkEvent } from './types';

export type TalkAction = 'forward' | 'back' | 'home' | 'black';

export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const FORWARD_KEYS = new Set(['ArrowRight', ' ', 'Spacebar', 'PageDown', 'Enter']);
const BACK_KEYS = new Set(['ArrowLeft', 'PageUp', 'Backspace']);

/** Клавиша → действие. B и «.» работают и в русской раскладке (по code). */
export function keyToAction(e: KeyLike): TalkAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (FORWARD_KEYS.has(e.key) || e.code === 'Space') return 'forward';
  if (BACK_KEYS.has(e.key)) return 'back';
  if (e.key === 'Home') return 'home';
  if (e.key === 'b' || e.key === 'B' || e.key === '.' || e.code === 'KeyB' || e.code === 'Period') return 'black';
  return null;
}

export const DEBOUNCE_MS = 300;

/** Антидребезг: принимаем шаг, если с прошлого принятого прошло ≥ intervalMs. */
export function shouldAccept(lastAccepted: number | null, now: number, intervalMs = DEBOUNCE_MS): boolean {
  return lastAccepted === null || now - lastAccepted >= intervalMs || now < lastAccepted;
}

/** Состояние антидребезга с внедряемыми часами. */
export function createDebouncer(now: () => number, intervalMs = DEBOUNCE_MS): () => boolean {
  let last: number | null = null;
  return () => {
    const t = now();
    if (!shouldAccept(last, t, intervalMs)) return false;
    last = t;
    return true;
  };
}

/** Зона касания: левая треть — назад, правые 2/3 — вперёд. */
export function tapZone(x: number, width: number): 'forward' | 'back' {
  return width > 0 && x < width / 3 ? 'back' : 'forward';
}

/** Порог смещения пальца, после которого это свайп/скролл, а не тап. */
export const TAP_SLOP_PX = 24;

const INTERACTIVE = 'button, a, input, select, textarea, label, summary, [role="button"], [contenteditable], [data-no-tap]';

/** Тап/клавиша пришли с интерактивного элемента — не трогаем. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as { closest?: (sel: string) => unknown } | null;
  return !!el && typeof el.closest === 'function' && !!el.closest(INTERACTIVE);
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as { closest?: (sel: string) => unknown } | null;
  return !!el && typeof el.closest === 'function' && !!el.closest('input, textarea, select, [contenteditable]');
}

export interface TalkInputOptions {
  /** B / «.» — переключить чёрный экран */
  onBlack?: () => void;
  /** Часы для антидребезга (по умолчанию performance.now) */
  now?: () => number;
  /** Касания: по умолчанию включены для pointerType touch/pen и при pointer: coarse */
  touch?: boolean;
}

/** Подключает клавиши и касания к dispatch. Возвращает функцию отключения. */
export function attachTalkInput(
  target: HTMLElement | Window,
  dispatch: (e: TalkEvent) => void,
  opts: TalkInputOptions = {},
): () => void {
  const now = opts.now ?? (() => performance.now());
  const accept = createDebouncer(now);

  const step = (action: 'forward' | 'back') => {
    if (accept()) dispatch({ type: action });
  };

  const onKey = (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (isEditable(e.target)) return;
    const action = keyToAction(e);
    if (!action) return;
    // Space/Backspace/PageDown не должны скроллить страницу или уходить назад по истории
    e.preventDefault();
    if (e.repeat) return;
    if (action === 'home') dispatch({ type: 'home' });
    else if (action === 'black') opts.onBlack?.();
    else step(action);
  };

  const coarseMq = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;
  const downs = new Map<number, { x: number; y: number }>();

  const onDown = (ev: Event) => {
    const e = ev as PointerEvent;
    downs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onUp = (ev: Event) => {
    const e = ev as PointerEvent;
    const down = downs.get(e.pointerId);
    downs.delete(e.pointerId);
    if (opts.touch === false) return;
    const touchLike = e.pointerType === 'touch' || e.pointerType === 'pen' || !!coarseMq?.matches;
    if (!touchLike || e.button > 0) return;
    if (isInteractiveTarget(e.target)) return;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP_PX) return;
    step(tapZone(e.clientX, window.innerWidth));
  };

  const onCancel = (ev: Event) => downs.delete((ev as PointerEvent).pointerId);

  target.addEventListener('keydown', onKey);
  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onCancel);
  return () => {
    target.removeEventListener('keydown', onKey);
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onCancel);
  };
}
