/**
 * 로그인 후 돌아갈 경로를 안전하게 다듬는다.
 *
 * `?next=` 값은 사용자가 URL로 넘기는 문자열이므로 그대로 리다이렉트하면
 * 오픈 리다이렉트가 된다(피싱 사이트로 튕겨보내는 링크를 만들 수 있다).
 * 같은 출처의 절대 경로만 허용하고 나머지는 홈으로 되돌린다.
 */

/** 개행·탭 등 제어 문자. 리다이렉트 헤더에 그대로 실리면 안 된다. */
function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function sanitizeNextPath(raw: string | null | undefined): string {
  const fallback = "/";

  if (!raw) return fallback;

  // "/" 로 시작하지 않으면 외부 URL이거나 상대 경로다.
  if (!raw.startsWith("/")) return fallback;

  // "//evil.com" 은 프로토콜 상대 URL이라 외부로 나간다.
  // 백슬래시는 브라우저가 "/" 로 해석하는 경우가 있어 함께 막는다.
  if (raw.startsWith("//") || raw.includes("\\")) return fallback;

  if (hasControlChar(raw)) return fallback;

  // 로그인 페이지로 되돌리면 순환한다.
  if (raw === "/login" || raw.startsWith("/login?")) return fallback;

  return raw;
}
