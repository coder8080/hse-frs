// Место в докладе в URL (R5): #s=N&p=M. Пишем через replaceState, чтобы не засорять историю.
import { clampPosition } from './machine';
import type { StopInfo } from './types';

export interface TalkPosition {
  stopIndex: number;
  photoIndex: number;
}

/** Строго целое неотрицательное число из строки, иначе NaN. */
function toIndex(raw: string | null): number {
  return raw !== null && /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
}

/**
 * Разбор хэша. Битая/отсутствующая/вне диапазона остановка → 0/0;
 * верная остановка с битым фото → фото 0.
 */
export function parseHash(hash: string, stops: StopInfo[]): TalkPosition {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  return clampPosition(stops, toIndex(params.get('s')), toIndex(params.get('p')));
}

export function formatHash(state: TalkPosition): string {
  return `#s=${state.stopIndex}&p=${state.photoIndex}`;
}

/** Минимум от window, нужный writeHash (подменяется в тестах). */
export interface HashWindow {
  location: { pathname: string; search: string; hash: string };
  history: { replaceState(data: unknown, unused: string, url?: string | URL | null): void };
}

/** Записать позицию в URL без новой записи в истории; ничего не делает, если хэш тот же. */
export function writeHash(state: TalkPosition, win: HashWindow = window): void {
  const hash = formatHash(state);
  if (win.location.hash === hash) return;
  win.history.replaceState(null, '', win.location.pathname + win.location.search + hash);
}
