import { describe, expect, it } from "vitest";

import { readBookForm, splitNames } from "@/lib/books/schema";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const VALID = {
  title: "사피엔스",
  authors: "유발 하라리",
  publisher: "김영사",
  format: "ebook",
  ownership: "own",
};

describe("splitNames", () => {
  it("쉼표로 나누고 공백을 정리한다", () => {
    expect(splitNames(" 유발 하라리 ,  조현욱 ")).toEqual(["유발 하라리", "조현욱"]);
  });

  it("빈 항목은 버린다", () => {
    expect(splitNames("유발 하라리, , ,")).toEqual(["유발 하라리"]);
  });

  it("값이 없으면 빈 배열", () => {
    expect(splitNames(null)).toEqual([]);
    expect(splitNames("")).toEqual([]);
  });
});

describe("readBookForm", () => {
  it("정상 입력을 파싱한다", () => {
    const result = readBookForm(
      form({ ...VALID, translators: "조현욱", isbn13: "9788934972464", total_pages: "480" }),
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      title: "사피엔스",
      authors: ["유발 하라리"],
      translators: ["조현욱"],
      publisher: "김영사",
      isbn13: "9788934972464",
      total_pages: 480,
      format: "ebook",
      ownership: "own",
      source: "manual",
    });
  });

  it("빈 문자열은 null로 바꾼다 — DB의 null과 맞춘다", () => {
    const result = readBookForm(
      form({ ...VALID, subtitle: "", publisher: "  ", isbn13: "", cover_url: "", memo: "" }),
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      subtitle: null,
      publisher: null,
      isbn13: null,
      cover_url: null,
      memo: null,
      total_pages: null,
      published_on: null,
    });
  });

  it("제목이 없으면 거부한다", () => {
    const result = readBookForm(form({ ...VALID, title: "   " }));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("제목을 입력하세요.");
  });

  it.each([
    ["978893497246", "ISBN13은 숫자 13자리여야 합니다."],
    ["97889349724641", "ISBN13은 숫자 13자리여야 합니다."],
    ["978-89-349-7246-4", "ISBN13은 숫자 13자리여야 합니다."],
  ])("ISBN %s 는 거부한다", (isbn13, message) => {
    const result = readBookForm(form({ ...VALID, isbn13 }));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it.each([
    ["0", "페이지수는 1 이상이어야 합니다."],
    ["-10", "페이지수는 1 이상이어야 합니다."],
    ["99999", "페이지수가 너무 큽니다."],
    ["삼백", "페이지수는 숫자로 입력하세요."],
    ["12.5", "페이지수는 정수여야 합니다."],
  ])("페이지수 %s 는 거부한다", (total_pages, message) => {
    const result = readBookForm(form({ ...VALID, total_pages }));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("출간일 형식을 검사한다", () => {
    const bad = readBookForm(form({ ...VALID, published_on: "2015년 11월" }));
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("출간일은 YYYY-MM-DD 형식이어야 합니다.");

    expect(readBookForm(form({ ...VALID, published_on: "2015-11-24" })).success).toBe(true);
  });

  it("표지 주소가 URL이 아니면 거부한다", () => {
    const result = readBookForm(form({ ...VALID, cover_url: "그림파일" }));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("표지 주소가 올바른 URL이 아닙니다.");
  });

  it.each([
    ["format", "audiobook", "형태는 전자책 또는 종이책이어야 합니다."],
    ["ownership", "rented", "소장 형태가 올바르지 않습니다."],
  ])("%s 에 없는 값 %s 는 거부한다", (field, value, message) => {
    const result = readBookForm(form({ ...VALID, [field]: value }));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("형태와 소장 형태를 비우면 전자책·소장으로 본다", () => {
    const result = readBookForm(form({ title: "제목만" }));

    expect(result.success).toBe(true);
    expect(result.data?.format).toBe("ebook");
    expect(result.data?.ownership).toBe("own");
  });

  it("검색에서 넘어온 source_ref JSON을 객체로 만든다", () => {
    const result = readBookForm(
      form({
        ...VALID,
        source: "kakao",
        source_ref: JSON.stringify({ provider: "kakao", isbn: "9788934972464" }),
      }),
    );

    expect(result.data?.source).toBe("kakao");
    expect(result.data?.source_ref).toEqual({ provider: "kakao", isbn: "9788934972464" });
  });

  it("망가진 source_ref는 null로 흘려보낸다 — 등록 자체가 막히면 안 된다", () => {
    const result = readBookForm(form({ ...VALID, source_ref: "{not json" }));

    expect(result.success).toBe(true);
    expect(result.data?.source_ref).toBeNull();
  });
});
