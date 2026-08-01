import { tagKey } from "@/lib/taxonomy/tags";

import type { BackupBook } from "./schema";

/**
 * 가져오기 계획 (PRD §3.2 F15 — "중복 ISBN 처리 정책 포함").
 *
 * 이미 있는 책을 다시 넣으면 DB의 unique(user_id, isbn13)에 걸려 통째로
 * 실패한다. 그 전에 여기서 갈라낸다.
 *
 * 판정만 하고 쓰지는 않는다 — 서버 액션이 결과를 받아 실행한다.
 */

export const DUPLICATE_POLICIES = ["skip", "add"] as const;
export type DuplicatePolicy = (typeof DUPLICATE_POLICIES)[number];

export const DUPLICATE_POLICY_LABEL: Record<DuplicatePolicy, string> = {
  skip: "건너뛰기 (이미 있는 책은 그대로 둠)",
  add: "그래도 추가 (ISBN이 겹치면 실패할 수 있음)",
};

export function isDuplicatePolicy(value: unknown): value is DuplicatePolicy {
  return typeof value === "string" && (DUPLICATE_POLICIES as readonly string[]).includes(value);
}

/** 이미 서재에 있는 책을 알아보기 위한 최소 정보. */
export type ExistingBook = {
  isbn13: string | null;
  title: string;
};

/**
 * 같은 책인지 판정하는 키.
 *
 * ISBN이 있으면 그걸 쓴다. 없는 책(직접 등록·독립출판물)은 제목으로 본다 —
 * 완벽하진 않지만, 백업을 두 번 가져왔을 때 서재가 두 배가 되는 것보다는 낫다.
 * 제목 비교는 태그와 같은 규칙(공백·대소문자 무시)을 쓴다.
 */
export function bookKey(book: { isbn13: string | null; title: string }): string {
  return book.isbn13 ? `isbn:${book.isbn13}` : `title:${tagKey(book.title)}`;
}

export type ImportPlan = {
  /** 실제로 넣을 책. */
  insert: BackupBook[];
  /** 이미 있어서 건너뛴 책 제목. 사용자에게 몇 권인지 알려준다. */
  skipped: string[];
};

/**
 * 무엇을 넣고 무엇을 건너뛸지 정한다.
 *
 * 백업 파일 안에서도 같은 책이 두 번 나올 수 있다(손으로 합친 파일 등).
 * 그것도 걸러야 한 번의 가져오기가 중간에 죽지 않는다.
 */
export function planImport(
  existing: ExistingBook[],
  incoming: BackupBook[],
  policy: DuplicatePolicy,
): ImportPlan {
  if (policy === "add") {
    return { insert: incoming, skipped: [] };
  }

  const seen = new Set(existing.map(bookKey));
  const insert: BackupBook[] = [];
  const skipped: string[] = [];

  for (const book of incoming) {
    const key = bookKey(book);
    if (seen.has(key)) {
      skipped.push(book.title);
      continue;
    }
    seen.add(key);
    insert.push(book);
  }

  return { insert, skipped };
}

export type ImportSummary = {
  books: number;
  readings: number;
  logs: number;
  notes: number;
  skipped: number;
};

/** 결과를 사람이 읽는 한 문장으로. */
export function describeSummary(summary: ImportSummary): string {
  const parts = [
    `책 ${summary.books}권`,
    `회차 ${summary.readings}건`,
    `진행 기록 ${summary.logs}건`,
    `인용구 ${summary.notes}건`,
  ];

  const base = `${parts.join(" · ")}을 가져왔습니다.`;
  return summary.skipped > 0 ? `${base} ${summary.skipped}권은 이미 있어 건너뛰었습니다.` : base;
}
