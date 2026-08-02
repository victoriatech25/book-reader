/**
 * 테마 선택 (PRD §3.1 F12 — OS 테마 연동).
 *
 * 선택지는 넷이다. "시스템"이 기본이고, 그때만 OS 설정을 따라간다(라이트 또는
 * 다크). 나머지는 직접 고른 값으로 고정된다 — 낮에도 다크로 읽고 싶은 사람이
 * OS를 바꿀 이유는 없다.
 *
 * "세피아"는 OS에 대응하는 짝이 없다. 밝지도 어둡지도 않은 미색 종이톤이라
 * 시스템 설정으로는 도달할 수 없고, 사용자가 직접 골라야만 켜진다.
 *
 * 저장 방식: localStorage의 "theme" 키. 시스템은 **키를 지우는 것**으로
 * 표현한다. "system"이라는 값을 넣어두면 layout.tsx의 첫 페인트 스크립트가
 * 그 값을 클래스 이름으로 쓰지 않도록 한 번 더 걸러야 한다.
 */

export const THEME_CHOICES = ["system", "light", "dark", "sepia"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** 실제로 화면에 적용되는 값. "시스템"은 여기 없다 — 셋 중 하나로 풀린다. */
export type ResolvedTheme = "light" | "dark" | "sepia";

export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "시스템 설정",
  light: "라이트",
  dark: "다크",
  sepia: "세피아",
};

export const STORAGE_KEY = "theme";

/**
 * html에 붙일 클래스 이름.
 *
 * 세피아만 접두사가 붙는다. Tailwind에 `.sepia`(필터) 유틸리티가 있어서, 같은
 * 이름을 html에 붙이면 화면 전체에 sepia() 필터가 걸린다. 이름이 겹치지 않게
 * 피한다.
 */
export const THEME_CLASS = {
  light: "light",
  dark: "dark",
  sepia: "theme-sepia",
} as const satisfies Record<ResolvedTheme, string>;

/** 테마를 갈아끼울 때 먼저 지워야 하는 클래스 전부. */
export const THEME_CLASSES = Object.values(THEME_CLASS);

/** 선택에 해당하는 클래스. 시스템은 null — 아무것도 붙이지 않는다. */
export function themeClassFor(choice: ThemeChoice): string | null {
  return choice === "system" ? null : THEME_CLASS[choice];
}

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
  return raw === "light" || raw === "dark" || raw === "sepia" ? raw : "system";
}

/** 선택과 OS 설정으로 실제 적용할 테마를 정한다. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice !== "system") return choice;
  return prefersDark ? "dark" : "light";
}

/** 선택을 저장할 때 localStorage에 넣을 값. null이면 키를 지운다. */
export function storageValueFor(choice: ThemeChoice): string | null {
  return choice === "system" ? null : choice;
}
