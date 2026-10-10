// Деревья по растительному покрову: леса густо, луга и окраины полей — редкими деревьями.
// Карта разбита на квадраты; деревья квадрата — пара InstancedMesh (хвойные и лиственные),
// строятся при первом приближении камеры. Дальние квадраты скрыты, а у края радиуса деревья
// плавно «врастают» в землю (масштаб в вершинном шейдере), так что подгрузка не бросается в глаза.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { KM_PER_DEG_LAT, ORIGIN, WORLD } from '../geo';
import { PALETTE, SUN_DIR } from '../palette';
import { GF, hash2, type Ground } from './ground';
import { LC } from './types';

export interface Clearing {
  x: number;
  z: number;
  /** Радиус, км: здесь деревьев нет (подставки миниатюр). */
  r: number;
}

export interface ForestOptions {
  ground: Ground;
  /** Высота рельефа (ед. мира). */
  heightAt(x: number, z: number): number;
  clearings?: readonly Clearing[];
  /** Дальность видимости деревьев, км. */
  radius?: number;
}

export interface Forest {
  group: THREE.Group;
  /** Подгрузить ближние квадраты, скрыть дальние. Дёшево: вызывать каждый кадр. */
  update(camera: THREE.Camera): void;
  /** Деревья в видимых квадратах (для отладки и тестов). */
  readonly visibleTrees: number;
  /** Построить квадраты вокруг точки сразу (тесты, предзагрузка). */
  generateAround(x: number, z: number, radius: number): void;
  /** Все деревья построенных квадратов: [x, z, вид (0 хвойное, 1 лиственное)]. */
  trees(): [number, number, number][];
}

/** Сторона квадрата, км. */
const CHUNK = 24;
/** Квадратов строим за кадр — без рывков при быстром полёте. */
const BUILD_PER_FRAME = 3;

/** Вероятность дерева в пикселе покрова (~0,05 км²). */
const DENSITY: Partial<Record<number, number>> = {
  [LC.tree]: 0.55,
  [LC.shrub]: 0.12,
  [LC.wetland]: 0.08,
  [LC.grass]: 0.035,
  [LC.built]: 0.025,
  [LC.crop]: 0.004,
};

// ---------- геометрия: одно дерево высотой ~1 с запечённым светом ----------

function shadeFaces(g: THREE.BufferGeometry, color: (y: number) => THREE.Color): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute('normal');
  ng.deleteAttribute('uv');
  const pos = ng.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const sun = new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    // генераторы three.js дают грани против часовой стрелки снаружи: нормаль (b − a) × (c − a)
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    const shade = 0.55 + 0.6 * Math.max(0, n.dot(sun));
    const base = color((a.y + b.y + c.y) / 3).multiplyScalar(shade);
    for (let v = 0; v < 3; v++) col.set([base.r, base.g, base.b], (i + v) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return ng;
}

function conifer(): THREE.BufferGeometry {
  const pine = new THREE.Color(PALETTE.pine);
  const tip = pine.clone().lerp(new THREE.Color(PALETTE.leaf), 0.35);
  const trunk = new THREE.CylinderGeometry(0.035, 0.045, 0.18, 4, 1, true).translate(0, 0.09, 0);
  const low = new THREE.ConeGeometry(0.27, 0.62, 7, 1, true).translate(0, 0.14 + 0.31, 0);
  const high = new THREE.ConeGeometry(0.19, 0.5, 7, 1, true).translate(0, 0.5 + 0.25, 0);
  return mergeGeometries([
    shadeFaces(trunk, () => new THREE.Color(PALETTE.trunk)),
    shadeFaces(low, () => pine.clone()),
    shadeFaces(high, (y) => pine.clone().lerp(tip, Math.min(1, (y - 0.5) / 0.5))),
  ])!;
}

