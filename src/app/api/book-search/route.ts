import { NextResponse } from "next/server";

import { BookSearchError, bookSearchParamsSchema, searchKakaoBooks } from "@/lib/book-search/kakao";

/**
 * GET /api/book-search?q=...&page=1&size=10&target=title
 *
 * 카카오 책 검색 프록시. 키를 서버에 두기 위한 경유지이며 로직은 lib에 있다.
 *
 * 검색이 실패해도 등록 자체가 막히면 안 되므로(PRD §6.3) 모든 에러를
 * { error: { code, message } } 형태로 돌려주고, 클라이언트는 code를 보고
 * 수동 입력 폼으로 전환한다.
 *
 * TODO(W3): 세션 가드를 추가한다. 지금은 인증 계층이 없어 누구나 호출할 수
 * 있고 그만큼 카카오 쿼터가 노출된다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = bookSearchParamsSchema.safeParse({
    q: searchParams.get("q") ?? "",
    page: searchParams.get("page") ?? undefined,
    size: searchParams.get("size") ?? undefined,
    target: searchParams.get("target") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_QUERY",
          message: parsed.error.issues[0]?.message ?? "검색 요청이 올바르지 않습니다.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await searchKakaoBooks(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BookSearchError) {
      // 원인 구분은 서버 로그에만 남기고, 사용자에게는 code로 전달한다.
      console.error(`[book-search] ${error.code}: ${error.message}`);
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    throw error;
  }
}
