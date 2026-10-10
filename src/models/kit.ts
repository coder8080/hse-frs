// Набор примитивов для миниатюр: неиндексированная геометрия, плоское затенение,
// свет (Ламберт по SUN_DIR + окружение + вертикальный градиент/AO) и падающие тени
// запекаются в цвета вершин при сборке (R15). Модель строится в модельных единицах (geo.ts).
import * as THREE from 'three';
import { PALETTE, SUN_DIR, type PaletteKey } from '../palette';

export type Col = PaletteKey | THREE.Color;
export type P2 = [number, number];
export type P3 = [number, number, number];

/** Цвет палитры (в линейном рабочем пространстве three). */
export function col(c: Col): THREE.Color {
  return typeof c === 'string' ? new THREE.Color(PALETTE[c]) : c;
}
/** Затемнить/осветлить цвет. */
export function shade(c: Col, k: number): THREE.Color {
  return col(c).clone().multiplyScalar(k);
}
/** Смешать два цвета палитры. */
export function mix(a: Col, b: Col, t: number): THREE.Color {
  return col(a).clone().lerp(col(b), t);
}

/** Направление на солнце. */
export const SUN = new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();

// Коэффициенты запекания света (линейное пространство).
const AMBIENT = 0.5;
const DIFFUSE = 0.55;
const SKY = 0.1;
const AO_MIN = 0.74; // затемнение у основания
const AO_H = 2.5; // высота, на которой AO сходит на нет
const SHADOW_EPS = 0.03; // подъём теней над плоскостью

/** Одна общая непрозрачная заливка: всё освещение уже в цветах вершин. */
export const MINIATURE_MATERIAL = new THREE.MeshBasicMaterial({ vertexColors: true });

/** Размещение примитива или группы в координатах родителя. */
export interface Place {
  at?: P3;
  rx?: number;
  ry?: number;
  rz?: number;
  s?: number | P3;
  /** false — не отбрасывает запечённую тень. */
  shadow?: boolean;
  /** Высота (мировая), от которой считается AO; false — без AO (плоская земля, вода). */
  ao?: number | false;
}

interface LTri {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  color: THREE.Color;
  /** Желаемое направление нормали в локальных координатах. */
  want: THREE.Vector3;
}

interface Frame {
  m: THREE.Matrix4;
  shadow: boolean;
  ao: number | false;
  collect: THREE.Vector3[] | null; // точки общей тени группы
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpN = new THREE.Vector3();

function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

function placeMatrix(p?: Place): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  if (!p) return m;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0, 'YXZ'));
  const s = p.s === undefined ? v(1, 1, 1) : typeof p.s === 'number' ? v(p.s, p.s, p.s) : v(...p.s);
  return m.compose(p.at ? v(...p.at) : v(0, 0, 0), q, s);
}

function signedArea(pts: P2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function triangulate(pts: P2[]): number[][] {
  return THREE.ShapeUtils.triangulateShape(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    [],
  );
}

/** Выпуклая оболочка (монотонная цепь), против часовой в (x, z). */
export function convexHull(points: P2[]): P2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 1e-9) lower.pop();
    lower.push(q);
  }
  const upper: P2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 1e-9) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Отсечение многоугольника выпуклым многоугольником (Сазерленд — Ходжмен). */
export function clipConvex(subject: P2[], clip: P2[]): P2[] {
  const sign = Math.sign(signedArea(clip)) || 1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p: P2) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

/** Правильный многоугольник в плоскости (x, z). */
export function ngon(r: number, n: number, phase = 0, cx = 0, cz = 0): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

/** Кольцо вершин в точности как у lathe (x = sin, z = cos), со сдвигом центра. */
export function ringXZ(r: number, n: number, phase = 0, cx = 0, cz = 0): P2[] {
  const pts: P2[] = [];
  for (let j = 0; j < n; j++) {
    const a = phase + (j / n) * Math.PI * 2;
    pts.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r]);
  }
  return pts;
}

export interface ShadowPlane {
  y: number;
  poly: P2[];
  color: THREE.Color;
}

/**
 * Сборщик одного меша. Примитивы сразу переводятся в мировые координаты модели,
 * освещаются и складываются в общий массив треугольников.
 */
