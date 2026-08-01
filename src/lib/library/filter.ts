import { yearOf } from "@/lib/format";
import { STATUS_LABEL, type ProgressUnit, type ReadingStatus } from "@/lib/reading-status";
import { tagKey } from "@/lib/taxonomy/tags";

/**
 * 서재 화면의 필터·정렬 (PRD §3.1 F8).
 *
 * 전량을 받아 클라이언트에서 거른다 — 장서가 수백 권 규모라 서버 필터링이
 * 필요 없고, 무한 스크롤·커서 로직이 사라져 필터 전환이 즉각 반응한다
 * (PRD §5). 1,000권을 넘어가면 그때 서버로 옮긴다.
 *
 * 여기는 순수 함수만 둔다. 조합이 많아 화면에 묻어두면 검증할 수 없다.
 */

/** 서재 카드 하나. 책 + 최신 회차 + 분류를 평평하게 편 모양. */
export type LibraryBook = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  coverUrl: string | null;
  updatedAt: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categorySortOrder: number;
  tags: string[];

  // 최신 회차. 책은 있는데 회차가 없는 경우는 없지만(등록 시 함께 만든다)
  // 방어적으로 null을 허용한다.
  status: ReadingStatus | null;
  attemptNo: number;
  progressUnit: ProgressUnit;
  currentValue: number;
  targetValue: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  rating: number | null;
  review: string | null;
};

// ---------------------------------------------------------------------------
// 상태 탭 — 위시리스트도 별도 화면이 아니라 이 탭 하나다 (PRD §4)
// ---------------------------------------------------------------------------
export const STATUS_TABS = ["all", "reading", "want", "finished", "paused", "dropped"] as const;
export type StatusTab = (typeof STATUS_TABS)[number];

export const STATUS_TAB_LABEL: Record<StatusTab, string> = {
  all: "전체",
  ...STATUS_LABEL,
};

export function isStatusTab(value: unknown): value is StatusTab {
  return typeof value === "string" && (STATUS_TABS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// 정렬
// ---------------------------------------------------------------------------
export const SORT_OPTIONS = ["updated", "finished", "rating", "title"] as const;
export type SortKey = (typeof SORT_OPTIONS)[number];

export const SORT_LABEL: Record<SortKey, string> = {
  updated: "최근 업데이트순",
  finished: "완독일순",
  rating: "별점순",
  title: "제목순",
};

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && (SORT_OPTIONS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// 필터
// ---------------------------------------------------------------------------
export type LibraryFilter = {
  status: StatusTab;
  categoryId: string | null;
  tag: string | null;
  /** 이 별점 이상만. null이면 안 거른다. */
  minRating: number | null;
  /** 완독 연도. "2026" 형식. */
  year: string | null;
  keyword: string;
};

export const EMPTY_FILTER: LibraryFilter = {
  status: "all",
  categoryId: null,
  tag: null,
  minRating: null,
  year: null,
  keyword: "",
};

/** 검색어 비교용. 대소문자와 앞뒤 공백을 무시한다. */
function searchKey(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

/**
 * 키워드가 걸리는 범위: 제목·부제·저자·출판사·태그.
 *
 * 소감은 넣지 않는다. 소감으로 책을 찾는 일은 드물고, 넣으면 흔한 단어
 * 하나에 서재 절반이 걸린다. 노트 검색은 /notes가 따로 맡는다.
 */
function matchesKeyword(book: LibraryBook, keyword: string): boolean {
  const needle = searchKey(keyword);
  if (needle.length === 0) return true;

  const haystack = [book.title, book.subtitle, book.publisher, ...book.authors, ...book.tags];

  return haystack.some((field) => field !== null && searchKey(field).includes(needle));
}

export function matchesFilter(book: LibraryBook, filter: LibraryFilter): boolean {
  if (filter.status !== "all" && book.status !== filter.status) return false;

  if (filter.categoryId !== null && book.categoryId !== filter.categoryId) return false;

  if (filter.tag !== null) {
    const wanted = tagKey(filter.tag);
    if (!book.tags.some((name) => tagKey(name) === wanted)) return false;
  }

  // 별점이 없는 책은 "그 이상"에 들지 않는다.
  if (filter.minRating !== null && (book.rating === null || book.rating < filter.minRating)) {
    return false;
  }

  if (filter.year !== null && yearOf(book.finishedAt) !== filter.year) return false;

  return matchesKeyword(book, filter.keyword);
}

export function filterBooks(books: LibraryBook[], filter: LibraryFilter): LibraryBook[] {
  return books.filter((book) => matchesFilter(book, filter));
}

/**
 * 정렬. 원본 배열을 건드리지 않는다.
 *
 * 값이 없는 항목(완독 안 함, 별점 없음)은 어느 방향이든 **맨 뒤로** 보낸다.
 * 별점순으로 봤을 때 별점 없는 책이 위에 오면 정렬한 의미가 없다.
 */
export function sortBooks(books: LibraryBook[], sort: SortKey): LibraryBook[] {
  const sorted = [...books];

  switch (sort) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title, "ko-KR"));

    case "rating":
      return sorted.sort((a, b) => {
        if (a.rating === null && b.rating === null) return byUpdatedDesc(a, b);
        if (a.rating === null) return 1;
        if (b.rating === null) return -1;
        return b.rating - a.rating || byUpdatedDesc(a, b);
      });

    case "finished":
      return sorted.sort((a, b) => {
        if (a.finishedAt === null && b.finishedAt === null) return byUpdatedDesc(a, b);
        if (a.finishedAt === null) return 1;
        if (b.finishedAt === null) return -1;
        return b.finishedAt.localeCompare(a.finishedAt);
      });

    case "updated":
    default:
      return sorted.sort(byUpdatedDesc);
  }
}

function byUpdatedDesc(a: LibraryBook, b: LibraryBook): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

// ---------------------------------------------------------------------------
// 필터 선택지 — 실제로 쓰이는 값만 보여준다
// ---------------------------------------------------------------------------

/**
 * 상태 탭에 붙일 권수.
 *
 * 다른 필터를 적용한 뒤의 수를 센다. "완독"이 0인데 탭이 그대로 보이면
 * 사용자는 눌러보고서야 빈 화면을 만난다.
 */
export function countByStatus(books: LibraryBook[]): Record<StatusTab, number> {
  const counts = {
    all: books.length,
    want: 0,
    reading: 0,
    paused: 0,
    finished: 0,
    dropped: 0,
  } as Record<StatusTab, number>;

  for (const book of books) {
    if (book.status !== null) counts[book.status] += 1;
  }

  return counts;
}

/** 완독 기록이 있는 연도만. 최근 연도부터. */
export function finishedYears(books: LibraryBook[]): string[] {
  const years = new Set<string>();
  for (const book of books) {
    const year = yearOf(book.finishedAt);
    if (year !== null) years.add(year);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

/** 실제로 쓰이고 있는 태그만. 가나다순. */
export function usedTags(books: LibraryBook[]): string[] {
  const byKey = new Map<string, string>();
  for (const book of books) {
    for (const name of book.tags) {
      if (!byKey.has(tagKey(name))) byKey.set(tagKey(name), name);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "ko-KR"));
}

/** 필터가 하나라도 걸려 있는가. "필터 지우기"를 보여줄지 판단한다. */
export function hasActiveFilter(filter: LibraryFilter): boolean {
  return (
    filter.status !== "all" ||
    filter.categoryId !== null ||
    filter.tag !== null ||
    filter.minRating !== null ||
    filter.year !== null ||
    filter.keyword.trim().length > 0
  );
}
