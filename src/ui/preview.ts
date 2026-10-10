// Страница для скриншотов оверлеев с фейковыми данными: /ui-preview.html?view=talk
// Виды: talk, talk-broken, tour, tour-broken, card, flight, preload, black. &shot — без меню.
import type { PhotoData, StopData } from '../content-types';
import { PALETTE } from '../palette';
import { attachTalkInput } from '../talk/input';
import { BlackScreen, Card, FlightLabel, MapAttribution, PreloadBar, Slideshow } from './index';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'talk';
const photoIndex = Number(params.get('p') ?? 0);
if (params.has('shot')) document.body.classList.add('shot');

// ——— фальшивая карта на фоне, чтобы было видно размытие ———
function drawMap(): void {
  const c = document.querySelector<HTMLCanvasElement>('#map')!;
  const w = (c.width = innerWidth);
  const h = (c.height = innerHeight);
  const g = c.getContext('2d')!;
  g.fillStyle = PALETTE.outside;
  g.fillRect(0, 0, w, h);
  const blobs: [number, number, number, string][] = [
    [0.3, 0.4, 0.42, PALETTE.plain],
    [0.65, 0.55, 0.38, PALETTE.lowland],
    [0.8, 0.25, 0.22, PALETTE.upland],
    [0.15, 0.8, 0.25, PALETTE.ridge],
    [0.5, 0.15, 0.2, PALETTE.forest],
  ];
  for (const [x, y, r, col] of blobs) {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x * w, y * h, r * w, r * h * 0.8, 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = PALETTE.river;
  g.lineWidth = Math.max(10, w * 0.012);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-20, h * 0.3);
  g.bezierCurveTo(w * 0.3, h * 0.2, w * 0.35, h * 0.7, w * 0.6, h * 0.6);
  g.bezierCurveTo(w * 0.8, h * 0.52, w * 0.9, h * 0.8, w + 20, h * 0.85);
  g.stroke();
  g.strokeStyle = PALETTE.border;
  g.lineWidth = 2;
  g.setLineDash([8, 6]);
  g.strokeRect(w * 0.08, h * 0.1, w * 0.84, h * 0.8);
  // «миниатюры»
  for (const [x, y, col] of [
    [0.42, 0.45, PALETTE.stoneWhite],
    [0.62, 0.62, PALETTE.brickRed],
    [0.75, 0.38, PALETTE.roofGreen],
  ] as const) {
    g.fillStyle = col;
    g.fillRect(x * w - 14, y * h - 14, 28, 28);
    g.fillStyle = PALETTE.gold;
    g.beginPath();
    g.arc(x * w, y * h - 22, 8, 0, Math.PI * 2);
    g.fill();
  }
}

