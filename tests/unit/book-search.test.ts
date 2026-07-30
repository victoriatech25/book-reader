import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BookSearchError,
  bookSearchParamsSchema,
  buildKakaoUrl,
  normalizeKakaoDocument,
  parseIsbn,
  parseKakaoResponse,
  searchKakaoBooks,
  toBookSearchError,
  toPublishedOn,
  type KakaoDocument,
} from "@/lib/book-search/kakao";

// 실제 카카오 응답 형태를 본뜬 픽스처
const sampleDocument: KakaoDocument = {
  title: "사피엔스",
  contents: "인류의 역사를 다룬 책",
  url: "https://search.daum.net/search?q=사피엔스",
  isbn: "8934972467 9788934972464",
  datetime: "2015-11-24T00:00:00.000+09:00",
  authors: ["유발 하라리"],
  publisher: "김영사",
  translators: ["조현욱"],
  thumbnail: "https://search1.kakaocdn.net/thumb/cover.jpg",
  status: "정상판매",
};

const sampleResponse = {
  documents: [sampleDocument],
  meta: { total_count: 137, pageable_count: 137, is_end: false },
};

describe("parseIsbn", () => {
  it("ISBN10과 ISBN13이 공백으로 붙어 오면 둘 다 뽑는다", () => {
    expect(parseIsbn("8934972467 9788934972464")).toEqual({
      isbn10: "8934972467",
      isbn13: "9788934972464",
    });
  });

  it("ISBN13만 있어도 처리한다", () => {
    expect(parseIsbn("9788934972464")).toEqual({ isbn10: null, isbn13: "9788934972464" });
  });

  it("ISBN10의 체크 문자 X를 허용하고 대문자로 정규화한다", () => {
    expect(parseIsbn("089580045x")).toEqual({ isbn10: "089580045X", isbn13: null });
  });

  it("하이픈이 섞여 있어도 제거하고 인식한다", () => {
    expect(parseIsbn("978-89-349-7246-4")).toEqual({ isbn10: null, isbn13: "9788934972464" });
  });

  it("빈 문자열이면 둘 다 null", () => {
    expect(parseIsbn("")).toEqual({ isbn10: null, isbn13: null });
  });

  it("자릿수가 맞지 않는 값은 무시한다", () => {
    expect(parseIsbn("12345")).toEqual({ isbn10: null, isbn13: null });
  });
});

describe("toPublishedOn", () => {
  it("datetime에서 날짜만 뽑는다", () => {
    expect(toPublishedOn("2015-11-24T00:00:00.000+09:00")).toBe("2015-11-24");
  });

  it("빈 값이면 null", () => {
    expect(toPublishedOn("")).toBeNull();
  });

  it("형식이 다르면 null", () => {
    expect(toPublishedOn("2015년 11월")).toBeNull();
  });
});

describe("normalizeKakaoDocument", () => {
  it("카카오 문서를 도메인 형태로 옮긴다", () => {
    const item = normalizeKakaoDocument(sampleDocument);

    expect(item).toMatchObject({
      title: "사피엔스",
      authors: ["유발 하라리"],
      translators: ["조현욱"],
      publisher: "김영사",
      publishedOn: "2015-11-24",
      isbn13: "9788934972464",
      isbn10: "8934972467",
      source: "kakao",
    });
  });

  it("페이지수는 항상 null이다 — 카카오가 제공하지 않는다", () => {
    expect(normalizeKakaoDocument(sampleDocument).totalPages).toBeNull();
  });

  it("표지가 빈 문자열이면 null로 바꾼다", () => {
    const item = normalizeKakaoDocument({ ...sampleDocument, thumbnail: "" });
    expect(item.coverUrl).toBeNull();
  });

  it("공백뿐인 저자 항목은 걸러낸다", () => {
    const item = normalizeKakaoDocument({ ...sampleDocument, authors: ["유발 하라리", "  "] });
    expect(item.authors).toEqual(["유발 하라리"]);
  });

  it("source_ref에 원본 식별 정보를 남긴다", () => {
    const item = normalizeKakaoDocument(sampleDocument);
    expect(item.sourceRef).toEqual({
      provider: "kakao",
      isbn: "8934972467 9788934972464",
      url: sampleDocument.url,
      status: "정상판매",
    });
  });
});

describe("parseKakaoResponse", () => {
  it("정상 응답을 items/meta로 변환한다", () => {
    const result = parseKakaoResponse(sampleResponse);

    expect(result.items).toHaveLength(1);
    expect(result.meta).toEqual({ totalCount: 137, pageableCount: 137, isEnd: false });
  });

  it("필드가 일부 빠져도 기본값으로 버틴다", () => {
    const result = parseKakaoResponse({
      documents: [{ title: "제목만 있는 책" }],
      meta: { total_count: 1, pageable_count: 1, is_end: true },
    });

    expect(result.items[0]).toMatchObject({
      title: "제목만 있는 책",
      authors: [],
      publisher: null,
      isbn13: null,
      coverUrl: null,
    });
  });

  it("documents가 없으면 UPSTREAM_MALFORMED", () => {
    expect(() => parseKakaoResponse({ meta: {} })).toThrowError(
      expect.objectContaining({ code: "UPSTREAM_MALFORMED" }),
    );
  });

  it("응답이 배열이면 UPSTREAM_MALFORMED", () => {
    expect(() => parseKakaoResponse([])).toThrowError(
      expect.objectContaining({ code: "UPSTREAM_MALFORMED" }),
    );
  });
});

