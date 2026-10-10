// Общая палитра диорамы. Рельеф, вода и миниатюры берут цвета только отсюда,
// чтобы сцена выглядела как один набор игрушек.

export const PALETTE = {
  // фон и небо
  sky: '#dfe9ee',
  fog: '#dfe9ee',
  // рельеф по высоте (низины → возвышенности)
  lowland: '#a8c686',
  plain: '#c2cf8e',
  upland: '#d8c995',
  ridge: '#c7a878',
  outside: '#e6e2d6', // земля за границей Татарстана, приглушённая
  // вода
  water: '#5b9ec4',
  waterDeep: '#3f7fa6',
  river: '#6aaed2',
  border: '#8a5a44',
  // материалы миниатюр
  stoneWhite: '#f2efe6',
  stoneSand: '#e3d3ac',
  brickRed: '#b55a45',
  roofGreen: '#4f8a6b',
  roofBlue: '#3e6fa8',
  roofDark: '#4a4f5a',
  gold: '#e0b44c',
  wood: '#9a6b45',
  forest: '#4f7d4a',
  steel: '#9aa3ad',
  kamazBlue: '#2b5aa8',
  kamazWhite: '#f4f4f0',
  glass: '#8fc3dd',
  oilBlack: '#34363b',
  accent: '#d9583b',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Направление солнца для запечённого освещения (R15): с юго-запада, сверху. */
export const SUN_DIR = { x: -0.45, y: 0.8, z: 0.4 } as const;
