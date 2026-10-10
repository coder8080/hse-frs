import { describe, expect, it } from 'vitest';
import { buildFlight, easeInOut, riverSection, viewpoint, type HeightFn } from '../src/app/flight';

const flat: HeightFn = () => 1;
const hill: HeightFn = (x) => (Math.abs(x) < 20 ? 6 : 1);

describe('riverSection', () => {
  const line = Array.from({ length: 101 }, (_, i) => ({ x: i * 2, z: 0 }));

  it('берёт участок между ближайшими точками по течению', () => {
    const part = riverSection(line, { x: 10, z: 3 }, { x: 100, z: -2 });
    expect(part[0].x).toBe(10);
    expect(part[part.length - 1].x).toBe(100);
  });

  it('против течения возвращает участок в обратном порядке', () => {
    const part = riverSection(line, { x: 100, z: 0 }, { x: 10, z: 0 });
    expect(part[0].x).toBe(100);
    expect(part[part.length - 1].x).toBe(10);
  });

  it('прореживает точки', () => {
    const part = riverSection(line, { x: 0, z: 0 }, { x: 200, z: 0 });
    expect(part.length).toBeLessThan(line.length / 2);
  });
});

describe('buildFlight', () => {
  const a = viewpoint(55.0, 49.0, 'key', flat);
  const b = viewpoint(55.8, 49.1, 'key', flat);

  it('начинается и заканчивается в точках обзора остановок', () => {
    const f = buildFlight(a, b, { type: 'arc' }, flat, () => undefined);
    expect(f.position.getPoint(0).distanceTo(a.position)).toBeLessThan(1e-6);
    expect(f.position.getPoint(1).distanceTo(b.position)).toBeLessThan(1e-6);
    expect(f.target.getPoint(1).distanceTo(b.target)).toBeLessThan(1e-6);
    expect(f.duration).toBeGreaterThanOrEqual(1.5);
    expect(f.duration).toBeLessThanOrEqual(3);
  });

  it('дуга идёт выше рельефа', () => {
    const f = buildFlight(a, b, { type: 'arc' }, hill, () => undefined);
    for (let i = 0; i <= 50; i++) {
      const p = f.position.getPoint(i / 50);
      expect(p.y).toBeGreaterThan(hill(p.x, p.z));
    }
  });

  it('по реке проходит через точки осевой линии', () => {
    const river = Array.from({ length: 60 }, (_, i) => ({ x: a.target.x + i * 0.3, z: a.target.z - i * 1.5 }));
    const f = buildFlight(a, b, { type: 'river', river: 'volga' }, flat, () => river);
    const mid = f.position.getPoint(0.5);
    expect(Math.abs(mid.x - (a.target.x + 9))).toBeLessThan(10);
  });

  it('финал поднимается над картой и держит паузу', () => {
    const f = buildFlight(a, b, { type: 'final' }, flat, () => undefined);
    expect(f.hold?.seconds).toBe(1.5);
    expect(f.position.getPoint(f.hold!.at).y).toBeGreaterThan(100);
  });
});

describe('easeInOut', () => {
  it('монотонна и попадает в концы', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOut(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

