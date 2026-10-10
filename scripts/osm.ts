// Граница, водохранилища и реки из OpenStreetMap через Overpass API.
//
//   npm run data:osm
//
// Сырые ответы кэшируются в .cache/osm/ (повторный запуск работает без сети).
// Результат: data/border.json, data/water.json, data/rivers.json — упрощённые линии в lat/lon.
// Бюджет: вода + граница + реки ≤ 10 тыс. треугольников, поэтому допуски упрощения подобраны грубо.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import simplify from 'simplify-js';
import { BBOX, project, unproject } from '../src/geo.ts';
import { clipRingToRect, distToSegment, pointInRing, ringArea, type P2 } from '../src/scene/polygon.ts';
import { writeAttribution } from './lib/attribution.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'osm');
const DATA = join(ROOT, 'data');
const UA = 'po-techeniyu-vekov/0.1 (HSE student project; https://github.com/coder8080/hse-frs)';
// основной сервер и зеркала (при перегрузке пробуем следующее)
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/** BBOX с полем, чтобы линии не обрывались ровно по краю карты. */
const PAD = 0.1;
const QBOX = `${BBOX.south - PAD},${BBOX.west - PAD},${BBOX.north + PAD},${BBOX.east + PAD}`;

// ---------- Overpass ----------

interface LatLon {
  lat: number;
  lon: number;
}
interface OsmMember {
  type: string;
  ref: number;
  role: string;
  geometry?: (LatLon | null)[];
}
interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  geometry?: (LatLon | null)[];
  members?: OsmMember[];
}

let lastCall = 0;

async function overpass(key: string, query: string): Promise<OsmElement[]> {
  const file = join(CACHE, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, 'utf8')).elements;
  } catch {
    // нет в кэше
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    // вежливость: не чаще раза в 3 секунды
    const wait = lastCall + 3000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    console.log(`  overpass: ${key}${attempt ? ` (попытка ${attempt + 1})` : ''}`);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
      });
    } catch (e) {
      console.warn(`    ${endpoint}: ${(e as Error).message}`);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      console.warn(`    ${endpoint}: HTTP ${res.status}`);
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`overpass ${key}: HTTP ${res.status}\n${await res.text()}`);
    const text = await res.text();
    const json = JSON.parse(text);
    if (json.remark && !json.elements?.length) throw new Error(`overpass ${key}: ${json.remark}`);
    await writeFile(file, text);
    return json.elements;
  }
  throw new Error(`overpass ${key}: сервер перегружен`);
}

// ---------- сборка линий ----------

type Line = LatLon[];

const keyOf = (p: LatLon) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;

/** Разбивает геометрию с null (точки вне out geom(bbox)) на непрерывные куски. */
function splitNulls(g: (LatLon | null)[] | undefined): Line[] {
  const out: Line[] = [];
  let cur: Line = [];
  for (const p of g ?? []) {
    if (p) cur.push(p);
    else {
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Склеивает куски в замкнутые кольца по совпадающим концам. */
function assembleRings(lines: Line[]): Line[] {
  const pool = lines.map((l) => l.slice());
  const rings: Line[] = [];
  while (pool.length) {
    let ring = pool.pop()!;
    let grown = true;
    while (keyOf(ring[0]) !== keyOf(ring[ring.length - 1]) && grown) {
      grown = false;
      const end = keyOf(ring[ring.length - 1]);
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i];
        if (keyOf(l[0]) === end) ring = ring.concat(l.slice(1));
        else if (keyOf(l[l.length - 1]) === end) ring = ring.concat(l.slice().reverse().slice(1));
        else continue;
        pool.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (keyOf(ring[0]) === keyOf(ring[ring.length - 1]) && ring.length >= 4) rings.push(ring.slice(0, -1));
  }
  return rings;
}

const toKm = (l: Line): P2[] => l.map((p) => {
  const q = project(p.lat, p.lon);
  return [q.x, q.z];
});
const toLatLon = (r: P2[]): [number, number][] =>
  r.map(([x, z]) => {
    const g = unproject(x, z);
    return [+g.lat.toFixed(5), +g.lon.toFixed(5)];
  });

function simplifyKm(r: P2[], tol: number): P2[] {
  return simplify(
    r.map(([x, y]) => ({ x, y })),
    tol,
    true,
  ).map((p) => [p.x, p.y] as P2);
}

const BB_KM = (() => {
  const sw = project(BBOX.south, BBOX.west);
  const ne = project(BBOX.north, BBOX.east);
  return { minX: sw.x, maxX: ne.x, minY: ne.z, maxY: sw.z };
})();

const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------- граница ----------

async function border(): Promise<[number, number][][]> {
  const els = await overpass(
    'border',
    `[out:json][timeout:180];rel["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"="RU-TA"];out geom;`,
  );
  const rel = els.find((e) => e.type === 'relation');
  if (!rel?.members) throw new Error('граница Татарстана не найдена');
  const outer = rel.members.filter((m) => m.type === 'way' && m.role !== 'inner').flatMap((m) => splitNulls(m.geometry));
  const rings = assembleRings(outer)
    .map(toKm)
    .map((r) => simplifyKm(r, 0.8))
    .filter((r) => Math.abs(ringArea(r)) > 50)
    .map((r) => (ringArea(r) < 0 ? r.reverse() : r));
  rings.sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)));
  console.log(`  граница: ${rings.length} колец, ${rings.map((r) => r.length).join('+')} точек`);
  return rings.map(toLatLon);
}

