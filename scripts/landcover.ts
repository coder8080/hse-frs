// Растительный покров: ESA WorldCover 10 m v200 (2021), публичный AWS-бакет без ключа → сетка классов в BBOX.
//
//   npm run data:landcover
//
// Берём обзорный уровень COG (~150 м), кэшируем его в .cache/landcover/ и выбираем преобладающий класс ячейки.
// Результат: data/landcover.png (8 бит, серый: код класса WorldCover, строки с севера на юг) + data/landcover.json.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromUrl } from 'geotiff';
import sharp from 'sharp';
import { BBOX, KM_PER_DEG_LAT, KM_PER_DEG_LON } from '../src/geo.ts';
import { writeAttribution } from './lib/attribution.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'landcover');
const DATA = join(ROOT, 'data');

/** Ширина сетки в пикселях; высота подбирается так, чтобы пиксель был квадратным в км (~0,22 км). */
const GRID_W = 2048;
/** Обзорный уровень COG: 0 — 10 м, 3 — 80 м, 4 — 160 м. */
const OVERVIEW = 4;
/** Тайлы WorldCover — 3°×3°, имя по юго-западному углу. */
const TILE_DEG = 3;

interface Tile {
  w: number;
  h: number;
  data: Uint8Array;
}

function tileName(lat: number, lon: number): string {
  const la = `${lat >= 0 ? 'N' : 'S'}${String(Math.abs(lat)).padStart(2, '0')}`;
  const lo = `${lon >= 0 ? 'E' : 'W'}${String(Math.abs(lon)).padStart(3, '0')}`;
  return `ESA_WorldCover_10m_2021_v200_${la}${lo}_Map`;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadTile(lat: number, lon: number): Promise<Tile | null> {
  const name = tileName(lat, lon);
  const cached = join(CACHE, `${name}.ov${OVERVIEW}.bin`);
  if (await exists(cached)) {
    const buf = await readFile(cached);
    const w = buf.readUInt32LE(0);
    const h = buf.readUInt32LE(4);
    return { w, h, data: new Uint8Array(buf.buffer, buf.byteOffset + 8, w * h) };
  }
  const url = `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/${name}.tif`;
  const head = await fetch(url, { method: 'HEAD' });
  if (head.status === 404 || head.status === 403) {
    console.log(`  ${name}: нет тайла (${head.status})`);
    return null;
  }
  if (!head.ok) throw new Error(`${name}: HTTP ${head.status}`);
  const tiff = await fromUrl(url);
  const img = await tiff.getImage(Math.min(OVERVIEW, (await tiff.getImageCount()) - 1));
  const w = img.getWidth();
  const h = img.getHeight();
  const rasters = await img.readRasters({ samples: [0] });
  const data = Uint8Array.from(rasters[0] as ArrayLike<number>);
  const out = Buffer.alloc(8 + w * h);
  out.writeUInt32LE(w, 0);
  out.writeUInt32LE(h, 4);
  Buffer.from(data.buffer).copy(out, 8);
  await writeFile(cached, out);
  console.log(`  ${name}: ${w}×${h}`);
  return { w, h, data };
}

async function main(): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  const snap = (v: number) => Math.floor(v / TILE_DEG) * TILE_DEG;
  const tiles = new Map<string, Tile | null>();
  for (let la = snap(BBOX.south); la <= snap(BBOX.north); la += TILE_DEG) {
    for (let lo = snap(BBOX.west); lo <= snap(BBOX.east); lo += TILE_DEG) {
      tiles.set(`${la},${lo}`, await loadTile(la, lo));
    }
  }

  const widthKm = (BBOX.east - BBOX.west) * KM_PER_DEG_LON;
  const heightKm = (BBOX.north - BBOX.south) * KM_PER_DEG_LAT;
  const W = GRID_W;
  const H = Math.round((W * heightKm) / widthKm);
  // пиксели (в отличие от узлов DEM) покрывают BBOX целиком: центр пикселя — на полшага от края
  const dLon = (BBOX.east - BBOX.west) / W;
  const dLat = (BBOX.north - BBOX.south) / H;

  const sample = (la: number, lo: number): number => {
    const t = tiles.get(`${snap(la)},${snap(lo)}`);
    if (!t) return 0;
    const x = Math.min(t.w - 1, Math.floor(((lo - snap(lo)) / TILE_DEG) * t.w));
    const y = Math.min(t.h - 1, Math.floor(((snap(la) + TILE_DEG - la) / TILE_DEG) * t.h));
    return t.data[y * t.w + x];
  };

  const grid = new Uint8Array(W * H);
  const counts = new Map<number, number>();
  const votes = new Uint16Array(256);
  const S = 4;
  for (let r = 0; r < H; r++) {
    const la0 = BBOX.north - r * dLat;
    for (let c = 0; c < W; c++) {
      const lo0 = BBOX.west + c * dLon;
      // преобладающий класс по S×S точкам внутри пикселя
      votes.fill(0);
      let best = 0;
      for (let i = 0; i < S; i++) {
        for (let j = 0; j < S; j++) {
          const v = sample(la0 - ((i + 0.5) / S) * dLat, lo0 + ((j + 0.5) / S) * dLon);
          if (++votes[v] > votes[best]) best = v;
        }
      }
      grid[r * W + c] = best;
      counts.set(best, (counts.get(best) ?? 0) + 1);
    }
  }

  await sharp(Buffer.from(grid.buffer), { raw: { width: W, height: H, channels: 1 } })
    .toColourspace('b-w')
    .png({ compressionLevel: 9, palette: false })
    .toFile(join(DATA, 'landcover.png'));
  const meta = {
    width: W,
    height: H,
    bbox: BBOX,
    format: 'PNG, 8 бит серый: код класса ESA WorldCover (10 лес, 20 кустарник, 30 луг, 40 пашня, 50 застройка, 60 голая земля, 80 вода, 90 болото); строки с севера на юг, пиксели покрывают bbox целиком',
    source: `ESA WorldCover 10 m 2021 v200, обзорный уровень ${OVERVIEW}, преобладающий класс в пикселе`,
  };
  await writeFile(join(DATA, 'landcover.json'), JSON.stringify(meta, null, 2) + '\n');
  await writeAttribution('landcover', {
    source: 'ESA WorldCover 10 m 2021 v200 (AWS Open Data, s3://esa-worldcover)',
    license: 'CC BY 4.0',
    notice: '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
    url: 'https://esa-worldcover.org/',
  });
  const share = [...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${((n / (W * H)) * 100).toFixed(1)}%`);
  console.log(`landcover: ${W}×${H}; ${share.join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
