import { describe, expect, it } from "vitest";

import {
  checkNoteBody,
  checkNoteLocation,
  checkRating,
  checkReview,
  formatNoteLocation,
  formatRating,
  isNoteKind,
  normalizeText,
  parseRating,
  RATING_OPTIONS,
  REVIEW_MAX_LENGTH,
} from "@/lib/reviews";

describe("checkRating", () => {
  it("매기지 않아도 된다", () => {
    expect(checkRating(null)).toEqual({ ok: true });
  });

  it.each(RATING_OPTIONS)("%s점은 허용한다", (rating) => {
    expect(checkRating(rating)).toEqual({ ok: true });
  });

  // DB 제약(readings_rating)과 같은 규칙이어야 한다.
  it.each([1.1, 4.3, 2.25, 0.7])("%s점은 0.5 단위가 아니라 거부한다", (rating) => {
    expect(checkRating(rating)).toEqual({
      ok: false,
      message: "별점은 0.5 단위로만 매길 수 있습니다.",
    });
  });

  // 0.3은 0.5 미만이라 단위가 아니라 범위에서 먼저 걸린다.
  it.each([0, -1, 0.3, 5.5, 10])("범위 밖 %s점은 거부한다", (rating) => {
    expect(checkRating(rating)).toEqual({
      ok: false,
      message: "별점은 0.5에서 5.0 사이여야 합니다.",
    });
  });

  it("숫자가 아니면 거부한다", () => {
    expect(checkRating(Number.NaN)).toEqual({ ok: false, message: "별점이 올바르지 않습니다." });
  });
});

describe("checkReview", () => {
  it("쓰지 않아도 된다", () => {
    expect(checkReview(null)).toEqual({ ok: true });
  });

  // 경계값: DB의 char_length(review) <= 500 과 정확히 같아야 한다.
  it("500자는 허용한다", () => {
    expect(checkReview("ㄱ".repeat(REVIEW_MAX_LENGTH))).toEqual({ ok: true });
  });

  it("501자는 거부하고 현재 길이를 알려준다", () => {
    expect(checkReview("ㄱ".repeat(REVIEW_MAX_LENGTH + 1))).toEqual({
      ok: false,
      message: "소감은 500자까지 쓸 수 있습니다. (현재 501자)",
    });
  });
});

describe("normalizeText / parseRating", () => {
  it("공백만 있는 입력은 값 없음으로 본다", () => {
    expect(normalizeText("   ")).toBeNull();
    expect(normalizeText("")).toBeNull();
    expect(normalizeText(null)).toBeNull();
  });

  it("앞뒤 공백을 정리한다", () => {
    expect(normalizeText("  좋았다  ")).toBe("좋았다");
  });

  it("별점을 고르지 않으면 null", () => {
    expect(parseRating("")).toBeNull();
    expect(parseRating(null)).toBeNull();
  });

  it("별점 문자열을 숫자로 바꾼다", () => {
    expect(parseRating("4.5")).toBe(4.5);
  });
});

describe("formatRating", () => {
  it("소수 한 자리로 표시한다", () => {
    expect(formatRating(4.5)).toBe("★ 4.5");
    expect(formatRating(5)).toBe("★ 5.0");
  });

  it("없으면 없다고 적는다", () => {
    expect(formatRating(null)).toBe("별점 없음");
  });
});

describe("인용구", () => {
  it("종류를 검사한다", () => {
    expect(isNoteKind("quote")).toBe(true);
    expect(isNoteKind("thought")).toBe(true);
    expect(isNoteKind("question")).toBe(true);
    expect(isNoteKind("review")).toBe(false);
    expect(isNoteKind(null)).toBe(false);
  });

  it("내용이 없으면 거부한다", () => {
    expect(checkNoteBody(null)).toEqual({ ok: false, message: "내용을 입력하세요." });
  });

  it("2000자는 허용하고 2001자는 거부한다", () => {
    expect(checkNoteBody("ㄱ".repeat(2000))).toEqual({ ok: true });
    expect(checkNoteBody("ㄱ".repeat(2001))).toEqual({
      ok: false,
      message: "2000자까지 쓸 수 있습니다. (현재 2001자)",
    });
  });

  it("위치는 비워둘 수 있다", () => {
    expect(checkNoteLocation(null, "page", 480)).toEqual({ ok: true });
  });

  it("퍼센트 단위는 100을 넘을 수 없다", () => {
    expect(checkNoteLocation(101, "percent", 100)).toEqual({
      ok: false,
      message: "위치는 100%를 넘을 수 없습니다.",
    });
  });

  it("페이지 단위는 전체 쪽수를 넘을 수 없다", () => {
    expect(checkNoteLocation(481, "page", 480)).toEqual({
      ok: false,
      message: "전체 480쪽을 넘을 수 없습니다.",
    });
  });

  it("음수와 소수는 거부한다", () => {
    expect(checkNoteLocation(-1, "page", 480)).toEqual({
      ok: false,
      message: "위치는 0 이상이어야 합니다.",
    });
    expect(checkNoteLocation(12.5, "page", 480)).toEqual({
      ok: false,
      message: "위치는 정수로 입력하세요.",
    });
  });

  it("단위에 맞춰 위치를 표기한다", () => {
    expect(formatNoteLocation(120, "page")).toBe("120쪽");
    expect(formatNoteLocation(30, "percent")).toBe("30%");
    expect(formatNoteLocation(null, "page")).toBe("");
  });
});
