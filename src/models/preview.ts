// Превью миниатюр (models-preview.html): сетка всех моделей или одна (?only=slug).
// ?far=1 — модель в масштабе сцены (MINIATURE_SCALE) с дистанции ~20 км; ?az, ?el, ?dist — ракурс.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PALETTE } from '../palette';
import { MINIATURE_SCALE } from '../geo';
import { MINIATURE_SLUGS, buildMiniature, type Miniature } from './index';

const q = new URLSearchParams(location.search);
const only = q.get('only');
const far = q.has('far');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
const camera = new THREE.PerspectiveCamera(far ? 40 : 35, innerWidth / innerHeight, 0.1, 2000);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.lowland).multiplyScalar(0.92) }),
);
ground.position.y = -0.01;
scene.add(ground);

const slugs = only ? [only] : MINIATURE_SLUGS;
const cols = Math.min(4, slugs.length);
const step = 12;
const items: { slug: string; m: Miniature; pos: THREE.Vector3; label: HTMLDivElement }[] = [];
let tris = 0;
slugs.forEach((slug, i) => {
  const m = buildMiniature(slug);
  const cx = (i % cols) - (cols - 1) / 2;
  const cz = Math.floor(i / cols) - (Math.ceil(slugs.length / cols) - 1) / 2;
  const pos = new THREE.Vector3(cx * step, 0, cz * step);
  m.group.position.copy(pos);
  if (far) m.group.scale.setScalar(MINIATURE_SCALE);
  scene.add(m.group);
  tris += m.triangles;
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `${slug} · ${m.triangles}`;
  if (!only) document.body.appendChild(label);
  items.push({ slug, m, pos, label });
});
document.querySelector('#info')!.textContent = `${slugs.length} моделей, ${tris} треугольников`;

const rows = Math.ceil(slugs.length / cols);
const az = THREE.MathUtils.degToRad(Number(q.get('az') ?? (only ? 20 : 0)));
const el = THREE.MathUtils.degToRad(Number(q.get('el') ?? (only ? 40 : 50)));
const dist = Number(q.get('dist') ?? (far ? 20 : only ? 17 : Math.max(cols, rows * 1.4) * step * 1.25));
const target = new THREE.Vector3(0, only ? (far ? 1 : 2.5) : 0, only ? 0 : 1.5);
camera.position.set(
  target.x + Math.sin(az) * Math.cos(el) * dist,
  target.y + Math.sin(el) * dist,
  target.z + Math.cos(az) * Math.cos(el) * dist,
);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.update();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const tmp = new THREE.Vector3();
const t0 = performance.now();
let frames = 0;
renderer.setAnimationLoop(() => {
  const t = q.has('t') ? Number(q.get('t')) : (performance.now() - t0) / 1000;
  for (const it of items) {
    it.m.update?.(t);
    if (!only) {
      tmp.copy(it.pos).setZ(it.pos.z + 5.6).project(camera);
      it.label.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth}px`;
      it.label.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight}px`;
    }
  }
  controls.update();
  renderer.render(scene, camera);
  if (++frames === 3) (window as unknown as { __ready: boolean }).__ready = true;
});
