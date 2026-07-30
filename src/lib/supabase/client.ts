import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

import { supabaseEnv } from "./env";

/**
 * 브라우저용 Supabase 클라이언트.
 *
 * @supabase/ssr 의 브라우저 클라이언트는 세션과 PKCE code_verifier를 쿠키에
 * 저장한다. 그래서 매직링크로 돌아왔을 때 서버 라우트가 같은 쿠키를 읽어
 * 코드를 세션으로 교환할 수 있다.
 */
export function createBrowserSupabaseClient() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
