import { NextResponse, type NextRequest } from "next/server";

import { updateSession, withCookiesFrom } from "@/lib/supabase/middleware";

/** 로그인 없이 접근할 수 있는 경로 */
const PUBLIC_PATHS = ["/login", "/auth/confirm"];

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
