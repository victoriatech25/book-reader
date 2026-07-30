/**
 * 독서 상태 전이 규칙 (PRD §2.2).
 *
 * DB에도 상태-날짜 정합성 제약이 있지만, 어떤 전이가 허용되는지는 스키마가
 * 표현하지 못한다. 그 규칙을 여기 한 곳에 모으고 UI와 서버 액션이 함께 쓴다.
 *
 * 순수 함수만 둔다 — DB도 세션도 모른다.
 */

export const READING_STATUSES = ["want", "reading", "paused", "finished", "dropped"] as const;

export type ReadingStatus = (typeof READING_STATUSES)[number];

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  want: "읽고 싶은",
  reading: "읽는 중",
  paused: "잠시 멈춤",
  finished: "완독",
  dropped: "중단",
};

/**
 * 허용 전이표. 여기 없는 조합은 전부 거부한다.
 *
 * finished/dropped는 종착점이다. 다시 읽으려면 상태를 되돌리는 게 아니라
 * attempt_no를 올린 새 readings 행을 만든다(PRD §2.1 A).
 */
const ALLOWED_TRANSITIONS: Record<ReadingStatus, readonly ReadingStatus[]> = {
  want: ["reading"],
  reading: ["paused", "finished", "dropped"],
  paused: ["reading", "dropped"],
  finished: [],
  dropped: [],
};

/** 전이 버튼에 쓸 문구. 상태 이름이 아니라 행위로 적는다. */
export const TRANSITION_LABEL: Record<string, string> = {
  "want->reading": "읽기 시작",
  "reading->paused": "잠시 멈춤",
  "reading->finished": "완독",
  "reading->dropped": "중단",
  "paused->reading": "다시 읽기",
  "paused->dropped": "중단",
};

export function transitionLabel(from: ReadingStatus, to: ReadingStatus): string {
  return TRANSITION_LABEL[`${from}->${to}`] ?? STATUS_LABEL[to];
}

export function canTransition(from: ReadingStatus, to: ReadingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: ReadingStatus): readonly ReadingStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

/** 더 이상 전이할 수 없는 상태. 재독은 새 행으로 시작한다. */
export function isTerminal(status: ReadingStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: ReadingStatus,
    readonly to: ReadingStatus,
  ) {
    super(`${STATUS_LABEL[from]} 상태에서 ${STATUS_LABEL[to]}(으)로 바꿀 수 없습니다.`);
    this.name = "InvalidTransitionError";
  }
}

export type ReadingDates = {
  status: ReadingStatus;
  started_at: string | null;
  finished_at: string | null;
  dropped_at: string | null;
};

export type StatusPatch = {
  status: ReadingStatus;
  started_at: string | null;
  finished_at: string | null;
  dropped_at: string | null;
  drop_reason: string | null;
};

/**
 * 상태를 바꿀 때 함께 갱신할 날짜 필드를 계산한다.
 *
 * DB 제약(readings_started_ts 등)을 만족시키는 것이 목적이므로 규칙이 단순하다.
 *   - want 이외의 상태는 started_at이 반드시 있어야 한다
 *   - 이어읽기(paused → reading)는 최초 시작일을 덮어쓰지 않는다
 *   - 완독/중단 시각은 그 전이가 일어난 순간으로 새로 찍는다
 */
export function buildStatusPatch(
  current: ReadingDates,
  to: ReadingStatus,
  options: { now?: Date; dropReason?: string | null } = {},
): StatusPatch {
  if (!canTransition(current.status, to)) {
    throw new InvalidTransitionError(current.status, to);
  }

  const now = (options.now ?? new Date()).toISOString();

  const patch: StatusPatch = {
    status: to,
    started_at: current.started_at,
    finished_at: current.finished_at,
    dropped_at: current.dropped_at,
    drop_reason: null,
  };

  if (to !== "want") {
    patch.started_at = current.started_at ?? now;
  }

  if (to === "finished") {
    patch.finished_at = now;
  }

  if (to === "dropped") {
    patch.dropped_at = now;
    patch.drop_reason = options.dropReason?.trim() || null;
  }

  return patch;
}

export type ProgressUnit = "percent" | "page";

/**
 * 새 독서 시도의 진행률 단위를 정한다 (PRD §2.1 C).
 *
 * 전자책은 리더마다 페이지 표기가 달라 %로 센다. 종이책이라도 페이지수를
 * 모르면 %로 시작한다 — 위시리스트 단계에서 분량을 모른다고 등록을 막지 않는다.
 */
export function initialProgress(book: { format: string; total_pages: number | null }): {
  progress_unit: ProgressUnit;
  target_value: number;
} {
  if (book.format === "paper" && book.total_pages && book.total_pages > 0) {
    return { progress_unit: "page", target_value: book.total_pages };
  }
  return { progress_unit: "percent", target_value: 100 };
}
