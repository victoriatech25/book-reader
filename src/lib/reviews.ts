import type { ProgressUnit } from "./reading-status";

/**
 * 별점 · 한 줄 소감 · 인용구 검증.
 *
 * 한계값은 DB(0001_init.sql)와 같게 맞춘다. 여기서 걸러야 사용자가 Postgres
 * 제약 위반 대신 한국어 문장을 본다.
 */

/** 소감은 한 줄에서 몇 줄까지. 길이를 스키마와 UI 양쪽에서 막는다 (PRD §2.3). */
export const REVIEW_MAX_LENGTH = 500;
export const NOTE_MAX_LENGTH = 2000;

/** 0.5 단위 별점 후보. 화면의 선택지와 검증이 같은 목록을 쓴다. */
export const RATING_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export type Check = { ok: true } | { ok: false; message: string };

/** 별점. 미입력(null)은 허용한다 — 점수를 매기고 싶지 않은 책이 있다. */
export function checkRating(rating: number | null): Check {
  if (rating === null) return { ok: true };

  if (!Number.isFinite(rating)) {
    return { ok: false, message: "별점이 올바르지 않습니다." };
  }

  if (rating < 0.5 || rating > 5) {
    return { ok: false, message: "별점은 0.5에서 5.0 사이여야 합니다." };
  }

  // DB 제약(readings_rating)과 같은 규칙: 0.5의 배수만 허용한다.
  if (rating * 2 !== Math.trunc(rating * 2)) {
    return { ok: false, message: "별점은 0.5 단위로만 매길 수 있습니다." };
  }

  return { ok: true };
}

export function checkReview(review: string | null): Check {
  if (review === null) return { ok: true };

  if (review.length > REVIEW_MAX_LENGTH) {
    return {
      ok: false,
      message: `소감은 ${REVIEW_MAX_LENGTH}자까지 쓸 수 있습니다. (현재 ${review.length}자)`,
    };
  }

  return { ok: true };
}

/** 빈 문자열·공백만 있는 입력은 "값 없음"으로 본다. */
export function normalizeText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 폼에서 온 별점 문자열을 숫자로. 빈 값은 "매기지 않음". */
export function parseRating(value: FormDataEntryValue | null): number | null {
  const text = normalizeText(value);
  if (text === null) return null;
  return Number(text);
}

export function formatRating(rating: number | null): string {
  return rating === null ? "별점 없음" : `★ ${rating.toFixed(1)}`;
}

// ---------------------------------------------------------------------------
// 인용구 · 메모
// ---------------------------------------------------------------------------
export const NOTE_KINDS = ["quote", "thought", "question"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  quote: "인용",
  thought: "생각",
  question: "질문",
};

export function isNoteKind(value: unknown): value is NoteKind {
  return typeof value === "string" && (NOTE_KINDS as readonly string[]).includes(value);
}

export function checkNoteBody(body: string | null): Check {
  if (body === null) return { ok: false, message: "내용을 입력하세요." };

  if (body.length > NOTE_MAX_LENGTH) {
    return {
      ok: false,
      message: `${NOTE_MAX_LENGTH}자까지 쓸 수 있습니다. (현재 ${body.length}자)`,
    };
  }

  return { ok: true };
}

/** 인용 위치. 단위는 소속 독서 기록을 따른다(페이지 또는 %). */
export function checkNoteLocation(
  location: number | null,
  unit: ProgressUnit,
  target: number | null,
): Check {
  if (location === null) return { ok: true };

  if (!Number.isInteger(location)) {
    return { ok: false, message: "위치는 정수로 입력하세요." };
  }

  if (location < 0) {
    return { ok: false, message: "위치는 0 이상이어야 합니다." };
  }

  if (target !== null && location > target) {
    return {
      ok: false,
      message:
        unit === "percent"
          ? "위치는 100%를 넘을 수 없습니다."
          : `전체 ${target}쪽을 넘을 수 없습니다.`,
    };
  }

  return { ok: true };
}

export function formatNoteLocation(location: number | null, unit: ProgressUnit): string {
  if (location === null) return "";
  return unit === "page" ? `${location}쪽` : `${location}%`;
}