// ---------- водохранилища ----------

interface WaterBody {
  id: string;
  name: string;
  /** Полигоны: [внешнее кольцо, ...дыры], каждое кольцо — [[lat, lon], ...]. */
  polygons: [number, number][][][];
}

const RESERVOIRS = [
  { id: 'kuibyshev', name: 'Куйбышевское водохранилище' },
  { id: 'nizhnekamsk', name: 'Нижнекамское водохранилище' },
  { id: 'cheboksary', name: 'Чебоксарское водохранилище' },
];

/**
 * Плотины ГЭС делят безымянные русловые полигоны Волги и Камы между водохранилищами:
 * участок выше плотины — верхнее водохранилище, ниже — нижнее (у них разные уровни).
 */
const DAMS = [
  { river: 'volga', lat: 56.135, lon: 47.48, upstream: 'cheboksary', downstream: 'kuibyshev' },
  { river: 'kama', lat: 55.705, lon: 52.305, upstream: 'nizhnekamsk', downstream: 'kuibyshev' },
];
/** Русловые полигоны этих рек относятся к водохранилищу целиком (подпор). */
const BACKWATER: Record<string, string> = { belaya: 'nizhnekamsk' };

/** Кольца элемента OSM (way или multipolygon) → полигоны в км: отсечение, упрощение, отбор по площади. */
function elementPolygons(els: OsmElement[], tol: number, minOuter: number, minHole: number): P2[][][] {
  const outerLines: Line[] = [];
  const innerLines: Line[] = [];
  for (const e of els) {
    if (e.type === 'way') outerLines.push(...splitNulls(e.geometry));
    for (const m of e.members ?? []) {
      if (m.type !== 'way') continue;
      (m.role === 'inner' ? innerLines : outerLines).push(...splitNulls(m.geometry));
    }
  }
  const clip = (r: P2[]) => clipRingToRect(r, BB_KM.minX, BB_KM.minY, BB_KM.maxX, BB_KM.maxY);
  const outers = assembleRings(outerLines)
    .map(toKm)
    .map(clip)
    .filter((r) => r.length >= 3 && Math.abs(ringArea(r)) > minOuter)
    .map((r) => simplifyKm(r, tol))
    .filter((r) => r.length >= 3 && Math.abs(ringArea(r)) > minOuter)
    .map((r) => (ringArea(r) < 0 ? r.reverse() : r));
  // дыры (острова): только крупные
  const inners = assembleRings(innerLines)
    .map(toKm)
    .map(clip)
    .filter((r) => r.length >= 3 && Math.abs(ringArea(r)) > minHole)
    .map((r) => simplifyKm(r, tol))
    .filter((r) => r.length >= 3 && Math.abs(ringArea(r)) > minHole)
    .map((r) => (ringArea(r) > 0 ? r.reverse() : r));
  const polys: P2[][][] = outers.map((o) => [o]);
  for (const h of inners) {
    const owner = polys.find((p) => pointInRing(h[0][0], h[0][1], p[0]));
    if (owner) owner.push(h);
  }
  return polys;
}

/** Ближайшая точка полилинии: расстояние и длина дуги от начала. */
function nearestOnLine(p: P2, line: P2[]): { d: number; s: number } {
  let best = { d: Infinity, s: 0 };
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const seg = dist(a, b);
    const d = distToSegment(p[0], p[1], a[0], a[1], b[0], b[1]);
    if (d < best.d) {
      const t = seg > 0 ? ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (seg * seg) : 0;
      best = { d, s: acc + Math.max(0, Math.min(1, t)) * seg };
    }
    acc += seg;
  }
  return best;
}

