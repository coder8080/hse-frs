// Машина состояний «Доклада» (R2, R3). Чистые функции: никаких DOM и таймеров.
// Сцена и оверлеи только исполняют эффекты из Transition.effects.
//
// Интеграция: state = initialState(stops); затем reduce(state, {type:'restore', ...parseHash(...)})
// и исполнить эффекты. Сцена после flyTo/finishAnimation шлёт animationDone.
import type { StopData } from '../content-types';
import type { Effect, StopInfo, TalkEvent, TalkState, Transition } from './types';

/** StopData → то, что нужно машине. */
export function toStopInfos(stops: Pick<StopData, 'kind' | 'talkPhotos'>[]): StopInfo[] {
  return stops.map((s) => ({ kind: s.kind, talkPhotoCount: s.talkPhotos.length }));
}

/** Сколько позиций (фото) у остановки в «Докладе»: у пролётной одна карточка, у прочих ≥ 1 фото. */
export function photoCount(stop: StopInfo | undefined): number {
  if (!stop || stop.kind === 'flythrough') return 1;
  const n = Math.floor(stop.talkPhotoCount);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function isIndex(v: unknown, length: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < length;
}

/**
 * Приводит позицию к допустимой: битая остановка → 0/0, битое фото при верной остановке → фото 0.
 */
export function clampPosition(
  stops: StopInfo[],
  stopIndex: unknown,
  photoIndex: unknown,
): { stopIndex: number; photoIndex: number } {
  if (!isIndex(stopIndex, stops.length)) return { stopIndex: 0, photoIndex: 0 };
  const photo = isIndex(photoIndex, photoCount(stops[stopIndex])) ? photoIndex : 0;
  return { stopIndex, photoIndex: photo };
}

/** Фаза, в которой остановка показана после прибытия. */
function arrivedPhase(stop: StopInfo | undefined): 'slideshow' | 'card' {
  return stop?.kind === 'flythrough' ? 'card' : 'slideshow';
}

/** Эффект открытия оверлея остановки (слайдшоу или карточка). */
function openEffect(stops: StopInfo[], stopIndex: number, photoIndex: number): Effect {
  return stops[stopIndex]?.kind === 'flythrough'
    ? { type: 'showCard', stopIndex }
    : { type: 'openSlideshow', stopIndex, photoIndex };
}

function settled(stops: StopInfo[], stopIndex: number, photoIndex: number): TalkState {
  return { stopIndex, photoIndex, phase: arrivedPhase(stops[stopIndex]) };
}

/** Начальное состояние: остановка 0, первое фото. Эффекты открытия даёт restore/home. */
export function initialState(stops: StopInfo[]): TalkState {
  return settled(stops, 0, 0);
}

/** Чинит пришедшее состояние, чтобы reduce никогда не работал с битыми индексами. */
function normalize(state: TalkState | undefined, stops: StopInfo[]): TalkState {
  const pos = clampPosition(stops, state?.stopIndex, state?.photoIndex);
  const phase = state?.phase;
  if (phase === 'flying' || phase === 'arrived') return { ...pos, phase };
  return settled(stops, pos.stopIndex, pos.photoIndex);
}

function stay(state: TalkState): Transition {
  return { state, effects: [] };
}

/** Перелёт вперёд на следующую остановку (или ничего в конце маршрута). */
function flyNext(state: TalkState, stops: StopInfo[]): Transition {
  const next = state.stopIndex + 1;
  if (next >= stops.length) return stay(state);
  return {
    state: { stopIndex: next, photoIndex: 0, phase: 'flying' },
    effects: [{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: next }],
  };
}

/** Быстрый перелёт назад: ключевая открывается на последнем фото (R3), пролётная — карточкой (R3-12). */
function flyPrev(state: TalkState, stops: StopInfo[]): Transition {
  const prev = state.stopIndex - 1;
  if (prev < 0) return stay(state);
  return {
    state: { stopIndex: prev, photoIndex: photoCount(stops[prev]) - 1, phase: 'flying' },
    effects: [{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: prev, fast: true }],
  };
}

/** Открыть оверлей текущей позиции (после полёта или из «arrived»). */
function arrive(state: TalkState, stops: StopInfo[]): Transition {
  return {
    state: settled(stops, state.stopIndex, state.photoIndex),
    effects: [openEffect(stops, state.stopIndex, state.photoIndex)],
  };
}

/**
 * Один шаг машины. Не бросает исключений; индексы в результате всегда допустимы.
 * Нажатия во время полёта только доводят анимацию (finishAnimation), шаги не копятся.
 */
export function reduce(state: TalkState, event: TalkEvent, stops: StopInfo[]): Transition {
  if (!Array.isArray(stops) || stops.length === 0) {
    return { state: { stopIndex: 0, photoIndex: 0, phase: 'slideshow' }, effects: [] };
  }
  const s = normalize(state, stops);
  const type = (event as { type?: unknown } | undefined)?.type;

  switch (type) {
    case 'forward': {
      if (s.phase === 'flying') return { state: s, effects: [{ type: 'finishAnimation' }] };
      if (s.phase === 'arrived') return arrive(s, stops);
      if (s.phase === 'slideshow' && s.photoIndex < photoCount(stops[s.stopIndex]) - 1) {
        const photoIndex = s.photoIndex + 1;
        return {
          state: { ...s, photoIndex },
          effects: [{ type: 'showPhoto', stopIndex: s.stopIndex, photoIndex }],
        };
      }
      return flyNext(s, stops);
    }

    case 'back': {
      // Решение: «назад» в полёте только доводит анимацию, без разворота.
      if (s.phase === 'flying') return { state: s, effects: [{ type: 'finishAnimation' }] };
      if (s.phase === 'arrived') return arrive(s, stops);
      if (s.phase === 'slideshow' && s.photoIndex > 0) {
        const photoIndex = s.photoIndex - 1;
        return {
          state: { ...s, photoIndex },
          effects: [{ type: 'showPhoto', stopIndex: s.stopIndex, photoIndex }],
        };
      }
      return flyPrev(s, stops);
    }

    case 'animationDone':
      return s.phase === 'flying' || s.phase === 'arrived' ? arrive(s, stops) : stay(s);

    case 'home':
      return {
        state: settled(stops, 0, 0),
        effects: [{ type: 'closeOverlay' }, { type: 'jumpTo', stopIndex: 0 }, openEffect(stops, 0, 0)],
      };

    case 'restore': {
      const e = event as { stopIndex?: unknown; photoIndex?: unknown };
      const pos = clampPosition(stops, e.stopIndex, e.photoIndex);
      return {
        state: settled(stops, pos.stopIndex, pos.photoIndex),
        effects: [
          { type: 'jumpTo', stopIndex: pos.stopIndex },
          openEffect(stops, pos.stopIndex, pos.photoIndex),
        ],
      };
    }

    default:
      return stay(s);
  }
}
