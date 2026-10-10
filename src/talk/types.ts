// Контракт машины состояний «Доклада» (R2). Реализация — src/talk/machine.ts.
// Клавиши, кликер и касания превращаются в TalkEvent; сцена и оверлеи только исполняют Effect.

export type Phase = 'flying' | 'arrived' | 'slideshow' | 'card';

export interface TalkState {
  stopIndex: number;
  /** Индекс фото в talkPhotos текущей остановки (0, если фото не показываются) */
  photoIndex: number;
  phase: Phase;
}

export type TalkEvent =
  | { type: 'forward' }
  | { type: 'back' }
  | { type: 'home' }
  | { type: 'animationDone' }
  /** Восстановление из хэша URL после F5 (R5): без полёта */
  | { type: 'restore'; stopIndex: number; photoIndex: number };

export type Effect =
  /** Полёт к остановке. fast — быстрый перелёт 0,5 с при «Назад» */
  | { type: 'flyTo'; stopIndex: number; fast?: boolean }
  /** Мгновенно довести текущую анимацию до конца (нажатие во время полёта) */
  | { type: 'finishAnimation' }
  /** Мгновенно поставить камеру над остановкой без полёта (F5, Home) */
  | { type: 'jumpTo'; stopIndex: number }
  /** Открыть слайдшоу ключевой остановки на фото photoIndex */
  | { type: 'openSlideshow'; stopIndex: number; photoIndex: number }
  /** Перелистнуть открытое слайдшоу */
  | { type: 'showPhoto'; stopIndex: number; photoIndex: number }
  /** Компактная карточка пролётной остановки */
  | { type: 'showCard'; stopIndex: number }
  /** Закрыть слайдшоу/карточку перед полётом */
  | { type: 'closeOverlay' };

/** То, что машине нужно знать об остановке. */
export interface StopInfo {
  kind: 'intro' | 'key' | 'flythrough';
  /** Сколько фото показывается в «Докладе» (1–3) */
  talkPhotoCount: number;
}

export interface Transition {
  state: TalkState;
  effects: Effect[];
}