function centroid(r: P2[]): P2 {
  let x = 0;
  let y = 0;
  for (const p of r) {
    x += p[0];
    y += p[1];
  }
  return [x / r.length, y / r.length];
}

async function water(rivers: River[]): Promise<WaterBody[]> {
  const names = RESERVOIRS.map((r) => r.name).join('|');
  const els = await overpass(
    'water',
    `[out:json][timeout:300];(rel["natural"="water"]["name"~"^(${names})$"](${QBOX});way["natural"="water"]["name"~"^(${names})$"](${QBOX}););out geom;`,
  );
  const bodies = new Map<string, P2[][][]>();
  for (const res of RESERVOIRS) {
    bodies.set(res.id, elementPolygons(els.filter((e) => e.tags?.name === res.name), 0.35, 3, 6));
  }

  // безымянные русловые полигоны (участки рек без имени водохранилища); к Волге, Каме и Белой
  // относим только те, что лежат на их осевых линиях
  const stems = ['volga', 'kama', 'belaya'];
  const extra = await overpass(
    'water-riverbank',
    `[out:json][timeout:300];(rel["natural"="water"]["water"~"^(river|reservoir)$"]["name"!~"^(${names})$"](${QBOX});` +
      `rel["natural"="water"][!"water"][!"name"](${QBOX});way["natural"="water"]["water"="river"](${QBOX}););out geom;`,
  );
  const lines = new Map(rivers.filter((r) => stems.includes(r.id)).map((r) => [r.id, r.points.map(([la, lo]) => {
    const q = project(la, lo);
    return [q.x, q.z] as P2;
  })]));
  let added = 0;
  for (const e of extra) {
    const w = e.tags?.water;
    if (w && !['river', 'reservoir', 'canal', 'stream'].includes(w)) continue;
    for (const poly of elementPolygons([e], 0.2, 0.3, 2)) {
      const c = centroid(poly[0]);
      let best: { id: string; d: number; s: number } | null = null;
      for (const [id, line] of lines) {
        // медианное расстояние вершин кольца до осевой: кусок должен лежать на русле
        const ds = poly[0].map((p) => nearestOnLine(p, line).d).sort((x, y) => x - y);
        const d = ds[ds.length >> 1];
        if (!best || d < best.d) best = { id, d, s: nearestOnLine(c, line).s };
      }
      if (!best || best.d > 1.5) continue;
      let body = BACKWATER[best.id];
      const dam = DAMS.find((d) => d.river === best.id);
      if (dam) {
        const q = project(dam.lat, dam.lon);
        const sd = nearestOnLine([q.x, q.z], lines.get(best.id)!).s;
        body = best.s < sd ? dam.upstream : dam.downstream;
      }
      if (!body) continue;
      bodies.get(body)!.push(poly);
      added++;
    }
  }
  console.log(`  русловых полигонов добавлено: ${added}`);

  const result: WaterBody[] = [];
  for (const res of RESERVOIRS) {
    const polys = bodies.get(res.id)!;
    if (!polys.length) continue;
    const pts = polys.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0);
    console.log(`  ${res.name}: ${polys.length} полигонов, ${pts} точек`);
    result.push({ id: res.id, name: res.name, polygons: polys.map((p) => p.map(toLatLon)) });
  }
  return result;
}

// ---------- реки ----------

interface RiverSpec {
  id: string;
  name: string;
  /** Wikidata реки: по нему ищем relation type=waterway. */
  wikidata?: string;
  /** Ширина ленты в км (стилизованная, крупнее реальной). */
  width_km: number;
}

const RIVERS: RiverSpec[] = [
  { id: 'volga', name: 'Волга', wikidata: 'Q626', width_km: 1.2 },
  { id: 'kama', name: 'Кама', wikidata: 'Q79082', width_km: 1.0 },
  { id: 'vyatka', name: 'Вятка', wikidata: 'Q192495', width_km: 0.7 },
  { id: 'belaya', name: 'Белая', wikidata: 'Q192157', width_km: 0.7 },
  { id: 'sviyaga', name: 'Свияга', wikidata: 'Q1132165', width_km: 0.5 },
  { id: 'ik', name: 'Ик', wikidata: 'Q1143089', width_km: 0.5 },
  { id: 'zay', name: 'Зай', wikidata: 'Q2603479', width_km: 0.45 },
  { id: 'sheshma', name: 'Шешма', width_km: 0.45 },
  { id: 'myosha', name: 'Мёша', width_km: 0.4 },
  { id: 'kazanka', name: 'Казанка', wikidata: 'Q376708', width_km: 0.4 },
  { id: 'cheremshan', name: 'Большой Черемшан', wikidata: 'Q224686', width_km: 0.45 },
  { id: 'ilet', name: 'Илеть', wikidata: 'Q1364331', width_km: 0.4 },
];

