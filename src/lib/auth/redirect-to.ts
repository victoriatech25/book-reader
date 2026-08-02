/**
 * 로그인 뒤 돌아올 주소.
 *
 * 매직링크와 Google 로그인이 같은 지점(`/auth/confirm`)으로 돌아온다. 그
 * 라우트가 `?code=`(PKCE)와 `?token_hash=`(이메일 템플릿)를 모두 받으므로
 * 두 방식이 콜백을 나눠 가질 이유가 없다.
 *
 * 문자열을 이어붙이지 않고 URL로 만든다. next에 쿼리나 한글이 섞여도
 * 인코딩이 어긋나지 않는다.
 *
 * 주의: 여기서 만든 주소는 Supabase의 Redirect URL 허용 목록에 있어야 한다.
 * 없으면 오류 없이 Site URL로 갈아끼워져서, 로그인은 되는데 엉뚱한 도메인에
 * 세션이 생긴다 — 배포 도메인이 바뀌면 목록부터 확인한다.
 */
export function authRedirectTo(origin: string, next: string): string {
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("next", next);
  return url.toString();
}
