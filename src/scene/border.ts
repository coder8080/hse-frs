// Граница Татарстана: тонкая лента чуть выше поверхности (рельефа или воды).
import * as THREE from 'three';
import { PALETTE } from '../palette';
import type { P2 } from './polygon';
import { appendRibbon } from './water';

export function buildBorder(rings: readonly P2[][], surface: (x: number, z: number) => number): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) appendRibbon(r, surface, { width: 0.75, lift: 0.07, closed: true, step: 2.5 }, pos, idx);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const m = new THREE.MeshBasicMaterial({ color: PALETTE.border, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'border';
  return mesh;
}
