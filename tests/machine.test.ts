import { describe, expect, it } from 'vitest';
import { clampPosition, initialState, photoCount, reduce, toStopInfos } from '../src/talk/machine';
import type { Effect, StopInfo, TalkEvent, TalkState } from '../src/talk/types';

// Маршрут: 0 intro (3 фото), 1 key (2), 2 flythrough, 3 key (1), 4 flythrough (последняя)
const STOPS: StopInfo[] = [
  { kind: 'intro', talkPhotoCount: 3 },
  { kind: 'key', talkPhotoCount: 2 },
  { kind: 'flythrough', talkPhotoCount: 1 },
  { kind: 'key', talkPhotoCount: 1 },
  { kind: 'flythrough', talkPhotoCount: 1 },
];

const st = (stopIndex: number, photoIndex: number, phase: TalkState['phase']): TalkState => ({
  stopIndex,
  photoIndex,
  phase,
});
const F: TalkEvent = { type: 'forward' };
const B: TalkEvent = { type: 'back' };
const DONE: TalkEvent = { type: 'animationDone' };
const HOME: TalkEvent = { type: 'home' };

interface Row {
  name: string;
  from: TalkState;
  event: TalkEvent;
  to: TalkState;
  effects: Effect[];
}

const table: Row[] = [
  // forward
  { name: 'forward листает фото', from: st(0, 0, 'slideshow'), event: F, to: st(0, 1, 'slideshow'), effects: [{ type: 'showPhoto', stopIndex: 0, photoIndex: 1 }] },
  { name: 'forward на последнем фото улетает дальше', from: st(0, 2, 'slideshow'), event: F, to: st(1, 0, 'flying'), effects: [{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: 1 }] },
  { name: 'forward с ключевой к пролётной', from: st(1, 1, 'slideshow'), event: F, to: st(2, 0, 'flying'), effects: [{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: 2 }] },
  { name: 'forward в карточке улетает дальше', from: st(2, 0, 'card'), event: F, to: st(3, 0, 'flying'), effects: [{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: 3 }] },
  { name: 'forward в полёте доводит анимацию', from: st(1, 0, 'flying'), event: F, to: st(1, 0, 'flying'), effects: [{ type: 'finishAnimation' }] },
  { name: 'forward в конце маршрута — ничего', from: st(4, 0, 'card'), event: F, to: st(4, 0, 'card'), effects: [] },
  { name: 'forward на единственном фото ключевой улетает', from: st(3, 0, 'slideshow'), event: F, to: st(4, 0, 'flying'), effects: [{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: 4 }] },
  // animationDone
  { name: 'прибытие на ключевую открывает слайдшоу', from: st(1, 0, 'flying'), event: DONE, to: st(1, 0, 'slideshow'), effects: [{ type: 'openSlideshow', stopIndex: 1, photoIndex: 0 }] },
  { name: 'прибытие на пролётную открывает карточку', from: st(2, 0, 'flying'), event: DONE, to: st(2, 0, 'card'), effects: [{ type: 'showCard', stopIndex: 2 }] },
  { name: 'прибытие назад на ключевую — последнее фото', from: st(1, 1, 'flying'), event: DONE, to: st(1, 1, 'slideshow'), effects: [{ type: 'openSlideshow', stopIndex: 1, photoIndex: 1 }] },
  { name: 'animationDone вне полёта — ничего', from: st(1, 0, 'slideshow'), event: DONE, to: st(1, 0, 'slideshow'), effects: [] },
  // back
  { name: 'back листает фото назад', from: st(0, 2, 'slideshow'), event: B, to: st(0, 1, 'slideshow'), effects: [{ type: 'showPhoto', stopIndex: 0, photoIndex: 1 }] },
  { name: 'back с первого фото — на последнее фото предыдущей ключевой (R3)', from: st(1, 0, 'slideshow'), event: B, to: st(0, 2, 'flying'), effects: [{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: 0, fast: true }] },
  { name: 'back из карточки к ключевой', from: st(2, 0, 'card'), event: B, to: st(1, 1, 'flying'), effects: [{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: 1, fast: true }] },
  { name: 'back к пролётной — её карточка (R3-12)', from: st(3, 0, 'slideshow'), event: B, to: st(2, 0, 'flying'), effects: [{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: 2, fast: true }] },
  { name: 'back в полёте только доводит анимацию', from: st(2, 0, 'flying'), event: B, to: st(2, 0, 'flying'), effects: [{ type: 'finishAnimation' }] },
  { name: 'back на первом фото остановки 0 — ничего', from: st(0, 0, 'slideshow'), event: B, to: st(0, 0, 'slideshow'), effects: [] },
  // home
  { name: 'home из середины', from: st(3, 0, 'slideshow'), event: HOME, to: st(0, 0, 'slideshow'), effects: [{ type: 'closeOverlay' }, { type: 'jumpTo', stopIndex: 0 }, { type: 'openSlideshow', stopIndex: 0, photoIndex: 0 }] },
  { name: 'home в полёте', from: st(2, 0, 'flying'), event: HOME, to: st(0, 0, 'slideshow'), effects: [{ type: 'closeOverlay' }, { type: 'jumpTo', stopIndex: 0 }, { type: 'openSlideshow', stopIndex: 0, photoIndex: 0 }] },
  // restore
  { name: 'restore на фото ключевой', from: initialState(STOPS), event: { type: 'restore', stopIndex: 1, photoIndex: 1 }, to: st(1, 1, 'slideshow'), effects: [{ type: 'jumpTo', stopIndex: 1 }, { type: 'openSlideshow', stopIndex: 1, photoIndex: 1 }] },
  { name: 'restore на пролётную', from: initialState(STOPS), event: { type: 'restore', stopIndex: 2, photoIndex: 0 }, to: st(2, 0, 'card'), effects: [{ type: 'jumpTo', stopIndex: 2 }, { type: 'showCard', stopIndex: 2 }] },
  { name: 'restore: остановка вне диапазона → 0/0', from: initialState(STOPS), event: { type: 'restore', stopIndex: 99, photoIndex: 1 }, to: st(0, 0, 'slideshow'), effects: [{ type: 'jumpTo', stopIndex: 0 }, { type: 'openSlideshow', stopIndex: 0, photoIndex: 0 }] },
  { name: 'restore: отрицательная остановка → 0/0', from: initialState(STOPS), event: { type: 'restore', stopIndex: -1, photoIndex: 0 }, to: st(0, 0, 'slideshow'), effects: [{ type: 'jumpTo', stopIndex: 0 }, { type: 'openSlideshow', stopIndex: 0, photoIndex: 0 }] },
  { name: 'restore: дробная остановка → 0/0', from: initialState(STOPS), event: { type: 'restore', stopIndex: 1.5, photoIndex: 0 }, to: st(0, 0, 'slideshow'), effects: [{ type: 'jumpTo', stopIndex: 0 }, { type: 'openSlideshow', stopIndex: 0, photoIndex: 0 }] },
  { name: 'restore: NaN → 0/0', from: initialState(STOPS), event: { type: 'restore', stopIndex: NaN, photoIndex: NaN }, to: st(0, 0, 'slideshow'), effects: [{ type: 'jumpTo', stopIndex: 0 }, { type: 'openSlideshow', stopIndex: 0, photoIndex: 0 }] },
  { name: 'restore: фото вне диапазона → фото 0 той же остановки', from: initialState(STOPS), event: { type: 'restore', stopIndex: 1, photoIndex: 7 }, to: st(1, 0, 'slideshow'), effects: [{ type: 'jumpTo', stopIndex: 1 }, { type: 'openSlideshow', stopIndex: 1, photoIndex: 0 }] },
  { name: 'restore: фото у пролётной → 0', from: initialState(STOPS), event: { type: 'restore', stopIndex: 4, photoIndex: 1 }, to: st(4, 0, 'card'), effects: [{ type: 'jumpTo', stopIndex: 4 }, { type: 'showCard', stopIndex: 4 }] },
];

