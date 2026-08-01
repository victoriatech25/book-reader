/**
 * 테마 선택 (PRD §3.1 F12 — OS 테마 연동).
 *
 * 선택지는 셋이다. "시스템"이 기본이고, 그때만 OS 설정을 따라간다.
 * 라이트/다크를 직접 고르면 OS와 무관하게 그 값으로 고정된다 — 낮에도 다크로
 * 읽고 싶은 사람이 OS를 바꿀 이유는 없다.
 *
 * 저장 방식: localStorage의 "theme" 키. 시스템은 **키를 지우는 것**으로
 * 표현한다. "system"이라는 값을 넣어두면 layout.tsx의 첫 페인트 스크립트가
 * 그 값을 클래스 이름으로 쓰지 않도록 한 번 더 걸러야 한다.
 */

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** 실제로 화면에 적용되는 값. "시스템"은 여기 없다 — 둘 중 하나로 풀린다. */
export type ResolvedTheme = "light" | "dark";

export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "시스템 설정",
  light: "라이트",
  dark: "다크",
};

export const STORAGE_KEY = "theme";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

/**
 * localStorage에서 읽은 원본 값을 선택지로 바꾼다.
 *
 * 키가 없거나(=시스템), 다른 탭에서 이상한 값이 들어갔거나, 예전 버전이 쓴
 * 값이 남아 있어도 시스템으로 떨어뜨린다. 화면이 깨지는 것보다 낫다.
 */
export function readThemeChoice(raw: string | null | undefined): ThemeChoice {
  return raw === "light" || raw === "dark" ? raw : "system";
}

/** 선택과 OS 설정으로 실제 적용할 테마를 정한다. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice === "light" || choice === "dark") return choice;
  return prefersDark ? "dark" : "light";
}

/** 선택을 저장할 때 localStorage에 넣을 값. null이면 키를 지운다. */
export function storageValueFor(choice: ThemeChoice): string | null {
  return choice === "system" ? null : choice;
}
