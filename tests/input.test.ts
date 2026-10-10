import { describe, expect, it } from 'vitest';
import { createDebouncer, isInteractiveTarget, keyToAction, shouldAccept, tapZone } from '../src/talk/input';

describe('keyToAction', () => {
  it.each([
    [{ key: 'ArrowRight' }, 'forward'],
    [{ key: ' ', code: 'Space' }, 'forward'],
    [{ key: 'PageDown' }, 'forward'],
    [{ key: 'Enter' }, 'forward'],
    [{ key: 'ArrowLeft' }, 'back'],
    [{ key: 'PageUp' }, 'back'],
    [{ key: 'Backspace' }, 'back'],
    [{ key: 'Home' }, 'home'],
    [{ key: 'b', code: 'KeyB' }, 'black'],
    [{ key: 'B', code: 'KeyB' }, 'black'],
    [{ key: 'и', code: 'KeyB' }, 'black'],
    [{ key: '.', code: 'Period' }, 'black'],
    [{ key: '.', code: 'Slash' }, 'black'],
    [{ key: 'ArrowUp' }, null],
    [{ key: 'a', code: 'KeyA' }, null],
    [{ key: 'Escape' }, null],
    [{ key: 'ArrowRight', ctrlKey: true }, null],
    [{ key: 'b', code: 'KeyB', metaKey: true }, null],
  ])('%j → %s', (e, action) => {
    expect(keyToAction(e)).toBe(action);
  });
});

describe('антидребезг 300 мс', () => {
  it('shouldAccept', () => {
    expect(shouldAccept(null, 0)).toBe(true);
    expect(shouldAccept(1000, 1299)).toBe(false);
    expect(shouldAccept(1000, 1300)).toBe(true);
    // часы ушли назад — не блокируем навсегда
    expect(shouldAccept(1000, 10)).toBe(true);
  });

  it('createDebouncer считает от последнего принятого нажатия', () => {
    let t = 0;
    const accept = createDebouncer(() => t);
    const at = (ms: number) => {
      t = ms;
      return accept();
    };
    expect(at(0)).toBe(true);
    expect(at(100)).toBe(false); // двойной клик
    expect(at(250)).toBe(false);
    expect(at(300)).toBe(true); // 300 от принятого в 0
    expect(at(550)).toBe(false);
    expect(at(900)).toBe(true);
  });
});

describe('tapZone', () => {
  it.each([
    [0, 1000, 'back'],
    [333, 1000, 'back'],
    [334, 1000, 'forward'],
    [999, 1000, 'forward'],
    [100, 390, 'back'],
    [200, 390, 'forward'],
    [10, 0, 'forward'],
  ])('x=%i из %i → %s', (x, w, zone) => {
    expect(tapZone(x, w)).toBe(zone);
  });
});

describe('isInteractiveTarget', () => {
  const el = (hit: boolean) => ({ closest: () => (hit ? {} : null) }) as unknown as EventTarget;
  it('кнопки и ссылки игнорируются, остальное нет', () => {
    expect(isInteractiveTarget(el(true))).toBe(true);
    expect(isInteractiveTarget(el(false))).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
    expect(isInteractiveTarget({} as EventTarget)).toBe(false);
  });
});
