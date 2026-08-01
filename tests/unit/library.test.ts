import { describe, expect, it } from "vitest";

import {
  countByStatus,
  EMPTY_FILTER,
  filterBooks,
  finishedYears,
  hasActiveFilter,
  isSortKey,
  isStatusTab,
  matchesFilter,
  sortBooks,
  usedTags,
  type LibraryBook,
} from "@/lib/library/filter";

function book(overrides: Partial<LibraryBook> = {}): LibraryBook {
  return {
    id: crypto.randomUUID(),
    title: "기본 제목",
    subtitle: null,
    authors: ["저자"],
    publisher: null,
    coverUrl: null,
    updatedAt: "2026-07-01T00:00:00Z",
    categoryId: null,
    categoryName: null,
    categoryColor: null,
    categorySortOrder: 0,
    tags: [],
    status: "want",
    attemptNo: 1,
    progressUnit: "percent",
    currentValue: 0,
    targetValue: 100,
    startedAt: null,
    finishedAt: null,
    rating: null,
    review: null,
    ...overrides,
  };
}

describe("matchesFilter — 상태", () => {
  it("전체 탭은 모든 상태를 통과시킨다", () => {
    for (const status of ["want", "reading", "paused", "finished", "dropped"] as const) {
      expect(matchesFilter(book({ status }), EMPTY_FILTER)).toBe(true);
    }
  });

  it("상태 탭은 그 상태만 남긴다", () => {
    const filter = { ...EMPTY_FILTER, status: "finished" as const };
    expect(matchesFilter(book({ status: "finished" }), filter)).toBe(true);
    expect(matchesFilter(book({ status: "reading" }), filter)).toBe(false);
  });
});

describe("matchesFilter — 분야 · 태그", () => {
  it("분야는 id로 정확히 맞춘다", () => {
    const filter = { ...EMPTY_FILTER, categoryId: "cat-1" };
    expect(matchesFilter(book({ categoryId: "cat-1" }), filter)).toBe(true);
    expect(matchesFilter(book({ categoryId: "cat-2" }), filter)).toBe(false);
    expect(matchesFilter(book({ categoryId: null }), filter)).toBe(false);
  });

  it("태그는 여러 개 중 하나만 맞으면 통과한다", () => {
    const filter = { ...EMPTY_FILTER, tag: "SF" };
    expect(matchesFilter(book({ tags: ["번역서", "SF"] }), filter)).toBe(true);
    expect(matchesFilter(book({ tags: ["번역서"] }), filter)).toBe(false);
  });

  // 태그 판정은 앱 전체가 tagKey() 하나를 쓴다.
  it("태그는 대소문자를 무시하고 맞춘다", () => {
    expect(matchesFilter(book({ tags: ["sf"] }), { ...EMPTY_FILTER, tag: "SF" })).toBe(true);
    expect(matchesFilter(book({ tags: ["SF"] }), { ...EMPTY_FILTER, tag: "#sf" })).toBe(true);
  });
});

describe("matchesFilter — 별점", () => {
  const filter = { ...EMPTY_FILTER, minRating: 4 };

  it("기준 이상은 통과한다", () => {
    expect(matchesFilter(book({ rating: 4 }), filter)).toBe(true);
    expect(matchesFilter(book({ rating: 4.5 }), filter)).toBe(true);
  });

  it("기준 미만은 거른다", () => {
    expect(matchesFilter(book({ rating: 3.5 }), filter)).toBe(false);
  });

  // 별점 없는 책이 "4점 이상"에 섞이면 필터가 거짓말이 된다.
  it("별점이 없으면 거른다", () => {
    expect(matchesFilter(book({ rating: null }), filter)).toBe(false);
  });
});

describe("matchesFilter — 완독 연도", () => {
  it("완독한 해로 거른다", () => {
    const filter = { ...EMPTY_FILTER, year: "2026" };
    expect(matchesFilter(book({ finishedAt: "2026-03-01T00:00:00Z" }), filter)).toBe(true);
    expect(matchesFilter(book({ finishedAt: "2025-12-01T00:00:00Z" }), filter)).toBe(false);
    expect(matchesFilter(book({ finishedAt: null }), filter)).toBe(false);
  });

  // UTC 기준으로 세면 12/31 밤 완독이 다음 해로 잡힌다. 서울 기준이어야 한다.
  it("연말 자정 근처는 서울 기준으로 센다", () => {
    const filter = { ...EMPTY_FILTER, year: "2026" };
    // 2025-12-31T16:00Z = 2026-01-01 01:00 KST
    expect(matchesFilter(book({ finishedAt: "2025-12-31T16:00:00Z" }), filter)).toBe(true);
  });
});