interface River {
  id: string;
  name: string;
  width_km: number;
  points: [number, number][];
}

/** Ребро графа русла: кусок пути OSM в направлении течения. */
interface Edge {
  a: string;
  b: string;
  pts: P2[];
  len: number;
  /** Искусственная сшивка разрыва. */
  gap?: boolean;
}

function polyLen(p: P2[]): number {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]);
  return s;
}

/**
 * Главное русло: самый длинный путь в графе кусков (два прохода Дейкстры — «диаметр»).
 * Разрывы до maxGap км между концами кусков сшиваются.
 */
function mainStem(lines: Line[], maxGap: number): P2[] {
  const edges: Edge[] = [];
  const nodes = new Map<string, P2>();
  for (const l of lines) {
    const pts = toKm(l);
    const a = keyOf(l[0]);
    const b = keyOf(l[l.length - 1]);
    if (a === b) continue;
    nodes.set(a, pts[0]);
    nodes.set(b, pts[pts.length - 1]);
    edges.push({ a, b, pts, len: polyLen(pts) });
  }
  // сшивка разрывов: концы разных компонент ближе maxGap
  const adj = new Map<string, { to: string; e: Edge; fwd: boolean }[]>();
  const link = (e: Edge) => {
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ to: e.b, e, fwd: true });
    adj.get(e.b)!.push({ to: e.a, e, fwd: false });
  };
  edges.forEach(link);
  const ends = [...adj.keys()].filter((k) => adj.get(k)!.length === 1);
  const comp = components(adj);
  for (let i = 0; i < ends.length; i++) {
    let best: string | null = null;
    let bestD = maxGap;
    for (let j = 0; j < ends.length; j++) {
      if (comp.get(ends[i]) === comp.get(ends[j])) continue;
      const d = dist(nodes.get(ends[i])!, nodes.get(ends[j])!);
      if (d < bestD) {
        bestD = d;
        best = ends[j];
      }
    }
    if (best) {
      const e: Edge = { a: ends[i], b: best, pts: [nodes.get(ends[i])!, nodes.get(best)!], len: bestD * 3, gap: true };
      link(e);
      const ca = comp.get(ends[i])!;
      const cb = comp.get(best)!;
      for (const [k, v] of comp) if (v === cb) comp.set(k, ca);
    }
  }
  const dijkstra = (src: string) => {
    const d = new Map<string, number>([[src, 0]]);
    const prev = new Map<string, { from: string; e: Edge; fwd: boolean }>();
    const done = new Set<string>();
    const queue: [number, string][] = [[0, src]];
    while (queue.length) {
      queue.sort((x, y) => y[0] - x[0]);
      const [du, u] = queue.pop()!;
      if (done.has(u)) continue;
      done.add(u);
      for (const nb of adj.get(u) ?? []) {
        const nd = du + nb.e.len;
        if (nd < (d.get(nb.to) ?? Infinity)) {
          d.set(nb.to, nd);
          prev.set(nb.to, { from: u, e: nb.e, fwd: nb.fwd });
          queue.push([nd, nb.to]);
        }
      }
    }
    let far = src;
    for (const [k, v] of d) if (v > d.get(far)!) far = k;
    return { far, prev };
  };
  // старт с самой длинной компоненты
  const byComp = new Map<number, number>();
  for (const e of edges) byComp.set(comp.get(e.a)!, (byComp.get(comp.get(e.a)!) ?? 0) + e.len);
  const bigComp = [...byComp.entries()].sort((x, y) => y[1] - x[1])[0][0];
  const start = [...adj.keys()].find((k) => comp.get(k) === bigComp)!;
  const A = dijkstra(start).far;
  const { far: B, prev } = dijkstra(A);
  // восстановление пути B → A и голосование за направление течения
  const path: P2[] = [];
  let vote = 0;
  let cur = B;
  const segs: P2[][] = [];
  while (cur !== A) {
    const p = prev.get(cur)!;
    // идём от A к cur: ребро пройдено fwd, если p.from === e.a
    const pts = p.fwd ? p.e.pts : p.e.pts.slice().reverse();
    if (!p.e.gap) vote += p.fwd ? p.e.len : -p.e.len;
    segs.push(pts);
    cur = p.from;
  }
  segs.reverse();
  for (const s of segs) {
    if (path.length) path.push(...s.slice(1));
    else path.push(...s);
  }
  // vote > 0: путь A→B совпадает с направлением путей OSM (= течению)
  return vote >= 0 ? path : path.reverse();
}

