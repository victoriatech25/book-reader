import { describe, expect, it } from "vitest";

import {
  isThemeChoice,
  readThemeChoice,
  resolveTheme,
  storageValueFor,
  THEME_CHOICES,
  THEME_LABEL,
} from "@/lib/theme";

describe("readThemeChoice", () => {
  it("저장된 값이 그대로 선택이 된다", () => {
    expect(readThemeChoice("light")).toBe("light");
    expect(readThemeChoice("dark")).toBe("dark");
  });

  // 키가 없다 = 시스템을 따른다. "system"이라는 값을 저장하지 않는 이유다.
  it("키가 없으면 시스템", () => {
    expect(readThemeChoice(null)).toBe("system");
    expect(readThemeChoice(undefined)).toBe("system");
  });

  it("이상한 값이 들어가 있어도 시스템으로 떨어뜨린다", () => {
    expect(readThemeChoice("")).toBe("system");
    expect(readThemeChoice("sepia")).toBe("system");
    expect(readThemeChoice("Dark")).toBe("system");
    // 예전 버전이 "system"을 저장했더라도 클래스 이름으로 쓰이면 안 된다.
    expect(readThemeChoice("system")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("직접 고른 값은 OS와 무관하게 고정된다", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("시스템일 때만 OS 설정을 따른다", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("어떤 조합에서도 light 아니면 dark만 나온다 — 클래스 이름이 된다", () => {
    for (const choice of THEME_CHOICES) {
      for (const prefersDark of [true, false]) {
        expect(["light", "dark"]).toContain(resolveTheme(choice, prefersDark));
      }
    }
  });
});

describe("storageValueFor", () => {
  it("시스템은 키를 지우는 것으로 표현한다", () => {
    expect(storageValueFor("system")).toBeNull();
  });

  it("나머지는 그대로 저장한다", () => {
    expect(storageValueFor("light")).toBe("light");
    expect(storageValueFor("dark")).toBe("dark");
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
    expect(isThemeChoice("sepia")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });

  it("모든 선택지에 라벨이 있다", () => {
    for (const choice of THEME_CHOICES) {
      expect(THEME_LABEL[choice]).toBeTruthy();
    }
  });
});
