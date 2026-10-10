import { describe, expect, it } from 'vitest';
import { chooseMode, modeUrl } from '../src/app/mode';

describe('chooseMode', () => {
  it('параметр в URL главнее', () => {
    expect(chooseMode('?mode=talk')).toBe('talk');
    expect(chooseMode('?mode=tour')).toBe('tour');
  });
  it('без параметра и с мусором — «Путешествие»', () => {
    expect(chooseMode('')).toBe('tour');
    expect(chooseMode('?mode=xxx')).toBe('tour');
  });
  it('modeUrl сохраняет остальные параметры и сбрасывает хэш', () => {
    expect(modeUrl('https://x.io/hse-frs/?debug#s=3&p=1', 'talk')).toBe('https://x.io/hse-frs/?debug=&mode=talk');
  });
});