describe("bookSearchParamsSchema", () => {
  it("page/size 기본값을 채운다", () => {
    const parsed = bookSearchParamsSchema.parse({ q: "사피엔스" });
    expect(parsed).toEqual({ q: "사피엔스", page: 1, size: 10 });
  });

  it("쿼리스트링의 문자열 숫자를 숫자로 강제한다", () => {
    const parsed = bookSearchParamsSchema.parse({ q: "사피엔스", page: "3", size: "20" });
    expect(parsed.page).toBe(3);
    expect(parsed.size).toBe(20);
  });

  it("검색어가 비어 있으면 거부한다", () => {
    expect(bookSearchParamsSchema.safeParse({ q: "   " }).success).toBe(false);
  });

  it("카카오 상한(50)을 넘는 size는 거부한다", () => {
    expect(bookSearchParamsSchema.safeParse({ q: "사피엔스", size: 51 }).success).toBe(false);
  });

  it("알 수 없는 target은 거부한다", () => {
    expect(bookSearchParamsSchema.safeParse({ q: "사피엔스", target: "author" }).success).toBe(
      false,
    );
  });

  // 이 메시지는 그대로 사용자에게 노출된다. zod 기본 영어 메시지가 새면 안 된다.
  it.each([
    [{ q: "" }, "검색어를 입력하세요."],
    [{ q: "사피엔스", size: 99 }, "한 번에 최대 50건까지 가져올 수 있습니다."],
    [{ q: "사피엔스", size: "abc" }, "요청 건수가 올바르지 않습니다."],
    [{ q: "사피엔스", page: 0 }, "페이지 번호는 1 이상이어야 합니다."],
    [{ q: "사피엔스", target: "author" }, "검색 대상은 제목·인물·출판사·ISBN 중 하나여야 합니다."],
  ])("%o → 한국어 메시지를 돌려준다", (input, message) => {
    const result = bookSearchParamsSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("buildKakaoUrl", () => {
  it("파라미터를 쿼리스트링으로 옮긴다", () => {
    const url = new URL(buildKakaoUrl({ q: "사피엔스", page: 2, size: 20, target: "title" }));

    expect(url.origin + url.pathname).toBe("https://dapi.kakao.com/v3/search/book");
    expect(url.searchParams.get("query")).toBe("사피엔스");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("size")).toBe("20");
    expect(url.searchParams.get("target")).toBe("title");
  });

  it("target이 없으면 붙이지 않는다(통합 검색)", () => {
    const url = new URL(buildKakaoUrl({ q: "사피엔스", page: 1, size: 10 }));
    expect(url.searchParams.has("target")).toBe(false);
  });
});

describe("toBookSearchError", () => {
  it.each([
    [400, "INVALID_QUERY", 400],
    [401, "UPSTREAM_UNAUTHORIZED", 502],
    [403, "UPSTREAM_UNAUTHORIZED", 502],
    [429, "QUOTA_EXCEEDED", 429],
    [500, "UPSTREAM_UNAVAILABLE", 502],
    [503, "UPSTREAM_UNAVAILABLE", 502],
  ])("카카오 %i → %s (우리 상태 %i)", (upstream, code, status) => {
    const error = toBookSearchError(upstream);
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
  });
});

describe("searchKakaoBooks", () => {
  const params = { q: "사피엔스", page: 1, size: 10 } as const;

  beforeEach(() => {
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("키가 없으면 호출하지 않고 MISCONFIGURED", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchKakaoBooks(params)).rejects.toThrowError(
      expect.objectContaining({ code: "MISCONFIGURED" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("성공하면 정규화된 결과를 돌려주고 키를 헤더로 보낸다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleResponse,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchKakaoBooks(params);

    expect(result.items[0].title).toBe("사피엔스");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("KakaoAK test-key");
  });

  it("429면 QUOTA_EXCEEDED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(searchKakaoBooks(params)).rejects.toThrowError(
      expect.objectContaining({ code: "QUOTA_EXCEEDED", status: 429 }),
    );
  });

  it("401이면 UPSTREAM_UNAUTHORIZED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    await expect(searchKakaoBooks(params)).rejects.toThrowError(
      expect.objectContaining({ code: "UPSTREAM_UNAUTHORIZED" }),
    );
  });

  it("네트워크 오류·타임아웃이면 UPSTREAM_UNAVAILABLE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(searchKakaoBooks(params)).rejects.toThrowError(
      expect.objectContaining({ code: "UPSTREAM_UNAVAILABLE" }),
    );
  });

  it("본문이 JSON이 아니면 UPSTREAM_MALFORMED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("invalid json");
        },
      }),
    );

    await expect(searchKakaoBooks(params)).rejects.toThrowError(
      expect.objectContaining({ code: "UPSTREAM_MALFORMED" }),
    );
  });

  it("던지는 값은 BookSearchError 인스턴스다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(searchKakaoBooks(params)).rejects.toBeInstanceOf(BookSearchError);
  });
});
