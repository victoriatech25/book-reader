import { describe, expect, it } from "vitest";

import {
  isThemeChoice,
  readThemeChoice,
  resolveTheme,
  storageValueFor,
  THEME_CHOICES,
  THEME_CLASSES,
  THEME_LABEL,
  themeClassFor,
} from "@/lib/theme";

describe("readThemeChoice", () => {
  it("저장된 값이 그대로 선택이 된다", () => {
    expect(readThemeChoice("light")).toBe("light");
    expect(readThemeChoice("dark")).toBe("dark");
    expect(readThemeChoice("sepia")).toBe("sepia");
  });

  // 키가 없다 = 시스템을 따른다. "system"이라는 값을 저장하지 않는 이유다.
  it("키가 없으면 시스템", () => {
    expect(readThemeChoice(null)).toBe("system");
    expect(readThemeChoice(undefined)).toBe("system");
  });

  it("이상한 값이 들어가 있어도 시스템으로 떨어뜨린다", () => {
    expect(readThemeChoice("")).toBe("system");
    expect(readThemeChoice("solarized")).toBe("system");
    expect(readThemeChoice("Dark")).toBe("system");
    // 클래스 이름이지 저장값이 아니다.
    expect(readThemeChoice("theme-sepia")).toBe("system");
    // 예전 버전이 "system"을 저장했더라도 클래스 이름으로 쓰이면 안 된다.
    expect(readThemeChoice("system")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("직접 고른 값은 OS와 무관하게 고정된다", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  // 세피아는 OS에 짝이 없다. 어느 쪽이든 세피아 그대로 남아야 한다.
  it("세피아는 OS 설정에 흔들리지 않는다", () => {
    expect(resolveTheme("sepia", true)).toBe("sepia");
    expect(resolveTheme("sepia", false)).toBe("sepia");
  });

  it("시스템일 때만 OS 설정을 따른다 — 그때는 세피아가 나올 수 없다", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("어떤 조합에서도 클래스가 있는 테마만 나온다", () => {
    for (const choice of THEME_CHOICES) {
      for (const prefersDark of [true, false]) {
        expect(THEME_CLASSES).toContain(themeClassFor(resolveTheme(choice, prefersDark)));
      }
    }
  });
});

describe("themeClassFor", () => {
  it("시스템은 클래스를 붙이지 않는다 — prefers-color-scheme 규칙에 맡긴다", () => {
    expect(themeClassFor("system")).toBeNull();
  });

  /*
   * Tailwind의 .sepia는 filter: sepia() 유틸리티다. html에 그 이름을 붙이면
   * 화면 전체에 필터가 걸린다. 이 단정이 깨지면 그 사고가 난 것이다.
   */
  it("세피아 클래스는 Tailwind 유틸리티 이름과 겹치지 않는다", () => {
    expect(themeClassFor("sepia")).toBe("theme-sepia");
    expect(THEME_CLASSES).not.toContain("sepia");
  });

  it("라이트·다크는 클래스 이름이 값과 같다", () => {
    expect(themeClassFor("light")).toBe("light");
    expect(themeClassFor("dark")).toBe("dark");
  });
});

describe("storageValueFor", () => {
  it("시스템은 키를 지우는 것으로 표현한다", () => {
    expect(storageValueFor("system")).toBeNull();
  });

  it("나머지는 그대로 저장한다", () => {
    expect(storageValueFor("light")).toBe("light");
    expect(storageValueFor("dark")).toBe("dark");
    expect(storageValueFor("sepia")).toBe("sepia");
  });

  // 저장 → 복원이 제자리로 돌아와야 토글이 어긋나지 않는다.
  it("저장한 값을 다시 읽으면 같은 선택이 된다", () => {
    for (const choice of THEME_CHOICES) {
      expect(readThemeChoice(storageValueFor(choice))).toBe(choice);
    }
  });
});

describe("isThemeChoice / 라벨", () => {
  it("선택지만 통과시킨다", () => {
    expect(isThemeChoice("system")).toBe(true);
    expect(isThemeChoice("light")).toBe(true);
    expect(isThemeChoice("dark")).toBe(true);
    expect(isThemeChoice("sepia")).toBe(true);
    expect(isThemeChoice("solarized")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });

  // 다크 오른쪽에 세피아가 온다. 순서가 곧 버튼 순서다.
  it("선택지 순서가 화면 배치와 같다", () => {
    expect(THEME_CHOICES).toEqual(["system", "light", "dark", "sepia"]);
  });

  it("모든 선택지에 라벨이 있다", () => {
    for (const choice of THEME_CHOICES) {
      expect(THEME_LABEL[choice]).toBeTruthy();
    }
  });
});
