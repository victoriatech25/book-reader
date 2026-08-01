import { NextResponse, type NextRequest } from "next/server";

import { updateSession, withCookiesFrom } from "@/lib/supabase/middleware";

/** 로그인 없이 접근할 수 있는 경로 */
const PUBLIC_PATHS = [
  "/login",
  "/auth/confirm",
  // 오프라인 안내는 세션을 확인할 수 없을 때 보여주는 화면이다.
  "/offline",
  /*
   * PWA 자산 (W13).
   *
   * 브라우저는 이것들을 로그인 상태와 무관하게 가져간다. 보호 라우트로 두면
   * 로그인 페이지 HTML이 돌아와서 서비스워커 등록이 통째로 실패하고, 설치
   * 배너도 안 뜬다.
   *
   * 셋 다 사용자 데이터를 담지 않는다 — 매니페스트는 앱 이름과 색, 아이콘은
   * 코드로 그린 그림, sw.js는 캐시 규칙이다.
   */
  "/manifest.webmanifest",
  "/icons",
  "/sw.js",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) {
    // 이미 로그인한 사용자가 로그인 페이지에 오면 홈으로 보낸다.
    if (user && pathname === "/login") {
      const home = request.nextUrl.clone();
      home.pathname = "/";
      home.search = "";
      return withCookiesFrom(NextResponse.redirect(home), response);
    }
    return response;
  }

  if (!user) {
    // API는 리다이렉트 대신 401을 준다. fetch 호출자가 로그인 HTML을
    // 성공 응답으로 오해하면 안 된다.
    if (pathname.startsWith("/api/")) {
      return withCookiesFrom(
        NextResponse.json(
          { error: { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." } },
          { status: 401 },
        ),
        response,
      );
    }

    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", `${pathname}${search}`);
    return withCookiesFrom(NextResponse.redirect(login), response);
  }

  return response;
}

export const config = {
  // 정적 자산과 이미지 최적화 경로는 세션 갱신이 필요 없다.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