function components(adj: Map<string, { to: string }[]>): Map<string, number> {
  const comp = new Map<string, number>();
  let n = 0;
  for (const k of adj.keys()) {
    if (comp.has(k)) continue;
    const stack = [k];
    comp.set(k, n);
    while (stack.length) {
      const u = stack.pop()!;
      for (const nb of adj.get(u) ?? []) {
        if (!comp.has(nb.to)) {
          comp.set(nb.to, n);
          stack.push(nb.to);
        }
      }
    }
    n++;
  }
  return comp;
}

/** Добавляет промежуточные точки, чтобы шаг был ≤ step км (пути полёта по реке). */
function densify(p: P2[], step: number): P2[] {
  const out: P2[] = [p[0]];
  for (let i = 1; i < p.length; i++) {
    const n = Math.ceil(dist(p[i - 1], p[i]) / step);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push([p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t]);
    }
  }
  return out;
}

/** Самый длинный непрерывный участок внутри карты. */
function clipLine(p: P2[]): P2[] {
  const inside = (q: P2) => q[0] >= BB_KM.minX && q[0] <= BB_KM.maxX && q[1] >= BB_KM.minY && q[1] <= BB_KM.maxY;
  let best: P2[] = [];
  let cur: P2[] = [];
  for (const q of p) {
    if (inside(q)) cur.push(q);
    else {
      if (polyLen(cur) > polyLen(best)) best = cur;
      cur = [];
    }
  }
  if (polyLen(cur) > polyLen(best)) best = cur;
  return best;
}

async function rivers(): Promise<River[]> {
  const out: River[] = [];
  for (const spec of RIVERS) {
    const q = spec.wikidata
      ? `[out:json][timeout:180];rel["type"="waterway"]["wikidata"="${spec.wikidata}"];out geom(${QBOX});`
      : `[out:json][timeout:180];way["waterway"="river"]["name"="${spec.name}"](${QBOX});out geom;`;
    const els = await overpass(`river-${spec.id}`, q);
    const lines: Line[] = [];
    for (const e of els) {
      if (e.type === 'way') lines.push(...splitNulls(e.geometry));
      for (const m of e.members ?? []) {
        if (m.type !== 'way') continue;
        // боковые протоки и притоки — мимо
        if (m.role && m.role !== 'main_stream') continue;
        lines.push(...splitNulls(m.geometry));
      }
    }
    if (!lines.length) {
      console.warn(`  ${spec.name}: нет данных`);
      continue;
    }
    const stem = clipLine(mainStem(lines, 6));
    const simp = densify(simplifyKm(stem, spec.id === 'volga' || spec.id === 'kama' ? 0.4 : 0.3), 5);
    let maxGap = 0;
    for (let i = 1; i < simp.length; i++) maxGap = Math.max(maxGap, dist(simp[i - 1], simp[i]));
    console.log(
      `  ${spec.name}: ${lines.length} кусков → ${polyLen(stem).toFixed(0)} км, ${simp.length} точек, макс. шаг ${maxGap.toFixed(1)} км`,
    );
    out.push({ id: spec.id, name: spec.name, width_km: spec.width_km, points: toLatLon(simp) });
  }
  return out;
}

// ---------- main ----------

async function main(): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  await mkdir(DATA, { recursive: true });
  console.log('Граница');
  const b = await border();
  await writeFile(join(DATA, 'border.json'), JSON.stringify({ rings: b }) + '\n');
  console.log('Реки');
  const r = await rivers();
  const byId: Record<string, River> = {};
  for (const x of r) byId[x.id] = x;
  await writeFile(join(DATA, 'rivers.json'), JSON.stringify(byId) + '\n');
  console.log('Водохранилища');
  const w = await water(r);
  await writeFile(join(DATA, 'water.json'), JSON.stringify({ reservoirs: w }) + '\n');
  await writeAttribution('osm', {
    source: 'OpenStreetMap (Overpass API): граница Татарстана, водохранилища, осевые линии рек',
    license: 'Open Database License (ODbL) 1.0',
    notice: '© OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/copyright',
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
