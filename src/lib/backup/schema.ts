import { z } from "zod";

/**
 * 백업 파일 형식 (PRD §3.2 F15).
 *
 * **분류를 id가 아니라 이름으로 참조한다.** 분야·태그·서재는 사용자 안에서
 * 이름이 유일하므로(DB unique) 자연키가 된다. 그래서
 *
 *   - 파일을 열어보면 사람이 읽을 수 있다
 *   - 다른 계정으로 옮겨도 UUID를 다시 매핑할 필요가 없다
 *   - 가져오기가 "이름으로 찾고 없으면 만든다"로 끝난다
 *
 * 책은 회차·진행 기록·인용구를 안에 품는다. 평평하게 펴서 FK로 잇는 것보다
 * 중첩이 읽기 쉽고, 가져오다 끊겨도 책 단위로 잘린다.
 */

export const BACKUP_VERSION = 1;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.");

const progressLogSchema = z.object({
  logged_on: isoDate,
  value_from: z.number().int().nullable(),
  value_to: z.number().int(),
  minutes: z.number().int().nullable(),
  memo: z.string().nullable(),
});

const noteSchema = z.object({
  kind: z.enum(["quote", "thought", "question"]),
  location: z.number().int().nullable(),
  body: z.string(),
  is_favorite: z.boolean(),
});

const readingSchema = z.object({
  attempt_no: z.number().int().min(1),
  status: z.enum(["want", "reading", "paused", "finished", "dropped"]),
  progress_unit: z.enum(["percent", "page"]),
  current_value: z.number().int(),
  target_value: z.number().int().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  dropped_at: z.string().nullable(),
  drop_reason: z.string().nullable(),
  rating: z.number().nullable(),
  review: z.string().nullable(),
  review_is_private: z.boolean(),
  spoiler: z.boolean(),
  due_on: isoDate.nullable(),
  progress_logs: z.array(progressLogSchema),
  notes: z.array(noteSchema),
});

const bookSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable(),
  authors: z.array(z.string()),
  translators: z.array(z.string()),
  publisher: z.string().nullable(),
  published_on: isoDate.nullable(),
  isbn13: z.string().nullable(),
  cover_url: z.string().nullable(),
  total_pages: z.number().int().nullable(),
  format: z.enum(["ebook", "paper"]),
  ownership: z.enum(["own", "library", "subscription", "borrowed"]),
  memo: z.string().nullable(),
  source: z.enum(["manual", "kakao", "aladin"]),
  source_ref: z.unknown().nullable(),

  /** 분야 이름. 없으면 분류 안 한 책이다. */
  category: z.string().nullable(),
  /** 태그 이름들. */
  tags: z.array(z.string()),
  /** 담겨 있던 서재 이름들. */
  shelves: z.array(z.string()),

  readings: z.array(readingSchema),
});

export const backupSchema = z.object({
  version: z.number().int(),
  exported_at: z.string(),
  categories: z.array(
    z.object({
      name: z.string(),
      color: z.string().nullable(),
      sort_order: z.number().int(),
    }),
  ),
  shelves: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      sort_order: z.number().int(),
    }),
  ),
  goals: z.array(
    z.object({
      period: z.enum(["year", "month"]),
      period_key: z.string(),
      metric: z.enum(["books", "minutes"]),
      target: z.number().int(),
    }),
  ),
  books: z.array(bookSchema),
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupBook = z.infer<typeof bookSchema>;
export type BackupReading = z.infer<typeof readingSchema>;

export type ParseResult = { ok: true; backup: Backup } | { ok: false; message: string };

/**
 * 업로드된 파일 내용을 백업으로 읽는다.
 *
 * 남의 JSON이나 깨진 파일을 그대로 DB에 밀어넣지 않는다. 버전이 앞서면
 * 거절한다 — 모르는 형식을 억지로 해석하면 조용히 데이터가 어긋난다.
 */
export function parseBackup(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, message: "JSON 파일이 아닙니다." };
  }

  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      message: `백업 파일 형식이 아닙니다. (${issue.path.join(".") || "root"}: ${issue.message})`,
    };
  }

  if (parsed.data.version > BACKUP_VERSION) {
    return {
      ok: false,
      message: `이 백업은 더 새로운 버전(v${parsed.data.version})입니다. 앱을 업데이트해주세요.`,
    };
  }

  return { ok: true, backup: parsed.data };
}