export class Builder {
  private pos: number[] = [];
  private colr: number[] = [];
  private stack: Frame[];
  private shadowSets: THREE.Vector3[][] = [];
  shadowPlane: ShadowPlane | null = null;

  constructor(groundY = 0) {
    this.stack = [{ m: new THREE.Matrix4(), shadow: true, ao: groundY, collect: null }];
  }

  get triangles(): number {
    return this.pos.length / 9;
  }

  private get top(): Frame {
    return this.stack[this.stack.length - 1];
  }

  /** Группа с общим преобразованием; shadowGroup — одна тень-оболочка на всю группу. */
  group(p: Place, fn: () => void, opts: { shadowGroup?: boolean } = {}): void {
    const parent = this.top;
    const shadow = parent.shadow && p.shadow !== false;
    const frame: Frame = {
      m: parent.m.clone().multiply(placeMatrix(p)),
      shadow,
      ao: p.ao === undefined ? parent.ao : p.ao,
      collect: parent.collect,
    };
    const own = opts.shadowGroup && shadow && !parent.collect;
    if (own) frame.collect = [];
    this.stack.push(frame);
    fn();
    this.stack.pop();
    if (own && frame.collect!.length) this.shadowSets.push(frame.collect!);
  }

  /** Только тень: набор точек (локальных), отбрасывающий тень-оболочку без геометрии. */
  castShadow(pts: P3[], p?: Place): void {
    const fr = this.top;
    if (!fr.shadow) return;
    const m = fr.m.clone().multiply(placeMatrix(p));
    const w = pts.map((q) => v(...q).applyMatrix4(m));
    if (fr.collect) fr.collect.push(...w);
    else this.shadowSets.push(w);
  }

  /** Сырой треугольник в координатах текущей группы (нормаль по want). */
  tri(a: P3, b: P3, c: P3, color: Col, want: P3, p?: Place): void {
    this.add([{ a: v(...a), b: v(...b), c: v(...c), color: col(color), want: v(...want) }], p);
  }

  private add(tris: LTri[], p?: Place): void {
    const fr = this.top;
    const m = fr.m.clone().multiply(placeMatrix(p));
    const flip = m.determinant() < 0;
    const ao = p?.ao === undefined ? fr.ao : p.ao;
    const shadow = fr.shadow && p?.shadow !== false;
    const pts: THREE.Vector3[] = [];
    for (const t of tris) {
      let { a, b, c } = t;
      tmpA.subVectors(b, a);
      tmpB.subVectors(c, a);
      tmpN.crossVectors(tmpA, tmpB);
      if (tmpN.dot(t.want) < 0 !== flip) [b, c] = [c, b];
      const wa = a.clone().applyMatrix4(m);
      const wb = b.clone().applyMatrix4(m);
      const wc = c.clone().applyMatrix4(m);
      this.emit(wa, wb, wc, t.color, ao);
      if (shadow) pts.push(wa, wb, wc);
    }
    if (!shadow || !pts.length) return;
    if (fr.collect) fr.collect.push(...pts);
    else this.shadowSets.push(pts);
  }

  private emit(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color, ao: number | false): void {
    tmpA.subVectors(b, a);
    tmpB.subVectors(c, a);
    tmpN.crossVectors(tmpA, tmpB);
    const len = tmpN.length();
    if (len < 1e-12) return; // вырожденный
    tmpN.divideScalar(len);
    const light = AMBIENT + DIFFUSE * Math.max(0, tmpN.dot(SUN)) + SKY * (0.5 + 0.5 * tmpN.y);
    for (const p of [a, b, c]) {
      let k = light;
      if (ao !== false) {
        const h = Math.max(0, p.y - ao);
        k *= AO_MIN + (1 - AO_MIN) * Math.min(1, h / AO_H) ** 0.8;
        k *= 1 + 0.05 * Math.min(1, h / 8); // лёгкое осветление к верху
      }
      this.pos.push(p.x, p.y, p.z);
      this.colr.push(Math.min(1, color.r * k), Math.min(1, color.g * k), Math.min(1, color.b * k));
    }
  }

  // ---------- примитивы (основание в y = 0 локально) ----------

