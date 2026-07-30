/**
 * Supabase 공개 환경변수. 없으면 즉시 죽는다 — 런타임에 조용히 401이 나는 것보다
 * 부팅 시점에 실패하는 편이 원인을 찾기 쉽다.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase 환경변수가 없습니다. .env.local 에 NEXT_PUBLIC_SUPABASE_URL 과 " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY 를 채우세요.",
    );
  }

  return { url, publishableKey };
}