describe("matchesFilter — 키워드", () => {
  const target = book({
    title: "사피엔스",
    subtitle: "유인원에서 사이보그까지",
    authors: ["유발 하라리", "조현욱"],
    publisher: "김영사",
    tags: ["번역서"],
    review: "인상적인 책이었다",
  });

  it.each([
    ["제목", "사피엔"],
    ["부제", "사이보그"],
    ["저자", "하라리"],
    ["출판사", "김영사"],
    ["태그", "번역서"],
  ])("%s로 찾는다", (_label, keyword) => {
    expect(matchesFilter(target, { ...EMPTY_FILTER, keyword })).toBe(true);
  });

  // 흔한 단어 하나에 서재 절반이 걸리면 검색이 쓸모없어진다.
  it("소감으로는 찾지 않는다", () => {
    expect(matchesFilter(target, { ...EMPTY_FILTER, keyword: "인상적인" })).toBe(false);
  });

  it("대소문자와 앞뒤 공백을 무시한다", () => {
    const english = book({ title: "Sapiens" });
    expect(matchesFilter(english, { ...EMPTY_FILTER, keyword: "  sapiens " })).toBe(true);
  });

  it("빈 검색어는 아무것도 거르지 않는다", () => {
    expect(matchesFilter(target, { ...EMPTY_FILTER, keyword: "   " })).toBe(true);
  });

  it("안 맞으면 거른다", () => {
    expect(matchesFilter(target, { ...EMPTY_FILTER, keyword: "코스모스" })).toBe(false);
  });
});

describe("filterBooks — 조건 조합", () => {
  const books = [
    book({ title: "A", status: "finished", categoryId: "c1", tags: ["SF"], rating: 5 }),
    book({ title: "B", status: "finished", categoryId: "c1", tags: ["SF"], rating: 3 }),
    book({ title: "C", status: "reading", categoryId: "c1", tags: ["SF"], rating: 5 }),
    book({ title: "D", status: "finished", categoryId: "c2", tags: ["SF"], rating: 5 }),
    book({ title: "E", status: "finished", categoryId: "c1", tags: ["에세이"], rating: 5 }),
  ];

  it("조건은 AND로 걸린다", () => {
    const result = filterBooks(books, {
      ...EMPTY_FILTER,
      status: "finished",
      categoryId: "c1",
      tag: "SF",
      minRating: 4,
    });
    expect(result.map((b) => b.title)).toEqual(["A"]);
  });

  it("조건 하나를 풀면 결과가 늘어난다", () => {
    const result = filterBooks(books, {
      ...EMPTY_FILTER,
      status: "finished",
      categoryId: "c1",
      tag: "SF",
    });
    expect(result.map((b) => b.title)).toEqual(["A", "B"]);
  });

  it("아무 필터도 없으면 전부 남는다", () => {
    expect(filterBooks(books, EMPTY_FILTER)).toHaveLength(5);
  });

  it("맞는 게 없으면 빈 배열", () => {
    expect(filterBooks(books, { ...EMPTY_FILTER, keyword: "없는책" })).toEqual([]);
  });

  it("원본 배열을 건드리지 않는다", () => {
    const before = books.map((b) => b.title);
    filterBooks(books, { ...EMPTY_FILTER, status: "finished" });
    expect(books.map((b) => b.title)).toEqual(before);
  });
});

