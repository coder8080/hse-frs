// Общая система координат сцены. Её используют скрипты данных, сцена и миниатюры.
// 1 единица мира = 1 км. Ось X на восток, ось Z на юг (как в three.js: -Z «вперёд» = север).
// Проекция равнопромежуточная вокруг центра Татарстана: на таком масштабе искажения < 1 %.

/** Охват карты (Татарстан с небольшим полем). */
export const BBOX = { south: 53.9, north: 56.75, west: 47.2, east: 54.3 } as const;

/** Центр проекции. */
export const ORIGIN = { lat: 55.3, lon: 50.75 } as const;

export const KM_PER_DEG_LAT = 111.32;
export const KM_PER_DEG_LON = KM_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);

/** Вертикальное преувеличение рельефа: Татарстан равнинный (максимум ~380 м). */
export const VERTICAL_SCALE = 15;

/** Метры высоты → единицы мира (км) с учётом преувеличения. */
export function elevToY(meters: number): number {
  return (meters / 1000) * VERTICAL_SCALE;
}

export interface XZ {
  x: number;
  z: number;
}

export function project(lat: number, lon: number): XZ {
  return {
    x: (lon - ORIGIN.lon) * KM_PER_DEG_LON,
    z: -(lat - ORIGIN.lat) * KM_PER_DEG_LAT,
  };
}

export function unproject(x: number, z: number): { lat: number; lon: number } {
  return {
    lat: ORIGIN.lat - z / KM_PER_DEG_LAT,
    lon: ORIGIN.lon + x / KM_PER_DEG_LON,
  };
}

/** Размеры охвата в км. */
export const WORLD = (() => {
  const sw = project(BBOX.south, BBOX.west);
  const ne = project(BBOX.north, BBOX.east);
  return { minX: sw.x, maxX: ne.x, minZ: ne.z, maxZ: sw.z, width: ne.x - sw.x, depth: sw.z - ne.z };
})();

/**
 * Миниатюры строятся в «модельных единицах»: основание в y = 0, центр в (0, 0),
 * габарит по X и Z ≤ 10, высота ≤ 10. Сцена умножает их на MINIATURE_SCALE,
 * то есть миниатюра занимает ~5 км: настольная диорама, а не реальный масштаб.
 */
export const MINIATURE_SCALE = 0.5;
