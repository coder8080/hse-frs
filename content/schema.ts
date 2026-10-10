// Схема контента: общий модуль для Vite-плагина, скриптов и тестов.
// Остановка = content/stops/<slug>.md (frontmatter + полное описание в Markdown).
// Порядок остановок задаёт только content/route.json (R10).
// Сообщения об ошибках — по-русски: их читают люди, которые правят тексты на GitHub.
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

/** Обязательная непустая строка с понятным сообщением и для «нет поля», и для «пусто» */
const text = (msg: string) => z.string({ error: msg }).trim().min(1, msg);

const httpUrl = z.url({ protocol: /^https?$/, error: 'нужна ссылка вида https://…' });

export const PhotoSchema = z
  .object({
    /** Имя файла в content/photos/ */
    file: text('укажите имя файла фото из папки content/photos/'),
    caption: text('у фото должна быть подпись'),
    author: text('у фото должен быть автор'),
    license: text('у фото должна быть лицензия'),
    /** Ссылка на страницу файла (Commons) или пусто для своих фото */
    source: httpUrl.optional(),
  })
  .strict();

export const SourceSchema = z
  .object({
    title: text('у источника должно быть название'),
    url: httpUrl.optional(),
  })
  .strict();

export const FactcheckSchema = z
  .object({
    by: text('укажите, кто проверил факты'),
    date: z.union(
      [
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'дата в формате 2026-11-01'),
        z.date().transform((d) => d.toISOString().slice(0, 10)),
      ],
      { error: 'дата в формате 2026-11-01' },
    ),
  })
  .strict();

export const StopSchema = z
  .object({
    title: text('у остановки должно быть название'),
    subtitle: z.string().optional(),
    lat: z
      .number({ error: 'широта — число без кавычек, например 55.796' })
      .min(53.9, 'широта вне Татарстана (53.9–56.75)')
      .max(56.75, 'широта вне Татарстана (53.9–56.75)'),
    lon: z
      .number({ error: 'долгота — число без кавычек, например 49.108' })
      .min(47.2, 'долгота вне Татарстана (47.2–54.3)')
      .max(54.3, 'долгота вне Татарстана (47.2–54.3)'),
    category: z.enum(CATEGORIES, { error: `категория — одно из: ${CATEGORIES.join(', ')}` }),
    /** intro — «Татарстан в цифрах», key — ключевая, flythrough — пролётная */
    kind: z.enum(['intro', 'key', 'flythrough'], { error: 'kind — одно из: intro, key, flythrough' }),
    /** Одна строка: карточка пролётной остановки и подпись в списке */
    card: text('нужна короткая подпись-карточка (одна строка)'),
    /** 2–4 тезиса для «Доклада» (у ключевых и вступления обязательны) */
    theses: z.array(text('тезис не может быть пустым')).max(4, 'не больше 4 тезисов').default([]),
    /** Смысловая связка с предыдущей остановкой */
    link: z.string().optional(),
    /** 1–4 фото; в «Докладе» идут первые 3 (R13) */
    photos: z.array(PhotoSchema).min(1, 'нужно хотя бы одно фото').max(4, 'не больше 4 фото на остановку'),
    sources: z.array(SourceSchema).min(1, 'нужен хотя бы один источник'),
    /** Плановая длительность в «Докладе», секунд */
    duration: z
      .number({ error: 'длительность — целое число секунд без кавычек' })
      .int('длительность — целое число секунд')
      .positive('длительность должна быть больше нуля'),
    speaker: z
      .number({ error: 'номер докладчика: 1, 2 или 3' })
      .int('номер докладчика: 1, 2 или 3')
      .min(1, 'номер докладчика: 1, 2 или 3')
      .max(3, 'номер докладчика: 1, 2 или 3'),
    factcheck: FactcheckSchema.optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.kind !== 'flythrough' && s.theses.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['theses'], message: 'у ключевой остановки нужно 2–4 тезиса' });
    }
  });

export const TransitionSchema = z.discriminatedUnion(
  'type',
  [
    /** первая остановка: камера уже над картой */
    z.object({ type: z.literal('start') }).strict(),
    /** дуга над рельефом */
    z.object({ type: z.literal('arc'), height: z.number().positive().optional() }).strict(),
    /** вдоль осевой линии реки из data/rivers.json */
    z
      .object({
        type: z.literal('river'),
        river: text('укажите реку, например volga'),
        /** необязательные опорные точки [lat, lon] поверх осевой линии */
        via: z.array(z.tuple([z.number(), z.number()])).optional(),
      })
      .strict(),
    /** финал: подъём над всей картой, пауза, пикирование */
    z.object({ type: z.literal('final') }).strict(),
  ],
  { error: 'тип перехода — одно из: start, arc, river, final' },
);

export const RouteSchema = z
  .object({
    title: text('у маршрута должно быть название'),
    subtitle: z.string().optional(),
    stops: z
      .array(
        z
          .object({
            slug: z
              .string({ error: 'укажите slug — имя файла остановки без .md' })
              .regex(/^[a-z0-9-]+$/, 'slug: только латиница, цифры и дефис'),
            transition: TransitionSchema,
          })
          .strict(),
      )
      .min(1, 'в маршруте нужна хотя бы одна остановка'),
  })
  .strict();

export type Photo = z.infer<typeof PhotoSchema>;
export type Stop = z.infer<typeof StopSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type Category = (typeof CATEGORIES)[number];
export type StopKind = Stop['kind'];
