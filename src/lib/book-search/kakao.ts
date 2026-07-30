/**
 * 카카오 책 검색 API 연동.
 *
 * 이 파일은 순수 파싱/정규화와 fetch 호출만 담당한다. HTTP 응답 형태를 만드는
 * 책임은 라우트 핸들러(src/app/api/book-search/route.ts)에 둔다.
 *
 * 키(KAKAO_REST_API_KEY)는 서버에서만 읽는다. NEXT_PUBLIC_ 접두어가 없으므로
 * 클라이언트 번들에 들어가지 않는다.
 */

import { z } from "zod";

const KAKAO_ENDPOINT = "https://dapi.kakao.com/v3/search/book";
const UPSTREAM_TIMEOUT_MS = 8_000;
const CACHE_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// 요청 파라미터
// ---------------------------------------------------------------------------
// 이 메시지들은 그대로 사용자 화면에 뜬다. zod 기본 메시지(영어)가 새어나가지
// 않도록 모든 제약에 문구를 붙인다.
export const bookSearchParamsSchema = z.object({
  q: z.string().trim().min(1, "검색어를 입력하세요.").max(100, "검색어가 너무 깁니다."),
  page: z.coerce
    .number({ message: "페이지 번호가 올바르지 않습니다." })
    .int("페이지 번호는 정수여야 합니다.")
    .min(1, "페이지 번호는 1 이상이어야 합니다.")
    .max(50, "페이지는 50까지만 조회할 수 있습니다.")
    .default(1),
  size: z.coerce
    .number({ message: "요청 건수가 올바르지 않습니다." })
    .int("요청 건수는 정수여야 합니다.")
    .min(1, "요청 건수는 1 이상이어야 합니다.")
    .max(50, "한 번에 최대 50건까지 가져올 수 있습니다.")
    .default(10),
  /** 지정하지 않으면 통합 검색. title=제목, person=인물, publisher=출판사, isbn=ISBN */
  target: z
    .enum(["title", "isbn", "publisher", "person"], {
      message: "검색 대상은 제목·인물·출판사·ISBN 중 하나여야 합니다.",
    })
    .optional(),
});

export type BookSearchParams = z.infer<typeof bookSearchParamsSchema>;

// ---------------------------------------------------------------------------
// 에러
// ---------------------------------------------------------------------------
export type BookSearchErrorCode =
  /** 서버에 KAKAO_REST_API_KEY가 없다. 사용자가 아니라 배포 설정의 문제다. */
  | "MISCONFIGURED"
  /** 카카오가 요청을 거부했다(검색어 형식 등). */
  | "INVALID_QUERY"
  /** 키가 거부됐다. 사용자에게는 일시 장애로 보이되 로그로 구분한다. */
  | "UPSTREAM_UNAUTHORIZED"
  /** 일일 쿼터 초과. */
  | "QUOTA_EXCEEDED"
  /** 카카오 장애·타임아웃·네트워크 오류. */
  | "UPSTREAM_UNAVAILABLE"
  /** 응답이 왔지만 우리가 아는 형태가 아니다(스펙 변경 신호). */
  | "UPSTREAM_MALFORMED";

export class BookSearchError extends Error {
  readonly code: BookSearchErrorCode;
  /** 우리 API가 클라이언트에 돌려줄 HTTP 상태 */
  readonly status: number;