  /** Коробка w×h×d; top — свой цвет верха; bottom — рисовать дно. */
  box(w: number, h: number, d: number, color: Col, p?: Place, o: { top?: Col; bottom?: boolean } = {}): void {
    const x = w / 2;
    const z = d / 2;
    const c = col(color);
    const ct = o.top ? col(o.top) : c;
    const tris: LTri[] = [];
    const quad = (a: THREE.Vector3, b: THREE.Vector3, cc: THREE.Vector3, dd: THREE.Vector3, cl: THREE.Color, n: THREE.Vector3) => {
      tris.push({ a, b, c: cc, color: cl, want: n }, { a, b: cc, c: dd, color: cl, want: n });
    };
    quad(v(-x, 0, z), v(x, 0, z), v(x, h, z), v(-x, h, z), c, v(0, 0, 1));
    quad(v(x, 0, -z), v(-x, 0, -z), v(-x, h, -z), v(x, h, -z), c, v(0, 0, -1));
    quad(v(x, 0, z), v(x, 0, -z), v(x, h, -z), v(x, h, z), c, v(1, 0, 0));
    quad(v(-x, 0, -z), v(-x, 0, z), v(-x, h, z), v(-x, h, -z), c, v(-1, 0, 0));
    quad(v(-x, h, z), v(x, h, z), v(x, h, -z), v(-x, h, -z), ct, v(0, 1, 0));
    if (o.bottom) quad(v(-x, 0, -z), v(x, 0, -z), v(x, 0, z), v(-x, 0, z), c, v(0, -1, 0));
    this.add(tris, p);
  }