describe("sortBooks", () => {
  it("제목순은 한국어 순서를 따른다", () => {
    const books = [book({ title: "하늘" }), book({ title: "가을" }), book({ title: "나무" })];
    expect(sortBooks(books, "title").map((b) => b.title)).toEqual(["가을", "나무", "하늘"]);
  });

  it("최근 업데이트순은 내림차순", () => {
    const books = [
      book({ title: "옛것", updatedAt: "2026-01-01T00:00:00Z" }),
      book({ title: "새것", updatedAt: "2026-07-01T00:00:00Z" }),
    ];
    expect(sortBooks(books, "updated").map((b) => b.title)).toEqual(["새것", "옛것"]);
  });

  it("별점순은 높은 것부터", () => {
    const books = [book({ title: "삼점", rating: 3 }), book({ title: "오점", rating: 5 })];
    expect(sortBooks(books, "rating").map((b) => b.title)).toEqual(["오점", "삼점"]);
  });

  // 값 없는 항목이 위에 오면 정렬한 의미가 없다.
  it("별점 없는 책은 맨 뒤로 간다", () => {
    const books = [
      book({ title: "없음", rating: null }),
      book({ title: "삼점", rating: 3 }),
      book({ title: "오점", rating: 5 }),
    ];
    expect(sortBooks(books, "rating").map((b) => b.title)).toEqual(["오점", "삼점", "없음"]);
  });

  it("완독일순은 최근 완독부터, 미완독은 맨 뒤로", () => {
    const books = [
      book({ title: "미완독", finishedAt: null }),
      book({ title: "3월완독", finishedAt: "2026-03-01T00:00:00Z" }),
      book({ title: "7월완독", finishedAt: "2026-07-01T00:00:00Z" }),
    ];
    expect(sortBooks(books, "finished").map((b) => b.title)).toEqual([
      "7월완독",
      "3월완독",
      "미완독",
    ]);
  });

  it("값이 같으면 최근 업데이트순으로 가른다", () => {
    const books = [
      book({ title: "먼저", rating: 5, updatedAt: "2026-01-01T00:00:00Z" }),
      book({ title: "나중", rating: 5, updatedAt: "2026-07-01T00:00:00Z" }),
    ];
    expect(sortBooks(books, "rating").map((b) => b.title)).toEqual(["나중", "먼저"]);
  });

  it("원본 배열을 건드리지 않는다", () => {
    const books = [book({ title: "하늘" }), book({ title: "가을" })];
    sortBooks(books, "title");
    expect(books.map((b) => b.title)).toEqual(["하늘", "가을"]);
  });
});

describe("선택지 도출", () => {
  const books = [
    book({ status: "finished", finishedAt: "2026-03-01T00:00:00Z", tags: ["SF", "번역서"] }),
    book({ status: "finished", finishedAt: "2025-05-01T00:00:00Z", tags: ["sf"] }),
    book({ status: "reading", tags: [] }),
    book({ status: "reading" }),
    book({ status: "want" }),
  ];

  it("상태별 권수를 센다", () => {
    expect(countByStatus(books)).toEqual({
      all: 5,
      want: 1,
      reading: 2,
      paused: 0,
      finished: 2,
      dropped: 0,
    });
  });

  it("완독 기록이 있는 연도만 최근순으로 뽑는다", () => {
    expect(finishedYears(books)).toEqual(["2026", "2025"]);
  });

  it("쓰이는 태그만 뽑고 표기 흔들림은 하나로 합친다", () => {
    // SF / sf 는 같은 태그다. 먼저 나온 표기(SF)를 남긴다.
    // 순서는 ko-KR 정렬이라 한글이 라틴보다 앞선다 — 한국어 앱에서 의도한 순서다.
    expect(usedTags(books)).toEqual(["번역서", "SF"]);
  });

  it("대소문자만 다른 태그를 두 개로 세지 않는다", () => {
    expect(usedTags(books)).toHaveLength(2);
  });

  it("빈 서재에서도 터지지 않는다", () => {
    expect(countByStatus([]).all).toBe(0);
    expect(finishedYears([])).toEqual([]);
    expect(usedTags([])).toEqual([]);
  });
});

describe("hasActiveFilter", () => {
  it("아무것도 안 걸렸으면 false", () => {
    expect(hasActiveFilter(EMPTY_FILTER)).toBe(false);
  });

  it("공백뿐인 검색어는 걸린 것으로 보지 않는다", () => {
    expect(hasActiveFilter({ ...EMPTY_FILTER, keyword: "   " })).toBe(false);
  });

  it.each([
    ["상태", { status: "finished" as const }],
    ["분야", { categoryId: "c1" }],
    ["태그", { tag: "SF" }],
    ["별점", { minRating: 4 }],
    ["연도", { year: "2026" }],
    ["검색어", { keyword: "사피엔스" }],
  ])("%s가 걸리면 true", (_label, patch) => {
    expect(hasActiveFilter({ ...EMPTY_FILTER, ...patch })).toBe(true);
  });
});

describe("타입 가드", () => {
  it("상태 탭", () => {
    expect(isStatusTab("all")).toBe(true);
    expect(isStatusTab("finished")).toBe(true);
    expect(isStatusTab("없는탭")).toBe(false);
    expect(isStatusTab(null)).toBe(false);
  });

  it("정렬 키", () => {
    expect(isSortKey("rating")).toBe(true);
    expect(isSortKey("없는정렬")).toBe(false);
  });
});