describe('reduce: таблица переходов', () => {
  it.each(table)('$name', ({ from, event, to, effects }) => {
    const r = reduce(from, event, STOPS);
    expect(r.state).toEqual(to);
    expect(r.effects).toEqual(effects);
  });
});

/** Прогон событий; полёты сразу завершаются animationDone, как это делает сцена. */
function run(start: TalkState, events: TalkEvent[]) {
  let state = start;
  const log: Effect[][] = [];
  for (const e of events) {
    const r = reduce(state, e, STOPS);
    state = r.state;
    log.push(r.effects);
  }
  return { state, log };
}

/** Нажать и, если начался полёт, дождаться прибытия. Возвращает устоявшуюся позицию. */
function press(state: TalkState, e: TalkEvent): TalkState {
  let s = reduce(state, e, STOPS).state;
  if (s.phase === 'flying') s = reduce(s, DONE, STOPS).state;
  return s;
}

describe('reduce: сценарии', () => {
  it('двойной forward во время полёта не копит шаги', () => {
    const { state, log } = run(st(0, 2, 'slideshow'), [F, F, F, DONE]);
    expect(log[0]).toEqual([{ type: 'closeOverlay' }, { type: 'flyTo', stopIndex: 1 }]);
    expect(log[1]).toEqual([{ type: 'finishAnimation' }]);
    expect(log[2]).toEqual([{ type: 'finishAnimation' }]);
    expect(log[3]).toEqual([{ type: 'openSlideshow', stopIndex: 1, photoIndex: 0 }]);
    expect(state).toEqual(st(1, 0, 'slideshow'));
  });

  it('полный прогон вперёд и обратно даёт точно обратную последовательность позиций', () => {
    let s = initialState(STOPS);
    const forward: [number, number][] = [[s.stopIndex, s.photoIndex]];
    for (;;) {
      const next = press(s, F);
      if (next.stopIndex === s.stopIndex && next.photoIndex === s.photoIndex) break;
      s = next;
      forward.push([s.stopIndex, s.photoIndex]);
    }
    // 3 + 2 + 1 + 1 + 1 позиций
    expect(forward).toHaveLength(8);
    expect(forward.at(-1)).toEqual([4, 0]);

    const backward: [number, number][] = [[s.stopIndex, s.photoIndex]];
    for (;;) {
      const prev = press(s, B);
      if (prev.stopIndex === s.stopIndex && prev.photoIndex === s.photoIndex) break;
      s = prev;
      backward.push([s.stopIndex, s.photoIndex]);
    }
    expect(backward).toEqual([...forward].reverse());
    expect(s).toEqual(st(0, 0, 'slideshow'));
  });

  it('back в полёте назад: доводит, затем следующий back идёт дальше', () => {
    const { state } = run(st(2, 0, 'card'), [B, B, DONE, B, DONE]);
    // 2 → 1 (фото 1) → листаем на фото 0
    expect(state).toEqual(st(1, 0, 'slideshow'));
  });
});