  /**
   * Тело вращения по профилю [r, y] снизу вверх. bands — цвета поясов профиля.
   * capTop/capBottom — закрыть торцы, если радиус там не 0.
   */
  lathe(
    profile: P2[],
    seg: number,
    color: Col,
    p?: Place,
    o: { phase?: number; capTop?: boolean | Col; capBottom?: boolean; bands?: Col[] } = {},
  ): void {
    const phase = o.phase ?? 0;
    const tris: LTri[] = [];
    const ring = (r: number, y: number, j: number) => {
      const a = phase + (j / seg) * Math.PI * 2;
      return v(Math.sin(a) * r, y, Math.cos(a) * r);
    };
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, y0] = profile[i];
      const [r1, y1] = profile[i + 1];
      const cl = col(o.bands?.[i] ?? color);
      for (let j = 0; j < seg; j++) {
        const a = ring(r0, y0, j);
        const b = ring(r0, y0, j + 1);
        const c = ring(r1, y1, j + 1);
        const d = ring(r1, y1, j);
        const mid = phase + ((j + 0.5) / seg) * Math.PI * 2;
        // нормаль наружу с учётом наклона образующей
        const want = v(Math.sin(mid) * (y1 - y0), r0 - r1, Math.cos(mid) * (y1 - y0));
        if (want.lengthSq() < 1e-12) want.set(0, y1 > y0 ? 1 : -1, 0);
        if (r0 > 1e-9) tris.push({ a, b, c, color: cl, want });
        if (r1 > 1e-9) tris.push({ a: r0 > 1e-9 ? a : b, b: c, c: d, color: cl, want });
      }
    }
    const cap = (r: number, y: number, up: boolean, cl: THREE.Color) => {
      for (let j = 1; j < seg - 1; j++) {
        tris.push({ a: ring(r, y, 0), b: ring(r, y, j), c: ring(r, y, j + 1), color: cl, want: v(0, up ? 1 : -1, 0) });
      }
    };
    const [rt, yt] = profile[profile.length - 1];
    const [rb, yb] = profile[0];
    if (o.capTop !== false && rt > 1e-9) cap(rt, yt, true, col(typeof o.capTop === 'string' || o.capTop instanceof THREE.Color ? o.capTop : color));
    if (o.capBottom && rb > 1e-9) cap(rb, yb, false, col(color));
    this.add(tris, p);
  }

  /** Цилиндр/усечённый конус. */
  cyl(rb: number, rt: number, h: number, seg: number, color: Col, p?: Place, o: { phase?: number; top?: Col | boolean; bottom?: boolean } = {}): void {
    this.lathe(
      [
        [rb, 0],
        [rt, h],
      ],
      seg,
      color,
      p,
      { phase: o.phase, capTop: o.top ?? true, capBottom: o.bottom },
    );
  }

  cone(r: number, h: number, seg: number, color: Col, p?: Place, phase = 0): void {
    this.lathe(
      [
        [r, 0],
        [0, h],
      ],
      seg,
      color,
      p,
      { phase },
    );
  }

  /** Четырёхскатная пирамида над прямоугольником w×d. */
  pyramid(w: number, d: number, h: number, color: Col, p?: Place): void {
    const x = w / 2;
    const z = d / 2;
    const c = col(color);
    const apex = v(0, h, 0);
    const base = [v(-x, 0, z), v(x, 0, z), v(x, 0, -z), v(-x, 0, -z)];
    const tris: LTri[] = [];
    for (let i = 0; i < 4; i++) {
      const a = base[i];
      const b = base[(i + 1) % 4];
      const want = a.clone().add(b).multiplyScalar(0.5).setY(0).normalize().multiplyScalar(h).setY(Math.max(x, z) * 0.5);
      tris.push({ a, b, c: apex, color: c, want });
    }
    this.add(tris, p);
  }

  /** Двускатная крыша w×d высотой h, конёк вдоль X; щипцы своим цветом. */
  gable(w: number, d: number, h: number, color: Col, p?: Place, o: { ends?: Col } = {}): void {
    const x = w / 2;
    const z = d / 2;
    const c = col(color);
    const ce = o.ends ? col(o.ends) : c;
    const tris: LTri[] = [];
    const r0 = v(-x, h, 0);
    const r1 = v(x, h, 0);
    // скаты
    tris.push({ a: v(-x, 0, z), b: v(x, 0, z), c: r1, color: c, want: v(0, z, h) });
    tris.push({ a: v(-x, 0, z), b: r1, c: r0, color: c, want: v(0, z, h) });
    tris.push({ a: v(x, 0, -z), b: v(-x, 0, -z), c: r0, color: c, want: v(0, z, -h) });
    tris.push({ a: v(x, 0, -z), b: r0, c: r1, color: c, want: v(0, z, -h) });
    // щипцы
    tris.push({ a: v(x, 0, z), b: v(x, 0, -z), c: r1, color: ce, want: v(1, 0, 0) });
    tris.push({ a: v(-x, 0, -z), b: v(-x, 0, z), c: r0, color: ce, want: v(-1, 0, 0) });
    this.add(tris, p);
  }

  /** Вертикальный прямоугольник w×h, смотрит в +Z (окна, циферблаты, наличники). */
  rect(w: number, h: number, color: Col, p?: Place): void {
    const x = w / 2;
    const c = col(color);
    const n = v(0, 0, 1);
    this.add(
      [
        { a: v(-x, 0, 0), b: v(x, 0, 0), c: v(x, h, 0), color: c, want: n },
        { a: v(-x, 0, 0), b: v(x, h, 0), c: v(-x, h, 0), color: c, want: n },
      ],
      { shadow: false, ...p },
    );
  }

  /** Вертикальный правильный многоугольник (циферблат), смотрит в +Z, центр в начале. */
  disc(r: number, seg: number, color: Col, p?: Place): void {
    const c = col(color);
    const tris: LTri[] = [];
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * Math.PI * 2;
      const a1 = ((j + 1) / seg) * Math.PI * 2;
      tris.push({ a: v(0, 0, 0), b: v(Math.cos(a0) * r, Math.sin(a0) * r, 0), c: v(Math.cos(a1) * r, Math.sin(a1) * r, 0), color: c, want: v(0, 0, 1) });
    }
    this.add(tris, { shadow: false, ...p });
  }

  /** Плоский многоугольник на высоте y, смотрит вверх (земля, вода, дороги). */
  flat(pts: P2[], y: number, color: Col, p?: Place): void {
    const c = col(color);
    const tris: LTri[] = [];
    for (const [i, j, k] of triangulate(pts)) {
      tris.push({ a: v(pts[i][0], y, pts[i][1]), b: v(pts[j][0], y, pts[j][1]), c: v(pts[k][0], y, pts[k][1]), color: c, want: v(0, 1, 0) });
    }
    this.add(tris, { shadow: false, ao: false, ...p });
  }

  /** Призма из многоугольника в плоскости (x, z) высотой h. */
  extrude(pts: P2[], h: number, color: Col, p?: Place, o: { top?: Col } = {}): void {
    const c = col(color);
    const sgn = Math.sign(signedArea(pts)) || 1;
    const tris: LTri[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[(i + 1) % pts.length];
      const want = v(sgn * (z1 - z0), 0, -sgn * (x1 - x0));
      tris.push({ a: v(x0, 0, z0), b: v(x1, 0, z1), c: v(x1, h, z1), color: c, want });
      tris.push({ a: v(x0, 0, z0), b: v(x1, h, z1), c: v(x0, h, z0), color: c, want });
    }
    const ct = o.top ? col(o.top) : c;
    for (const [i, j, k] of triangulate(pts)) {
      tris.push({ a: v(pts[i][0], h, pts[i][1]), b: v(pts[j][0], h, pts[j][1]), c: v(pts[k][0], h, pts[k][1]), color: ct, want: v(0, 1, 0) });
    }
    this.add(tris, p);
  }

  /** Призма из профиля в плоскости (x, y), вытянутая по Z на depth (кабина, корпус). */
  profile(pts: P2[], depth: number, color: Col, p?: Place, o: { caps?: Col; faces?: (Col | undefined)[] } = {}): void {
    const c = col(color);
    const cc = o.caps ? col(o.caps) : c;
    const z = depth / 2;
    const sgn = Math.sign(signedArea(pts)) || 1;
    const tris: LTri[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      const want = v(sgn * (y1 - y0), -sgn * (x1 - x0), 0);
      const fc = o.faces?.[i] ? col(o.faces[i]!) : c;
      tris.push({ a: v(x0, y0, -z), b: v(x1, y1, -z), c: v(x1, y1, z), color: fc, want });
      tris.push({ a: v(x0, y0, -z), b: v(x1, y1, z), c: v(x0, y0, z), color: fc, want });
    }
    for (const [i, j, k] of triangulate(pts)) {
      for (const s of [1, -1]) {
        tris.push({ a: v(pts[i][0], pts[i][1], s * z), b: v(pts[j][0], pts[j][1], s * z), c: v(pts[k][0], pts[k][1], s * z), color: cc, want: v(0, 0, s) });
      }
    }
    this.add(tris, p);
  }

  /** Дуговой слой: кольцевой сектор rIn..rOut, углы a0..a1 (от +X к −Z), высота h. */
  arc(rIn: number, rOut: number, a0: number, a1: number, h: number, seg: number, color: Col, p?: Place, o: { top?: Col; outer?: Col } = {}): void {
    const c = col(color);
    const ct = o.top ? col(o.top) : c;
    const co = o.outer ? col(o.outer) : c;
    const pt = (r: number, a: number, y: number) => v(Math.cos(a) * r, y, -Math.sin(a) * r);
    const tris: LTri[] = [];
    for (let j = 0; j < seg; j++) {
      const s0 = a0 + ((a1 - a0) * j) / seg;
      const s1 = a0 + ((a1 - a0) * (j + 1)) / seg;
      const sm = (s0 + s1) / 2;
      const out = v(Math.cos(sm), 0, -Math.sin(sm));
      const inn = out.clone().negate();
      tris.push({ a: pt(rOut, s0, 0), b: pt(rOut, s1, 0), c: pt(rOut, s1, h), color: co, want: out });
      tris.push({ a: pt(rOut, s0, 0), b: pt(rOut, s1, h), c: pt(rOut, s0, h), color: co, want: out });
      tris.push({ a: pt(rIn, s0, 0), b: pt(rIn, s1, 0), c: pt(rIn, s1, h), color: c, want: inn });
      tris.push({ a: pt(rIn, s0, 0), b: pt(rIn, s1, h), c: pt(rIn, s0, h), color: c, want: inn });
      tris.push({ a: pt(rIn, s0, h), b: pt(rOut, s0, h), c: pt(rOut, s1, h), color: ct, want: v(0, 1, 0) });
      tris.push({ a: pt(rIn, s0, h), b: pt(rOut, s1, h), c: pt(rIn, s1, h), color: ct, want: v(0, 1, 0) });
    }
    for (const [a, sgn] of [
      [a0, -1],
      [a1, 1],
    ] as const) {
      const want = v(-Math.sin(a) * sgn, 0, -Math.cos(a) * sgn);
      tris.push({ a: pt(rIn, a, 0), b: pt(rOut, a, 0), c: pt(rOut, a, h), color: co, want });
      tris.push({ a: pt(rIn, a, 0), b: pt(rOut, a, h), c: pt(rIn, a, h), color: co, want });
    }
    this.add(tris, p);
  }

  /** Стена-коробка между двумя точками (x, z). */
  wall(from: P2, to: P2, thick: number, h: number, color: Col, p?: Place, o: { top?: Col } = {}): void {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const len = Math.hypot(dx, dz);
    const base = p?.at?.[1] ?? 0;
    this.box(len, h, thick, color, { ...p, at: [(from[0] + to[0]) / 2, base, (from[1] + to[1]) / 2], ry: Math.atan2(-dz, dx) }, o);
  }

  // ---------- сборка ----------

  /** Запечённые тени: проекция вдоль солнца на плоскость, оболочки отсечены её контуром. */
  private bakeShadows(): void {
    const sp = this.shadowPlane;
    if (!sp) return;
    const y = sp.y + SHADOW_EPS;
    const k = 1 / SUN.y;
    for (const set of this.shadowSets) {
      const flat: P2[] = [];
      let tall = false;
      for (const q of set) {
        const h = q.y - sp.y;
        if (h < -0.05) continue;
        if (h > 0.05) tall = true;
        const hh = Math.max(0, h);
        flat.push([q.x - SUN.x * hh * k, q.z - SUN.z * hh * k]);
      }
      if (!tall || flat.length < 3) continue;
      const poly = clipConvex(convexHull(flat), sp.poly);
      if (poly.length < 3 || Math.abs(signedArea(poly)) < 1e-4) continue;
      for (let i = 1; i < poly.length - 1; i++) {
        const a = v(poly[0][0], y, poly[0][1]);
        let b = v(poly[i][0], y, poly[i][1]);
        let c = v(poly[i + 1][0], y, poly[i + 1][1]);
        tmpN.crossVectors(tmpA.subVectors(b, a), tmpB.subVectors(c, a));
        if (tmpN.y < 0) [b, c] = [c, b];
        for (const q of [a, b, c]) {
          this.pos.push(q.x, q.y, q.z);
          this.colr.push(sp.color.r, sp.color.g, sp.color.b);
        }
      }
    }
    this.shadowSets = [];
  }

  /** Готовая неиндексированная геометрия с цветами вершин. */
  finish(): THREE.BufferGeometry {
    this.bakeShadows();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colr, 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Подставка-фишка: низкий усечённый конус с цветной «землёй» сверху.
 * Настраивает плоскость теней. Возвращает высоту верха (уровень земли модели).
 */
export function plinth(b: Builder, top: Col, o: { r?: number; h?: number; side?: Col; seg?: number } = {}): number {
  const r = o.r ?? 4.7;
  const h = o.h ?? 0.35;
  const seg = o.seg ?? 14;
  const side = o.side ?? shade('ridge', 0.9);
  b.lathe(
    [
      [r + 0.15, 0],
      [r, h],
    ],
    seg,
    side,
    { shadow: false, ao: false },
    { capTop: false },
  );
  b.flat(ringXZ(r, seg), h, top);
  b.shadowPlane = { y: h, poly: ringXZ(r - 0.02, seg), color: groundShadow(top) };
  return h;
}

/** Цвет запечённой тени на земле данного цвета. */
export function groundShadow(top: Col): THREE.Color {
  return shade(top, (AMBIENT + DIFFUSE * SUN.y + SKY) * 0.6);
}

/** Конверт миниатюры. */
export interface Miniature {
  group: THREE.Group;
  update?(t: number): void;
  triangles: number;
}

/** Меш с общим материалом. */
export function toMesh(g: THREE.BufferGeometry, name: string): THREE.Mesh {
  const m = new THREE.Mesh(g, MINIATURE_MATERIAL);
  m.name = name;
  return m;
}

/** Собрать миниатюру из готовых сборщиков (каждый — отдельный меш). */
export function assemble(name: string, builders: Builder[], update?: (t: number) => void): Miniature {
  const group = new THREE.Group();
  group.name = name;
  let triangles = 0;
  builders.forEach((b, i) => {
    const g = b.finish();
    triangles += g.getAttribute('position').count / 3;
    group.add(toMesh(g, `${name}-${i}`));
  });
  return update ? { group, triangles, update } : { group, triangles };
}
