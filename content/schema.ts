// Схема контента: общий модуль для Vite-плагина, скриптов и тестов.
// Остановка = content/stops/<slug>.md (frontmatter + полное описание в Markdown).
// Порядок остановок задаёт только content/route.json (R10).
import { z } from 'zod';

export const CATEGORIES = [
  'география',
  'история',
  'религия',
  'культура',
  'экономика',
  'природа',
  'люди',
  'наука',
] as const;

export const PhotoSchema = z
  .object({
    /** Имя файла в content/photos/ */
    file: z.string().min(1),
    caption: z.string().min(1),
    author: z.string().min(1, 'у фото должен быть автор'),
    license: z.string().min(1, 'у фото должна быть лицензия'),
    /** Ссылка на страницу файла (Commons) или пусто для своих фото */
    source: z.string().url().optional(),
  })
  .strict();

export const SourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url().optional(),
  })
  .strict();

export const FactcheckSchema = z
  .object({
    by: z.string().min(1),
    date: z.union([z.string().min(1), z.date().transform((d) => d.toISOString().slice(0, 10))]),
  })
  .strict();

export const StopSchema = z
  .object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    lat: z.number().min(53.9).max(56.75),
    lon: z.number().min(47.2).max(54.3),
    category: z.enum(CATEGORIES),
    /** intro — «Татарстан в цифрах», key — ключевая, flythrough — пролётная */
    kind: z.enum(['intro', 'key', 'flythrough']),
    /** Одна строка: карточка пролётной остановки и подпись в списке */
    card: z.string().min(1),
    /** 2–4 тезиса для «Доклада» (у ключевых и вступления обязательны) */
    theses: z.array(z.string().min(1)).max(4).default([]),
    /** Смысловая связка с предыдущей остановкой */
    link: z.string().optional(),
    /** 1–4 фото; в «Докладе» идут первые 3 (R13) */
    photos: z.array(PhotoSchema).min(1).max(4),
    sources: z.array(SourceSchema).min(1),
    /** Плановая длительность в «Докладе», секунд */
    duration: z.number().int().positive(),
    speaker: z.number().int().min(1).max(3),
    factcheck: FactcheckSchema.optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.kind !== 'flythrough' && s.theses.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['theses'], message: 'у ключевой остановки нужно 2–4 тезиса' });
    }
  });

export const TransitionSchema = z.discriminatedUnion('type', [
  /** первая остановка: камера уже над картой */
  z.object({ type: z.literal('start') }).strict(),
  /** дуга над рельефом */
  z.object({ type: z.literal('arc'), height: z.number().positive().optional() }).strict(),
  /** вдоль осевой линии реки из data/rivers.json */
  z
    .object({
      type: z.literal('river'),
      river: z.string().min(1),
      /** необязательные опорные точки [lat, lon] поверх осевой линии */
      via: z.array(z.tuple([z.number(), z.number()])).optional(),
    })
    .strict(),
  /** финал: подъём над всей картой, пауза, пикирование */
  z.object({ type: z.literal('final') }).strict(),
]);

export const RouteSchema = z
  .object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    stops: z
      .array(
        z
          .object({
            slug: z.string().regex(/^[a-z0-9-]+$/, 'slug: только латиница, цифры и дефис'),
            transition: TransitionSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type Photo = z.infer<typeof PhotoSchema>;
export type Stop = z.infer<typeof StopSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type Category = (typeof CATEGORIES)[number];
export type StopKind = Stop['kind'];
