import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

import { supabaseEnv } from "./env";

/**
 * 서버 컴포넌트 · 서버 액션 · 라우트 핸들러용 Supabase 클라이언트.
 *
 * 요청마다 새로 만든다. 모듈 스코프에 캐시해두면 다른 사용자의 세션이 섞인다.
 */
export async function createServerSupabaseClient() {
  const { url, publishableKey } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 미들웨어가
          // 담당하므로 여기서는 무시해도 된다.
        }
      },
    },
  });
}

/** 로그인한 사용자. 미들웨어가 보호하지만 페이지에서도 직접 확인한다. */
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