function broadleaf(): THREE.BufferGeometry {
  const leaf = new THREE.Color(PALETTE.leaf);
  const trunk = new THREE.CylinderGeometry(0.04, 0.055, 0.34, 4, 1, true).translate(0, 0.17, 0);
  const crown = new THREE.IcosahedronGeometry(0.3, 0).scale(1, 0.92, 1).translate(0, 0.62, 0);
  return mergeGeometries([
    shadeFaces(trunk, () => new THREE.Color(PALETTE.trunk)),
    shadeFaces(crown, (y) => leaf.clone().multiplyScalar(0.92 + 0.25 * Math.min(1, Math.max(0, (y - 0.4) / 0.5)))),
  ])!;
}

// ---------- материал: плавное «врастание» у края дальности ----------

function forestMaterial(fade: { value: THREE.Vector2 }): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTreeFade = fade;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uTreeFade;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 treeAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          transformed *= 1.0 - smoothstep(uTreeFade.x, uTreeFade.y, distance(treeAt, cameraPosition));
        #endif`,
      );
  };
  m.customProgramCacheKey = () => 'forest-fade';
  return m;
}

// ---------- лес ----------

interface Chunk {
  meshes: THREE.InstancedMesh[];
  count: number;
  trees: [number, number, number][];
}

export function buildForest(opts: ForestOptions): Forest {
  const { ground } = opts;
  const radius = opts.radius ?? 36;
  const clearings = opts.clearings ?? [];
  const fade = { value: new THREE.Vector2(radius * 0.6, radius) };
  const geos = [conifer(), broadleaf()];
  const material = forestMaterial(fade);
  const group = new THREE.Group();
  group.name = 'forest';

  const NCX = Math.ceil(WORLD.width / CHUNK);
  const NCZ = Math.ceil(WORLD.depth / CHUNK);
  const chunks = new Map<number, Chunk>();
  const W = ground.width;
  const muted = new THREE.Color(PALETTE.outside);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();

  function build(ci: number, cj: number): Chunk {
    const x0 = WORLD.minX + ci * CHUNK;
    const z0 = WORLD.minZ + cj * CHUNK;
    const c0 = Math.max(0, Math.floor((x0 - WORLD.minX) / ground.px));
    const c1 = Math.min(W - 1, Math.floor((x0 + CHUNK - WORLD.minX) / ground.px) - 1);
    const r0 = Math.max(0, Math.floor((z0 - WORLD.minZ) / ground.pz));
    const r1 = Math.min(ground.height - 1, Math.floor((z0 + CHUNK - WORLD.minZ) / ground.pz) - 1);
    const items: [number, number, number, number, number, number][] = []; // x, z, вид, высота, поворот, флаги
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const k = r * W + c;
        const f = ground.flags[k];
        if (f & (GF.wet | GF.shore)) continue;
        const d = DENSITY[ground.classes[k]] ?? 0;
        if (!d || hash2(c, r) >= d) continue;
        const x = WORLD.minX + (c + 0.15 + 0.7 * hash2(c + 911, r)) * ground.px;
        const z = WORLD.minZ + (r + 0.15 + 0.7 * hash2(c, r + 577)) * ground.pz;
        if (clearings.some((cl) => (x - cl.x) ** 2 + (z - cl.z) ** 2 < cl.r * cl.r)) continue;
        // к северу (Заказанье, Предволжье) больше хвойных, в Закамье — широколиственные
        const lat = ORIGIN.lat - z / KM_PER_DEG_LAT;
        const pine = Math.min(0.7, Math.max(0.15, 0.2 + (lat - 54.8) * 0.35));
        const kind = hash2(c + 31, r + 71) < pine ? 0 : 1;
        const lone = ground.classes[k] !== LC.tree;
        const h = (kind === 0 ? 0.44 : 0.38) * (0.8 + 0.45 * hash2(c + 5, r + 13)) * (lone ? 1.15 : 1);
        items.push([x, z, kind, h, hash2(c + 3, r + 3) * Math.PI * 2, f]);
      }
    }
    const meshes: THREE.InstancedMesh[] = [];
    for (let kind = 0; kind < 2; kind++) {
      const list = items.filter((it) => it[2] === kind);
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(geos[kind], material, list.length);
      list.forEach(([x, z, , h, rot, f], i) => {
        p.set(x, opts.heightAt(x, z) - 0.02, z);
        q.setFromAxisAngle(up, rot);
        s.set(h * (0.9 + 0.2 * hash2(i, kind)), h, h * (0.9 + 0.2 * hash2(kind, i)));
        mesh.setMatrixAt(i, m4.compose(p, q, s));
        // разброс оттенка; за границей Татарстана — приглушённые, как и земля
        const v = 0.86 + 0.24 * hash2(i * 7 + kind, 3);
        col.setRGB(v, v * (0.97 + 0.06 * hash2(i, 11)), v * 0.95);
        if (!(f & GF.inside)) col.lerp(muted, 0.5).multiplyScalar(1.45);
        mesh.setColorAt(i, col);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.matrixAutoUpdate = false;
      mesh.name = `forest-${kind ? 'leaf' : 'pine'}`;
      meshes.push(mesh);
    }
    return { meshes, count: items.length, trees: items.map(([x, z, kind]) => [x, z, kind]) };
  }

  const key = (ci: number, cj: number) => cj * NCX + ci;
  let visibleTrees = 0;

  function ensure(ci: number, cj: number): Chunk {
    let ch = chunks.get(key(ci, cj));
    if (!ch) {
      ch = build(ci, cj);
      chunks.set(key(ci, cj), ch);
      for (const m of ch.meshes) group.add(m);
    }
    return ch;
  }

  /** Расстояние от точки до квадрата (по горизонтали, с учётом высоты камеры). */
  const distTo = (ci: number, cj: number, x: number, y: number, z: number) => {
    const x0 = WORLD.minX + ci * CHUNK;
    const z0 = WORLD.minZ + cj * CHUNK;
    const dx = Math.max(x0 - x, 0, x - (x0 + CHUNK));
    const dz = Math.max(z0 - z, 0, z - (z0 + CHUNK));
    return Math.hypot(dx, dz, y);
  };

  return {
    group,
    get visibleTrees() {
      return visibleTrees;
    },
    update(camera: THREE.Camera) {
      const { x, y, z } = camera.position;
      // нужные квадраты, ближние первыми
      const want: [number, number, number][] = [];
      const ci0 = Math.max(0, Math.floor((x - radius - WORLD.minX) / CHUNK));
      const ci1 = Math.min(NCX - 1, Math.floor((x + radius - WORLD.minX) / CHUNK));
      const cj0 = Math.max(0, Math.floor((z - radius - WORLD.minZ) / CHUNK));
      const cj1 = Math.min(NCZ - 1, Math.floor((z + radius - WORLD.minZ) / CHUNK));
      const yAbove = Math.max(0, y - 2);
      for (let cj = cj0; cj <= cj1; cj++) {
        for (let ci = ci0; ci <= ci1; ci++) {
          const d = distTo(ci, cj, x, yAbove, z);
          if (d < radius) want.push([ci, cj, d]);
        }
      }
      want.sort((a, b) => a[2] - b[2]);
      let built = 0;
      const show = new Set<number>();
      for (const [ci, cj] of want) {
        if (!chunks.has(key(ci, cj))) {
          if (built >= BUILD_PER_FRAME) continue;
          built++;
        }
        ensure(ci, cj);
        show.add(key(ci, cj));
      }
      visibleTrees = 0;
      for (const [k, ch] of chunks) {
        const on = show.has(k);
        for (const m of ch.meshes) m.visible = on;
        if (on) visibleTrees += ch.count;
        // далёкие квадраты освобождаем: память не копится за долгий тур
        if (!on) {
          const ci = k % NCX;
          const cj = (k / NCX) | 0;
          if (distTo(ci, cj, x, yAbove, z) > radius * 2.5) {
            for (const m of ch.meshes) {
              group.remove(m);
              m.dispose();
            }
            chunks.delete(k);
          }
        }
      }
    },
    generateAround(x: number, z: number, r: number) {
      for (let cj = 0; cj < NCZ; cj++) {
        for (let ci = 0; ci < NCX; ci++) if (distTo(ci, cj, x, 0, z) < r) ensure(ci, cj);
      }
    },
    trees() {
      return [...chunks.values()].flatMap((c) => c.trees);
    },
  };
}
