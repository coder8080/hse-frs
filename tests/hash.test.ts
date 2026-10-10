import { describe, expect, it } from 'vitest';
import { formatHash, parseHash, writeHash, type HashWindow } from '../src/talk/hash';
import type { StopInfo } from '../src/talk/types';

const STOPS: StopInfo[] = [
  { kind: 'intro', talkPhotoCount: 3 },
  { kind: 'key', talkPhotoCount: 2 },
  { kind: 'flythrough', talkPhotoCount: 1 },
];

describe('parseHash', () => {
  it.each([
    ['#s=1&p=1', 1, 1],
    ['#p=1&s=1', 1, 1],
    ['s=1&p=0', 1, 0],
    ['#s=2&p=0', 2, 0],
    ['#s=0&p=2', 0, 2],
    ['', 0, 0],
    ['#', 0, 0],
    ['#garbage', 0, 0],
    ['#s=99', 0, 0],
    ['#s=3&p=0', 0, 0],
    ['#s=abc', 0, 0],
    ['#s=-1&p=0', 0, 0],
    ['#s=1.5', 0, 0],
    ['#s=1e0', 0, 0],
    ['#s=%20', 0, 0],
    ['#p=-1', 0, 0],
    ['#s=1', 1, 0],
    ['#s=1&p=-1', 1, 0],
    ['#s=1&p=2', 1, 0],
    ['#s=1&p=x', 1, 0],
    ['#s=2&p=1', 2, 0],
  ])('%j → %i/%i', (hash, stopIndex, photoIndex) => {
    expect(parseHash(hash, STOPS)).toEqual({ stopIndex, photoIndex });
  });

  it('пустой маршрут не бросает', () => {
    expect(parseHash('#s=1', [])).toEqual({ stopIndex: 0, photoIndex: 0 });
  });
});

describe('formatHash / writeHash', () => {
  it('формат #s=N&p=M и обратный разбор', () => {
    expect(formatHash({ stopIndex: 1, photoIndex: 1 })).toBe('#s=1&p=1');
    expect(parseHash(formatHash({ stopIndex: 1, photoIndex: 1 }), STOPS)).toEqual({ stopIndex: 1, photoIndex: 1 });
  });

  function fakeWindow(hash = '') {
    const calls: string[] = [];
    const win: HashWindow = {
      location: { pathname: '/hse-frs/', search: '?mode=talk', hash },
      history: {
        replaceState: (_d, _u, url) => {
          calls.push(String(url));
          win.location.hash = String(url).slice(String(url).indexOf('#'));
        },
      },
    };
    return { win, calls };
  }

  it('replaceState с сохранением пути и ?mode', () => {
    const { win, calls } = fakeWindow();
    writeHash({ stopIndex: 2, photoIndex: 0 }, win);
    expect(calls).toEqual(['/hse-frs/?mode=talk#s=2&p=0']);
  });

  it('не пишет повторно тот же хэш', () => {
    const { win, calls } = fakeWindow('#s=2&p=0');
    writeHash({ stopIndex: 2, photoIndex: 0 }, win);
    expect(calls).toEqual([]);
  });
});
