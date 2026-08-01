import { z } from "zod";

/**
 * 도서 등록·수정 입력.
 *
 * FormData는 전부 문자열이라 먼저 다듬은 뒤(readBookForm) 검증한다.
 * 제약은 DB(0001_init.sql)와 같은 값으로 맞춘다 — 여기서 걸러야 사용자가
 * Postgres 에러 대신 한국어 메시지를 본다.
 */

export const BOOK_FORMATS = ["ebook", "paper"] as const;
export const BOOK_OWNERSHIPS = ["own", "library", "subscription", "borrowed"] as const;

export const FORMAT_LABEL: Record<(typeof BOOK_FORMATS)[number], string> = {
  ebook: "전자책",
  paper: "종이책",
};

export const OWNERSHIP_LABEL: Record<(typeof BOOK_OWNERSHIPS)[number], string> = {
  own: "소장",
  library: "도서관 대출",
  subscription: "구독",
  borrowed: "빌림",
};

export const bookInputSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요.").max(300, "제목이 너무 깁니다."),
  subtitle: z.string().trim().max(300, "부제가 너무 깁니다.").nullable(),
  authors: z
    .array(z.string().trim().min(1).max(100))
    .max(20, "저자는 20명까지 입력할 수 있습니다."),
  translators: z
    .array(z.string().trim().min(1).max(100))
    .max(20, "역자는 20명까지 입력할 수 있습니다."),
  publisher: z.string().trim().max(200, "출판사가 너무 깁니다.").nullable(),
  published_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "출간일은 YYYY-MM-DD 형식이어야 합니다.")
    .nullable(),
  isbn13: z
    .string()
    .regex(/^\d{13}$/, "ISBN13은 숫자 13자리여야 합니다.")
    .nullable(),
  cover_url: z.url("표지 주소가 올바른 URL이 아닙니다.").nullable(),
  total_pages: z
    // 숫자로 바꿀 수 없는 입력은 NaN으로 들어온다. 타입 단계 메시지가 없으면
    // zod 기본 영어 문구가 그대로 사용자에게 노출된다.
    .number({ message: "페이지수는 숫자로 입력하세요." })
    .int("페이지수는 정수여야 합니다.")
    .min(1, "페이지수는 1 이상이어야 합니다.")
    .max(20000, "페이지수가 너무 큽니다.")
    .nullable(),
  format: z.enum(BOOK_FORMATS, { message: "형태는 전자책 또는 종이책이어야 합니다." }),
  ownership: z.enum(BOOK_OWNERSHIPS, { message: "소장 형태가 올바르지 않습니다." }),
  memo: z.string().trim().max(2000, "메모가 너무 깁니다.").nullable(),
  // 분야는 책당 1개(PRD §2.1 B). 미지정을 허용한다 — 위시리스트에 담는
  // 시점에는 어느 분야인지 모를 수 있다.
  category_id: z.uuid("분야 선택이 올바르지 않습니다.").nullable(),
  source: z.enum(["manual", "kakao"]),
  source_ref: z.record(z.string(), z.unknown()).nullable(),
});

export type BookInput = z.infer<typeof bookInputSchema>;

/** 빈 문자열은 "값 없음"으로 본다. DB의 null과 맞추기 위해서다. */
function text(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** "유발 하라리, 조현욱" → ["유발 하라리", "조현욱"] */
export function splitNames(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function integer(value: FormDataEntryValue | null): number | null {
  const raw = text(value);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function json(value: FormDataEntryValue | null): Record<string, unknown> | null {
  const raw = text(value);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function readBookForm(formData: FormData) {
  return bookInputSchema.safeParse({
    title: formData.get("title") ?? "",
    subtitle: text(formData.get("subtitle")),
    authors: splitNames(formData.get("authors")),
    translators: splitNames(formData.get("translators")),
    publisher: text(formData.get("publisher")),
    published_on: text(formData.get("published_on")),
    isbn13: text(formData.get("isbn13")),
    cover_url: text(formData.get("cover_url")),
    total_pages: integer(formData.get("total_pages")),
    format: text(formData.get("format")) ?? "ebook",
    ownership: text(formData.get("ownership")) ?? "own",
    memo: text(formData.get("memo")),
    category_id: text(formData.get("category_id")),
    source: text(formData.get("source")) ?? "manual",
    source_ref: json(formData.get("source_ref")),
  });
}