// ——— фото-заглушки, нарисованные на canvas ———
function fakePhoto(w: number, h: number, seed: number): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const skies = [
    ['#8fb5cf', '#f0d9b5'],
    ['#5f7f9e', '#e9c9a0'],
    ['#a9c4d6', '#eef0e6'],
  ][seed % 3];
  const sky = g.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, skies[0]);
  sky.addColorStop(1, skies[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // река
  g.fillStyle = '#5b8fb0';
  g.fillRect(0, h * 0.72, w, h * 0.28);
  g.fillStyle = 'rgb(255 255 255 / 0.25)';
  for (let i = 0; i < 12; i++) g.fillRect(((i * 97 + seed * 31) % w), h * (0.76 + (i % 4) * 0.05), w * 0.08, 2);
  // берег и холм
  g.fillStyle = '#6f8f55';
  g.beginPath();
  g.moveTo(0, h * 0.74);
  g.bezierCurveTo(w * 0.2, h * 0.5, w * 0.5, h * 0.52, w * 0.75, h * 0.62);
  g.lineTo(w, h * 0.7);
  g.lineTo(w, h * 0.74);
  g.closePath();
  g.fill();
  // силуэт храма
  const cx = w * (0.35 + (seed % 3) * 0.12);
  const base = h * 0.58;
  const s = Math.min(w, h) / 6;
  g.fillStyle = '#f2efe6';
  g.fillRect(cx - s, base - s, s * 2, s);
  g.fillRect(cx - s * 0.35, base - s * 2, s * 0.7, s);
  g.fillStyle = seed % 2 ? '#3e6fa8' : '#4f8a6b';
  g.beginPath();
  g.ellipse(cx, base - s * 2, s * 0.4, s * 0.5, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#e0b44c';
  g.fillRect(cx - 2, base - s * 2.9, 4, s * 0.45);
  // зерно
  g.fillStyle = 'rgb(0 0 0 / 0.04)';
  for (let i = 0; i < 1500; i++) g.fillRect((i * 7919) % w, (i * 104729) % h, 2, 2);
  return c.toDataURL('image/jpeg', 0.85);
}

function photo(src: string, w: number, h: number, caption: string, author: string, license = 'CC BY-SA 4.0'): PhotoData {
  return { src, width: w, height: h, caption, author, license };
}

const PHOTOS: PhotoData[] = [
  photo(fakePhoto(1600, 1067, 0), 1600, 1067, 'Успенский собор Свияжска с высоты птичьего полёта', 'Иван Петров'),
  photo(fakePhoto(1067, 1600, 1), 1067, 1600, 'Фрески XVI века в Успенском соборе', 'Wikimedia Commons user Kazan2020', 'CC BY 3.0'),
  photo(fakePhoto(1600, 900, 2), 1600, 900, 'Остров-град на закате, вид с Волги', 'Анна Смирнова'),
  photo(fakePhoto(1600, 1200, 3), 1600, 1200, 'Деревянная Троицкая церковь — старейшее здание острова', 'Команда проекта', 'CC0'),
];
const BROKEN = photo('/definitely-missing-photo.webp', 1600, 1067, 'Успенский собор Свияжска с высоты птичьего полёта', 'Иван Петров');

const HTML = `
<p>Свияжск основан в 1551 году как крепость для похода Ивана Грозного на Казань: деревянные стены и башни срубили выше по Волге, у Углича, сплавили по реке и собрали на холме в устье Свияги за четыре недели.</p>
<p>После строительства Куйбышевского водохранилища в 1955–1957 годах холм оказался островом, а в 2008 году к нему проложили дамбу. Сегодня Успенский собор и монастырь входят в список Всемирного наследия ЮНЕСКО.</p>
<h3>Что посмотреть</h3>
<ul><li>Успенский собор с редкими фресками XVI века</li><li>Троицкую церковь — единственную сохранившуюся постройку 1551 года</li><li>Музей истории града Свияжска</li></ul>
<p>Остров удобно посетить на теплоходе из Казани: дорога по Волге занимает около двух часов, а с палубы видно, как меняется береговая линия водохранилища.</p>
<p>Подробнее — на <a href="https://ru.wikipedia.org/wiki/Свияжск">странице в Википедии</a>.</p>`;

function stop(overrides: Partial<StopData> = {}): StopData {
  return {
    slug: 'sviyazhsk',
    index: 4,
    title: 'Свияжск',
    subtitle: 'Остров-град в устье Свияги',
    lat: 55.77,
    lon: 48.66,
    category: 'история',
    kind: 'key',
    card: 'Крепость, собранная за четыре недели, стала островом после водохранилища',
    theses: [
      'Крепость 1551 года собрали за 4 недели из готовых срубов, сплавленных по Волге',
      'Островом холм стал только в 1957 году — после Куйбышевского водохранилища',
      'Успенский собор с фресками XVI века — объект Всемирного наследия ЮНЕСКО',
    ],
    link: 'От Булгара вверх по Волге: следующая веха — Казанское ханство и его завоевание.',
    photos: PHOTOS,
    talkPhotos: PHOTOS.slice(0, 3),
    sources: [
      { title: 'Свияжск — Википедия', url: 'https://ru.wikipedia.org/wiki/Свияжск' },
      { title: 'Успенский собор и монастырь острова-града Свияжск — UNESCO', url: 'https://whc.unesco.org/ru/list/1525' },
      { title: 'Музей-заповедник «Остров-град Свияжск»' },
    ],
    duration: 80,
    speaker: 1,
    html: HTML,
    transition: { type: 'arc' },
    ...overrides,
  };
}

const views = ['talk', 'talk-broken', 'tour', 'tour-broken', 'card', 'card-broken', 'flight', 'preload', 'black'];
document.querySelector('#views')!.append(
  ...views.map((v) => {
    const a = document.createElement('a');
    a.href = `?view=${v}`;
    a.textContent = v;
    return a;
  }),
);

drawMap();
new MapAttribution('© OpenStreetMap contributors, Copernicus DEM');

const log = (...a: unknown[]) => console.log('[preview]', ...a);

switch (view) {
  case 'talk':
  case 'talk-broken': {
    const s = view === 'talk' ? stop() : stop({ talkPhotos: [BROKEN, ...PHOTOS.slice(1, 3)] });
    const ss = new Slideshow({ variant: 'talk', onOpen: () => log('open'), onClose: () => log('close') });
    ss.open(s, photoIndex);
    // ручная проверка ввода «Доклада»: клавиши/тапы листают фото, B — чёрный экран
    const black = new BlackScreen();
    attachTalkInput(
      window,
      (e) => {
        log('event', e.type);
        if (e.type === 'forward') ss.showPhoto(ss.photoIndex + 1);
        if (e.type === 'back') ss.showPhoto(ss.photoIndex - 1);
        if (e.type === 'home') ss.showPhoto(0);
      },
      { onBlack: () => black.toggle() },
    );
    break;
  }
  case 'tour':
  case 'tour-broken': {
    const s = view === 'tour' ? stop() : stop({ photos: [BROKEN, ...PHOTOS.slice(1)] });
    const ss: Slideshow = new Slideshow({
      variant: 'tour',
      onRequestClose: () => ss.close(),
      onPhotoChange: (i) => log('photo', i),
      onStopNav: (d) => log('stop', d),
    });
    ss.open(s, photoIndex, { label: 'Остановка 5 · история', prevTitle: 'Болгар', nextTitle: 'Казанский кремль' });
    break;
  }
  case 'card':
  case 'card-broken': {
    const s = stop({
      kind: 'flythrough',
      title: 'Раифский монастырь',
      subtitle: undefined,
      category: 'религия',
      card: 'Монастырь XVII века на берегу озера в Волжско-Камском заповеднике',
      talkPhotos: [view === 'card' ? PHOTOS[2] : BROKEN],
    });
    new Card().show(s);
    break;
  }
  case 'flight':
    new FlightLabel().show('Казанский кремль');
    break;
  case 'preload': {
    const bar = new PreloadBar();
    bar.show();
    bar.update(Number(params.get('done') ?? 17), 39);
    break;
  }
  case 'black': {
    const b = new BlackScreen();
    b.toggle();
    break;
  }
}
