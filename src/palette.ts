// Общая палитра диорамы. Рельеф, вода и миниатюры берут цвета только отсюда,
// чтобы сцена выглядела как один набор игрушек.

export const PALETTE = {
  // фон и небо
  sky: '#e4e9f0',
  fog: '#e4e9f0',
  // рельеф по высоте (низины → возвышенности)
  lowland: '#a8c686',
  plain: '#c2cf8e',
  upland: '#d8c995',
  ridge: '#c7a878',
  outside: '#e6e2d6', // земля за границей Татарстана, приглушённая
  // растительный покров (текстура земли)
  forestFloor: '#5b8a4c',
  meadow: '#a9c784',
  town: '#cfc3b2',
  wetland: '#8cb39a',
  // деревья
  pine: '#3f6b45',
  leaf: '#5f8f4a',
  trunk: '#7a5a3e',
  // вода
  water: '#5b9ec4',
  waterDeep: '#3f7fa6',
  river: '#6aaed2',
  border: '#0f2d69', // тёмно-синий НИУ ВШЭ
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

/** Лоскуты полей: спелая пшеница, озимые, жнивьё, всходы, рапс. */
export const FIELDS = ['#e0d08c', '#cdd486', '#d9c27f', '#bfcd7a', '#e6d9a4'] as const;

/** Направление солнца для запечённого освещения (R15): с юго-запада, сверху. */
export const SUN_DIR = { x: -0.45, y: 0.8, z: 0.4 } as const;