describe('reduce: устойчивость', () => {
  it('неизвестные события не бросают и ничего не делают', () => {
    const s = st(1, 1, 'slideshow');
    expect(reduce(s, { type: 'nope' } as unknown as TalkEvent, STOPS)).toEqual({ state: s, effects: [] });
    expect(reduce(s, undefined as unknown as TalkEvent, STOPS)).toEqual({ state: s, effects: [] });
  });

  it('битое входное состояние приводится к допустимому', () => {
    const r = reduce(st(42, 9, 'slideshow'), F, STOPS);
    expect(r.state).toEqual(st(0, 1, 'slideshow'));
    const r2 = reduce({ stopIndex: 1, photoIndex: 5, phase: 'weird' } as unknown as TalkState, DONE, STOPS);
    expect(r2.state).toEqual(st(1, 0, 'slideshow'));
  });

  it('пустой маршрут не бросает', () => {
    expect(reduce(st(0, 0, 'slideshow'), F, []).effects).toEqual([]);
  });

  it('фаза arrived открывает оверлей', () => {
    expect(reduce(st(2, 0, 'arrived'), F, STOPS)).toEqual({ state: st(2, 0, 'card'), effects: [{ type: 'showCard', stopIndex: 2 }] });
  });

  it('индексы всегда допустимы на случайной последовательности событий', () => {
    const events: TalkEvent[] = [F, B, DONE, HOME, { type: 'restore', stopIndex: 3, photoIndex: 0 }];
    let s = initialState(STOPS);
    let seed = 7;
    for (let i = 0; i < 2000; i++) {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      s = reduce(s, events[seed % events.length], STOPS).state;
      expect(s.stopIndex).toBeGreaterThanOrEqual(0);
      expect(s.stopIndex).toBeLessThan(STOPS.length);
      expect(s.photoIndex).toBeGreaterThanOrEqual(0);
      expect(s.photoIndex).toBeLessThan(photoCount(STOPS[s.stopIndex]));
    }
  });
});

describe('вспомогательные', () => {
  it('initialState', () => {
    expect(initialState(STOPS)).toEqual(st(0, 0, 'slideshow'));
    expect(initialState([{ kind: 'flythrough', talkPhotoCount: 1 }])).toEqual(st(0, 0, 'card'));
  });

  it('photoCount: пролётная = 1, ключевая без фото = 1', () => {
    expect(photoCount({ kind: 'flythrough', talkPhotoCount: 3 })).toBe(1);
    expect(photoCount({ kind: 'key', talkPhotoCount: 0 })).toBe(1);
    expect(photoCount({ kind: 'key', talkPhotoCount: 3 })).toBe(3);
  });

  it('clampPosition', () => {
    expect(clampPosition(STOPS, 1, 1)).toEqual({ stopIndex: 1, photoIndex: 1 });
    expect(clampPosition(STOPS, 1, 2)).toEqual({ stopIndex: 1, photoIndex: 0 });
    expect(clampPosition(STOPS, 5, 0)).toEqual({ stopIndex: 0, photoIndex: 0 });
    expect(clampPosition(STOPS, '1', 0)).toEqual({ stopIndex: 0, photoIndex: 0 });
  });

  it('toStopInfos: первые 3 фото → talkPhotoCount (R13)', () => {
    const photo = { src: 'a', width: 1, height: 1, caption: '', author: '', license: '' };
    expect(toStopInfos([{ kind: 'key', talkPhotos: [photo, photo, photo] }])).toEqual([{ kind: 'key', talkPhotoCount: 3 }]);
  });
});
