// Оверлеи интерфейса (без фреймворка). Импорт этого модуля подключает шрифты и стили.
import './fonts.css';
import './styles.css';

export { Slideshow } from './slideshow';
export type { SlideshowOptions, SlideshowOpenOptions, SlideshowVariant } from './slideshow';
export { Card } from './card';
export type { CardOptions } from './card';
export { FlightLabel, PreloadBar, BlackScreen, MapAttribution } from './overlays';
export { createPhotoFigure, releasePhotoFigure } from './photo';
