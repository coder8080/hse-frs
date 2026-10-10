// Распознавание телефона (R8): грубый указатель И короткая сторона окна ≤ 500 CSS px.
// Ноутбук с сенсорным экраном — десктоп. Пересчёт на resize/orientationchange.

export interface DeviceInfo {
  /** Телефон: «Путешествие», сниженное качество */
  phone: boolean;
  /** Основной указатель грубый (палец): включает зоны касания в «Докладе» (R9) */
  coarse: boolean;
}

/** Минимум от window, нужный для распознавания (подменяется в тестах). */
export interface DeviceWindow {
  innerWidth: number;
  innerHeight: number;
  matchMedia(query: string): { matches: boolean };
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
}

export const PHONE_SHORT_SIDE = 500;

export function detectDevice(win: Pick<DeviceWindow, 'innerWidth' | 'innerHeight' | 'matchMedia'> = window): DeviceInfo {
  let coarse = false;
  try {
    coarse = !!win.matchMedia?.('(pointer: coarse)').matches;
  } catch {
    coarse = false;
  }
  const short = Math.min(win.innerWidth, win.innerHeight);
  return { coarse, phone: coarse && short > 0 && short <= PHONE_SHORT_SIDE };
}

/**
 * Следит за сменой типа устройства; cb вызывается только при изменении phone/coarse.
 * Возвращает функцию отписки.
 */
export function watchDevice(cb: (info: DeviceInfo) => void, win: DeviceWindow = window): () => void {
  let last = detectDevice(win);
  const check = () => {
    const now = detectDevice(win);
    if (now.phone !== last.phone || now.coarse !== last.coarse) {
      last = now;
      cb(now);
    }
  };
  const events = ['resize', 'orientationchange'];
  for (const e of events) win.addEventListener(e, check);
  return () => {
    for (const e of events) win.removeEventListener(e, check);
  };
}
