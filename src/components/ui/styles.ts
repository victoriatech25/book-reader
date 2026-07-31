/**
 * 화면이 공유하는 클래스 문자열.
 *
 * 같은 입력·버튼 스타일이 파일마다 복사돼 있어서 한 곳만 고치면 화면끼리
 * 어긋났다. 여기 모아두고, 값은 전부 globals.css의 시맨틱 토큰을 참조한다.
 * 팔레트 이름(zinc-500 같은 것)을 화면 코드에 다시 쓰지 않는다 — 그러면
 * 디자인 컨셉을 바꿀 때 또 전 화면을 뒤져야 한다.
 */

/** 페이지 바깥 틀. 본문 폭은 화면마다 다르므로 여기 넣지 않는다. */
export const pageShell = "flex flex-1 justify-center bg-background px-6 py-12";

export const card = "rounded-lg border border-border bg-card p-4";

/**
 * 폭은 넣지 않는다. 호출부가 w-full / w-24 를 붙인다 — 여기에 w-full을 박으면
 * 좁게 쓰려는 곳(인용 위치, 진행 값)에서 덮어쓰기 싸움이 난다.
 */
export const input =
  "rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 outline-none transition-colors " +
  "focus:border-ring focus:ring-2 focus:ring-ring/25";

export const label = "block text-sm font-medium text-foreground";

export const hint = "mt-1 text-xs text-muted-foreground";

export const buttonPrimary =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground " +
  "transition-opacity hover:opacity-90 disabled:opacity-60";

export const buttonSecondary =
  "rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground " +
  "transition-colors hover:bg-accent disabled:opacity-60";

/** 본문 흐름을 끊지 않는 보조 링크·버튼. */
export const quietLink =
  "text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground";

export const dangerLink =
  "text-sm text-destructive underline underline-offset-4 transition-opacity hover:opacity-80";

export const errorText = "text-sm text-destructive";

/** 진행률·페이지·날짜처럼 자리가 흔들리면 안 되는 숫자. */
export const numeric = "font-mono text-xs text-muted-foreground";
