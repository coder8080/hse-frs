// Данные, которые Vite-плагин отдаёт в браузер через `virtual:content`.
import type { Category, StopKind, Transition } from '../content/schema';

export interface PhotoData {
  /** URL готового WebP в бандле */
  src: string;
  width: number;
  height: number;
  caption: string;
  author: string;
  license: string;
  source?: string;
}

export interface StopData {
  slug: string;
  /** Позиция в route.json */
  index: number;
  title: string;
  subtitle?: string;
  lat: number;
  lon: number;
  category: Category;
  kind: StopKind;
  card: string;
  theses: string[];
  link?: string;
  /** Все фото — для «Путешествия» */
  photos: PhotoData[];
  /** Первые 3 фото — для «Доклада» (R13) */
  talkPhotos: PhotoData[];
  sources: { title: string; url?: string }[];
  duration: number;
  speaker: number;
  factcheck?: { by: string; date: string };
  /** Полное описание, отрендеренное из Markdown */
  html: string;
  /** Как камера прилетает к этой остановке */
  transition: Transition;
}

export interface RouteData {
  title: string;
  subtitle?: string;
  stops: StopData[];
}
