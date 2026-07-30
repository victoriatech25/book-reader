import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

import { supabaseEnv } from "./env";

/**
 * 요청마다 액세스 토큰을 갱신하고 갱신된 쿠키를 응답에 실어 보낸다.
 *
 * 서버 컴포넌트는 쿠키를 쓸 수 없으므로 세션 갱신을 할 수 있는 곳은 프록시뿐이다.
 * 여기서 getUser()를 호출하지 않으면 토큰이 만료된 뒤 사용자가 조용히 로그아웃된다.
 *
 * 파일명이 middleware인 것은 Supabase 공식 예제와 맞추기 위해서다. Next 16에서
 * 라우트 규약 파일만 proxy.ts로 바뀌었을 뿐 이 모듈은 일반 lib 파일이다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getSession()이 아니라 getUser()를 쓴다. getSession()은 쿠키를 그대로 믿지만
  // getUser()는 Auth 서버에 검증을 요청한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

/** 리다이렉트할 때도 갱신된 세션 쿠키를 잃지 않도록 옮겨 담는다. */
export function withCookiesFrom(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}