  constructor(code: BookSearchErrorCode, message: string, status: number) {
    super(message);
    this.name = "BookSearchError";
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// 카카오 응답 스키마 — 쓰는 필드만 정의하고 나머지는 무시한다.
// 모든 필드에 default를 둬서 일부 누락으로 전체 검색이 죽지 않게 한다.
// ---------------------------------------------------------------------------
const kakaoDocumentSchema = z.object({
  title: z.string().default(""),
  contents: z.string().default(""),
  url: z.string().default(""),
  isbn: z.string().default(""),
  datetime: z.string().default(""),
  authors: z.array(z.string()).default([]),
  publisher: z.string().default(""),
  translators: z.array(z.string()).default([]),
  thumbnail: z.string().default(""),
  status: z.string().default(""),
});

const kakaoResponseSchema = z.object({
  documents: z.array(kakaoDocumentSchema),
  meta: z
    .object({
      total_count: z.number().default(0),
      pageable_count: z.number().default(0),
      is_end: z.boolean().default(true),
    })
    .default({ total_count: 0, pageable_count: 0, is_end: true }),
});

export type KakaoDocument = z.infer<typeof kakaoDocumentSchema>;

// ---------------------------------------------------------------------------
// 우리 도메인 형태
// ---------------------------------------------------------------------------
export type BookSearchItem = {
  title: string;
  authors: string[];
  translators: string[];
  publisher: string | null;
  /** YYYY-MM-DD */
  publishedOn: string | null;
  isbn13: string | null;
  isbn10: string | null;
  coverUrl: string | null;
  description: string | null;
  /**
   * 카카오는 페이지수를 제공하지 않는다. 항상 null이며 사용자가 직접 입력한다.
   * PRD §6.1 — 페이지 단위로 진행률을 기록할 때만 필요한 값이다.
   */
  totalPages: null;
  source: "kakao";
  /** books.source_ref에 그대로 저장할 원본 요약 */
  sourceRef: {
    provider: "kakao";
    isbn: string;
    url: string;
    status: string;
  };
};

export type BookSearchResult = {
  items: BookSearchItem[];
  meta: {
    totalCount: number;
    pageableCount: number;
    isEnd: boolean;
  };
};

// ---------------------------------------------------------------------------
// 파싱 헬퍼 (순수 함수 — 단위 테스트 대상)
// ---------------------------------------------------------------------------

/**
 * 카카오의 isbn 필드는 ISBN10과 ISBN13이 공백으로 붙어 오거나, 둘 중 하나만
 * 오거나, 비어 있을 수 있다. 예: "8983711892 9788983711892"
 */
export function parseIsbn(raw: string): { isbn10: string | null; isbn13: string | null } {
  let isbn10: string | null = null;
  let isbn13: string | null = null;

  for (const token of raw.split(/\s+/)) {
    const value = token.replace(/-/g, "");
    if (isbn13 === null && /^\d{13}$/.test(value)) {
      isbn13 = value;
    } else if (isbn10 === null && /^\d{9}[\dXx]$/.test(value)) {
      isbn10 = value.toUpperCase();
    }
  }

  return { isbn10, isbn13 };
}

/**
 * 카카오 datetime("2019-03-20T00:00:00.000+09:00")에서 날짜만 뽑는다.
 * 오프셋이 +09:00이라 앞 10자가 곧 한국 기준 출간일이다.
 */
export function toPublishedOn(datetime: string): string | null {
  const match = datetime.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeKakaoDocument(doc: KakaoDocument): BookSearchItem {
  const { isbn10, isbn13 } = parseIsbn(doc.isbn);

  return {
    title: doc.title.trim(),
    authors: doc.authors.filter((a) => a.trim().length > 0),
    translators: doc.translators.filter((t) => t.trim().length > 0),
    publisher: emptyToNull(doc.publisher),
    publishedOn: toPublishedOn(doc.datetime),
    isbn13,
    isbn10,
    coverUrl: emptyToNull(doc.thumbnail),
    description: emptyToNull(doc.contents),
    totalPages: null,
    source: "kakao",
    sourceRef: {
      provider: "kakao",
      isbn: doc.isbn,
      url: doc.url,
      status: doc.status,
    },
  };
}

/** 카카오 응답 JSON을 우리 형태로 바꾼다. 형태가 다르면 UPSTREAM_MALFORMED. */
export function parseKakaoResponse(json: unknown): BookSearchResult {
  const parsed = kakaoResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new BookSearchError("UPSTREAM_MALFORMED", "카카오 응답 형식이 예상과 다릅니다.", 502);
  }

  return {
    items: parsed.data.documents.map(normalizeKakaoDocument),
    meta: {
      totalCount: parsed.data.meta.total_count,
      pageableCount: parsed.data.meta.pageable_count,
      isEnd: parsed.data.meta.is_end,
    },
  };
}

/** 카카오 HTTP 상태를 우리 에러로 옮긴다. */
export function toBookSearchError(status: number): BookSearchError {
  switch (status) {
    case 400:
      return new BookSearchError("INVALID_QUERY", "검색 요청이 거부되었습니다.", 400);
    case 401:
    case 403:
      return new BookSearchError(
        "UPSTREAM_UNAUTHORIZED",
        "도서 검색 서비스 인증에 실패했습니다.",
        502,
      );
    case 429:
      return new BookSearchError(
        "QUOTA_EXCEEDED",
        "도서 검색 사용량을 초과했습니다. 잠시 후 다시 시도하거나 직접 입력해주세요.",
        429,
      );
    default:
      return new BookSearchError(
        "UPSTREAM_UNAVAILABLE",
        "도서 검색 서비스가 일시적으로 불안정합니다. 직접 입력할 수 있습니다.",
        502,
      );
  }
}

// ---------------------------------------------------------------------------
// 호출
// ---------------------------------------------------------------------------
export function buildKakaoUrl(params: BookSearchParams): string {
  const url = new URL(KAKAO_ENDPOINT);
  url.searchParams.set("query", params.q);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("size", String(params.size));
  if (params.target) url.searchParams.set("target", params.target);
  return url.toString();
}

export async function searchKakaoBooks(params: BookSearchParams): Promise<BookSearchResult> {
  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!apiKey) {
    throw new BookSearchError(
      "MISCONFIGURED",
      "도서 검색이 설정되지 않았습니다. 직접 입력할 수 있습니다.",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetch(buildKakaoUrl(params), {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      // 같은 검색어를 반복해도 카카오 쿼터를 다시 쓰지 않는다.
      next: { revalidate: CACHE_SECONDS },
    });
  } catch {
    throw new BookSearchError(
      "UPSTREAM_UNAVAILABLE",
      "도서 검색 서비스에 연결하지 못했습니다. 직접 입력할 수 있습니다.",
      502,
    );
  }

  if (!response.ok) {
    throw toBookSearchError(response.status);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new BookSearchError("UPSTREAM_MALFORMED", "카카오 응답을 해석할 수 없습니다.", 502);
  }

  return parseKakaoResponse(json);
}
