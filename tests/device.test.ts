import { describe, expect, it } from 'vitest';
import { detectDevice, watchDevice, type DeviceWindow } from '../src/device';

function fakeWindow(width: number, height: number, coarse: boolean) {
  const listeners = new Map<string, Set<() => void>>();
  const win: DeviceWindow & { coarse: boolean; fire(type: string): void; count(): number } = {
    innerWidth: width,
    innerHeight: height,
    coarse,
    matchMedia(query: string) {
      return { matches: query === '(pointer: coarse)' && win.coarse };
    },
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener(type, cb) {
      listeners.get(type)?.delete(cb);
    },
    fire(type) {
      for (const cb of listeners.get(type) ?? []) cb();
    },
    count() {
      let n = 0;
      for (const s of listeners.values()) n += s.size;
      return n;
    },
  };
  return win;
}

describe('detectDevice', () => {
  it.each([
    ['телефон портрет 390×844', 390, 844, true, { phone: true, coarse: true }],
    ['телефон альбом 932×430', 932, 430, true, { phone: true, coarse: true }],
    ['граница: короткая сторона 500', 500, 900, true, { phone: true, coarse: true }],
    ['планшет 820×1180', 820, 1180, true, { phone: false, coarse: true }],
    ['сенсорный ноутбук 1366×768', 1366, 768, true, { phone: false, coarse: true }],
    ['десктоп 1920×1080', 1920, 1080, false, { phone: false, coarse: false }],
    ['узкое окно десктопа 400×800 с мышью', 400, 800, false, { phone: false, coarse: false }],
  ])('%s', (_name, w, h, coarse, expected) => {
    expect(detectDevice(fakeWindow(w, h, coarse))).toEqual(expected);
  });

  it('matchMedia бросает → не телефон', () => {
    const win = { innerWidth: 390, innerHeight: 844, matchMedia: () => { throw new Error('x'); } };
    expect(detectDevice(win)).toEqual({ phone: false, coarse: false });
  });
});

describe('watchDevice', () => {
  it('поворот телефона не меняет тип — cb не вызывается', () => {
    const win = fakeWindow(390, 844, true);
    const calls: unknown[] = [];
    watchDevice((i) => calls.push(i), win);
    win.innerWidth = 844;
    win.innerHeight = 390;
    win.fire('orientationchange');
    expect(calls).toEqual([]);
  });

  it('расширение окна сенсорного устройства → cb один раз', () => {
    const win = fakeWindow(390, 844, true);
    const calls: unknown[] = [];
    watchDevice((i) => calls.push(i), win);
    win.innerWidth = 1366;
    win.innerHeight = 768;
    win.fire('resize');
    win.fire('resize');
    expect(calls).toEqual([{ phone: false, coarse: true }]);
    win.innerWidth = 390;
    win.innerHeight = 700;
    win.fire('orientationchange');
    expect(calls).toEqual([{ phone: false, coarse: true }, { phone: true, coarse: true }]);
  });

  it('отписка снимает слушатели', () => {
    const win = fakeWindow(1920, 1080, false);
    const stop = watchDevice(() => {}, win);
    expect(win.count()).toBe(2);
    stop();
    expect(win.count()).toBe(0);
  });
});
