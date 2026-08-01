import { describe, expect, it } from "vitest";

import {
  CATEGORY_PALETTE,
  categoryColor,
  checkCategoryColor,
  checkCategoryName,
} from "@/lib/taxonomy/category";
import { checkShelfDescription, checkShelfName } from "@/lib/taxonomy/shelf";
import {
  checkTagNames,
  diffTags,
  formatTagInput,
  normalizeTagName,
  parseTagInput,
  planTagMerge,
  tagKey,
} from "@/lib/taxonomy/tags";

describe("categoryColor", () => {
  it("사용자가 고른 색이 있으면 그대로 쓴다", () => {
    expect(categoryColor("#123456", 0)).toBe("#123456");
  });

  it("색이 없으면 정렬 순서로 팔레트에서 배정한다", () => {
    expect(categoryColor(null, 0)).toBe(CATEGORY_PALETTE[0]);
    expect(categoryColor(null, 3)).toBe(CATEGORY_PALETTE[3]);
  });

  it("팔레트보다 분야가 많아지면 처음부터 돌린다", () => {
    expect(categoryColor(null, CATEGORY_PALETTE.length)).toBe(CATEGORY_PALETTE[0]);
    expect(categoryColor(null, CATEGORY_PALETTE.length + 2)).toBe(CATEGORY_PALETTE[2]);
  });

  it("음수 순서에도 팔레트 밖으로 나가지 않는다", () => {
    expect(CATEGORY_PALETTE).toContain(categoryColor(null, -1));
  });

  it("팔레트 색은 전부 DB 제약(#rrggbb)을 만족한다", () => {
    for (const color of CATEGORY_PALETTE) {
      expect(checkCategoryColor(color)).toEqual({ ok: true });
    }
  });

  it("팔레트에 중복 색이 없다 — 도넛에서 구분되어야 한다", () => {
    expect(new Set(CATEGORY_PALETTE).size).toBe(CATEGORY_PALETTE.length);
  });
});

describe("checkCategoryName / checkCategoryColor", () => {
  it("빈 이름은 거부한다", () => {
    expect(checkCategoryName(null).ok).toBe(false);
    expect(checkCategoryName("").ok).toBe(false);
  });

  it("30자까지 허용하고 31자는 거부한다 (DB categories_name_len)", () => {
    expect(checkCategoryName("가".repeat(30))).toEqual({ ok: true });
    expect(checkCategoryName("가".repeat(31)).ok).toBe(false);
  });

  it("색은 없어도 된다 — 앱이 팔레트에서 배정한다", () => {
    expect(checkCategoryColor(null)).toEqual({ ok: true });
  });

  it.each(["#abc", "123456", "#12345g", "#1234567"])("%s 는 거부한다", (color) => {
    expect(checkCategoryColor(color).ok).toBe(false);
  });

  it("대문자 hex도 받는다", () => {
    expect(checkCategoryColor("#AABBCC")).toEqual({ ok: true });
  });
});

describe("normalizeTagName / tagKey", () => {
  it("앞뒤 공백과 앞의 #을 걷어낸다", () => {
    expect(normalizeTagName("  #번역서 ")).toBe("번역서");
    expect(normalizeTagName("##SF")).toBe("SF");
  });

  it("안쪽 공백은 살리되 여러 칸은 한 칸으로 줄인다", () => {
    expect(normalizeTagName("재독   예정")).toBe("재독 예정");
  });

  it("대소문자는 사용자가 쓴 대로 둔다 — 표시용이다", () => {
    expect(normalizeTagName("SF")).toBe("SF");
  });

  it("같은 태그 판정은 대소문자를 무시한다", () => {
    expect(tagKey("SF")).toBe(tagKey("sf"));
    expect(tagKey(" #SF ")).toBe(tagKey("sf"));
  });
});

describe("parseTagInput", () => {
  it("쉼표로 나눈다", () => {
    expect(parseTagInput("SF, 번역서, 추천받음")).toEqual(["SF", "번역서", "추천받음"]);
  });

  // 공백으로 나누면 "재독 예정" 같은 태그를 쓸 수 없다.
  it("공백으로는 나누지 않는다", () => {
    expect(parseTagInput("재독 예정")).toEqual(["재독 예정"]);
  });

  it("빈 항목은 버린다", () => {
    expect(parseTagInput("SF, , 번역서,")).toEqual(["SF", "번역서"]);
  });

  it("중복은 대소문자를 무시하고 처음 것만 남긴다", () => {
    expect(parseTagInput("SF, sf, Sf")).toEqual(["SF"]);
  });

  it("빈 입력은 빈 배열", () => {
    expect(parseTagInput(null)).toEqual([]);
    expect(parseTagInput("   ")).toEqual([]);
    expect(parseTagInput(",,,")).toEqual([]);
  });

  it("입력 칸으로 되돌릴 수 있다", () => {
    expect(formatTagInput(parseTagInput("#SF,  번역서"))).toBe("SF, 번역서");
  });
});

describe("checkTagNames", () => {
  it("20개까지 허용한다", () => {
    expect(checkTagNames(Array.from({ length: 20 }, (_, i) => `t${i}`))).toEqual({ ok: true });
  });

  it("21개는 거부한다", () => {
    expect(checkTagNames(Array.from({ length: 21 }, (_, i) => `t${i}`)).ok).toBe(false);
  });

  it("30자까지 허용하고 31자는 거부한다 (DB tags_name_len)", () => {
    expect(checkTagNames(["가".repeat(30)])).toEqual({ ok: true });
    expect(checkTagNames(["가".repeat(31)]).ok).toBe(false);
  });
});

describe("diffTags", () => {
  it("추가된 것과 빠진 것을 갈라낸다", () => {
    expect(diffTags(["SF", "번역서"], ["번역서", "추천받음"])).toEqual({
      add: ["추천받음"],
      remove: ["SF"],
    });
  });

  // 안 바뀐 연결까지 지웠다 다시 넣으면 생성 시각이 매번 초기화된다.
  it("표기만 다르고 같은 태그면 건드리지 않는다", () => {
    expect(diffTags(["SF"], ["sf"])).toEqual({ add: [], remove: [] });
  });

  it("전부 지우는 경우", () => {
    expect(diffTags(["SF", "번역서"], [])).toEqual({ add: [], remove: ["SF", "번역서"] });
  });

  it("처음 붙이는 경우", () => {
    expect(diffTags([], ["SF"])).toEqual({ add: ["SF"], remove: [] });
  });
});

describe("planTagMerge", () => {
  const existing = ["SF", "번역서", "추천받음"];

  it("있는 태그끼리는 합칠 수 있다", () => {
    expect(planTagMerge("SF", "번역서", existing)).toEqual({
      ok: true,
      from: "SF",
      into: "번역서",
    });
  });

  it("표기만 다른 같은 태그는 거부한다", () => {
    const result = planTagMerge("SF", "sf", existing);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("같은 태그");
  });

  it("없는 태그는 거부하고 어느 쪽인지 알려준다", () => {
    const result = planTagMerge("없는것", "SF", existing);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("없는것");
  });

  it.each([
    [null, "SF"],
    ["SF", null],
    ["", "SF"],
  ])("한쪽이 비어 있으면 거부한다 (%s, %s)", (from, into) => {
    expect(planTagMerge(from, into, existing).ok).toBe(false);
  });

  it("#을 붙여 넣어도 찾아낸다", () => {
    expect(planTagMerge("#SF", "#번역서", existing).ok).toBe(true);
  });
});

describe("checkShelfName / checkShelfDescription", () => {
  it("빈 이름은 거부한다", () => {
    expect(checkShelfName(null).ok).toBe(false);
    expect(checkShelfName("").ok).toBe(false);
  });

  it("50자까지 허용하고 51자는 거부한다 (DB shelves_name_len)", () => {
    expect(checkShelfName("가".repeat(50))).toEqual({ ok: true });
    expect(checkShelfName("가".repeat(51)).ok).toBe(false);
  });

  it("설명은 없어도 되고 300자까지 쓴다 (DB shelves_desc_len)", () => {
    expect(checkShelfDescription(null)).toEqual({ ok: true });
    expect(checkShelfDescription("가".repeat(300))).toEqual({ ok: true });
    expect(checkShelfDescription("가".repeat(301)).ok).toBe(false);
  });
});
