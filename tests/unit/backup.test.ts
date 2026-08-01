import { describe, expect, it } from "vitest";

import { backupFileName, csvCell, csvRow, finishedCsv, toCsv } from "@/lib/backup/csv";
import {
  bookKey,
  describeSummary,
  isDuplicatePolicy,
  planImport,
  type ExistingBook,
} from "@/lib/backup/import-plan";
import { BACKUP_VERSION, parseBackup, type BackupBook } from "@/lib/backup/schema";

function book(overrides: Partial<BackupBook> = {}): BackupBook {
  return {
    title: "기본 제목",
    subtitle: null,
    authors: ["저자"],
    translators: [],
    publisher: null,
    published_on: null,
    isbn13: null,
    cover_url: null,
    total_pages: null,
    format: "ebook",
    ownership: "own",
    memo: null,
    source: "manual",
    source_ref: null,
    category: null,
    tags: [],
    shelves: [],
    readings: [],
    ...overrides,
  };
}

function validBackup(books: BackupBook[] = []) {
  return {
    version: BACKUP_VERSION,
    exported_at: "2026-08-01T00:00:00.000Z",
    categories: [{ name: "문학", color: null, sort_order: 1 }],
    shelves: [],
    goals: [],
    books,
  };
}

describe("csvCell", () => {
  it("특수문자가 없으면 그대로 둔다", () => {
    expect(csvCell("사피엔스")).toBe("사피엔스");
    expect(csvCell(42)).toBe("42");
  });

  it("빈 값은 빈 칸", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  // 소감과 메모에 전부 들어갈 수 있는 문자들이다.
  it("쉼표가 있으면 감싼다", () => {
    expect(csvCell("총, 균, 쇠")).toBe('"총, 균, 쇠"');
  });

  it("따옴표는 두 개로 늘려 이스케이프한다 (RFC 4180)", () => {
    expect(csvCell('그는 "안녕"이라 했다')).toBe('"그는 ""안녕""이라 했다"');
  });

  it("줄바꿈이 있으면 감싼다", () => {
    expect(csvCell("첫 줄\n둘째 줄")).toBe('"첫 줄\n둘째 줄"');
    expect(csvCell("첫 줄\r\n둘째 줄")).toBe('"첫 줄\r\n둘째 줄"');
  });

  it("0은 빈 칸이 아니다", () => {
    expect(csvCell(0)).toBe("0");
  });
});

describe("csvRow / toCsv", () => {
  it("칸을 쉼표로 잇는다", () => {
    expect(csvRow(["가", "나", 3])).toBe("가,나,3");
  });

  it("헤더가 맨 앞에 온다", () => {
    const csv = toCsv(["제목"], [["사피엔스"]]);
    expect(csv).toContain("제목\r\n사피엔스");
  });

  // 엑셀이 없으면 한글을 깨뜨린다.
  it("BOM으로 시작한다", () => {
    expect(toCsv(["제목"], [])).toMatch(/^﻿/);
  });

  // 엑셀이 LF만 있는 파일에서 줄을 제대로 안 나누는 경우가 있다.
  it("줄바꿈은 CRLF다", () => {
    const csv = toCsv(["a", "b"], [["1", "2"]]);
    expect(csv).toBe("﻿a,b\r\n1,2\r\n");
  });

  it("행이 없어도 헤더만으로 성립한다", () => {
    expect(toCsv(["제목"], [])).toBe("﻿제목\r\n");
  });
});

describe("finishedCsv", () => {
  const row = {
    title: "사피엔스",
    authors: ["유발 하라리", "조현욱"],
    publisher: "김영사",
    category: "역사",
    tags: ["번역서", "추천받음"],
    attemptNo: 1,
    rating: 4.5,
    finishedAt: "2026-03-15T12:00:00.000Z",
    minutes: 320,
    review: "인상적이었다, 특히 1부가.",
  };

  it("헤더와 값이 같은 개수다", () => {
    const [header, body] = finishedCsv([row]).replace(/^﻿/, "").split("\r\n");
    // 소감에 쉼표가 있어 감싸져 있으므로 단순 split으로 세지 않는다.
    expect(header.split(",")).toHaveLength(10);
    expect(body).toContain('"인상적이었다, 특히 1부가."');
  });

  it("여러 저자·태그는 쉼표로 잇고 칸을 감싼다", () => {
    const csv = finishedCsv([row]);
    expect(csv).toContain('"유발 하라리, 조현욱"');
    expect(csv).toContain('"번역서, 추천받음"');
  });

  // 시각까지 넣으면 스프레드시트가 제멋대로 해석한다.
  it("완독일은 날짜만 남긴다", () => {
    expect(finishedCsv([row])).toContain("2026-03-15");
    expect(finishedCsv([row])).not.toContain("T12:00:00");
  });

  it("완독일이 없어도 터지지 않는다", () => {
    expect(() => finishedCsv([{ ...row, finishedAt: null }])).not.toThrow();
  });

  it("책이 없으면 헤더만 나온다", () => {
    expect(finishedCsv([]).split("\r\n").filter(Boolean)).toHaveLength(1);
  });
});

describe("backupFileName", () => {
  it("날짜가 들어가 덮어쓰지 않는다", () => {
    expect(backupFileName("json", "2026-08-01")).toBe("book-reader-2026-08-01.json");
    expect(backupFileName("csv", "2026-08-01")).toBe("book-reader-완독목록-2026-08-01.csv");
  });
});

describe("parseBackup", () => {
  it("올바른 백업을 읽는다", () => {
    const result = parseBackup(JSON.stringify(validBackup([book()])));
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.backup.books).toHaveLength(1);
  });

  it("JSON이 아니면 거절한다", () => {
    const result = parseBackup("이건 JSON이 아니다");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("JSON");
  });

  it("모양이 다르면 어디가 틀렸는지 알려준다", () => {
    const result = parseBackup(JSON.stringify({ version: 1 }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("백업 파일 형식이 아닙니다");
  });

  // 모르는 형식을 억지로 해석하면 조용히 데이터가 어긋난다.
  it("더 새로운 버전은 거절한다", () => {
    const result = parseBackup(JSON.stringify({ ...validBackup(), version: BACKUP_VERSION + 1 }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("업데이트");
  });

  it("같거나 낮은 버전은 받는다", () => {
    expect(parseBackup(JSON.stringify({ ...validBackup(), version: BACKUP_VERSION })).ok).toBe(
      true,
    );
  });

  it("남의 JSON을 그대로 밀어넣지 않는다", () => {
    expect(parseBackup(JSON.stringify({ hello: "world" })).ok).toBe(false);
    expect(parseBackup(JSON.stringify([1, 2, 3])).ok).toBe(false);
  });

  it("상태·단위 같은 열거값을 검사한다", () => {
    const bad = validBackup([
      { ...book(), readings: [{ attempt_no: 1, status: "없는상태" }] } as never,
    ]);
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("bookKey", () => {
  it("ISBN이 있으면 ISBN으로 본다", () => {
    expect(bookKey({ isbn13: "9781234567897", title: "아무거나" })).toBe("isbn:9781234567897");
  });

  it("ISBN이 없으면 제목으로 본다", () => {
    expect(bookKey({ isbn13: null, title: "백석 시집" })).toBe(
      bookKey({ isbn13: null, title: " 백석  시집 " }),
    );
  });

  it("제목이 같아도 ISBN이 다르면 다른 책이다", () => {
    expect(bookKey({ isbn13: "9781111111111", title: "같은 제목" })).not.toBe(
      bookKey({ isbn13: "9782222222222", title: "같은 제목" }),
    );
  });
});

describe("planImport", () => {
  const existing: ExistingBook[] = [
    { isbn13: "9781234567897", title: "사피엔스" },
    { isbn13: null, title: "백석 시집" },
  ];

  it("이미 있는 ISBN은 건너뛴다", () => {
    const plan = planImport(
      existing,
      [book({ isbn13: "9781234567897", title: "사피엔스" })],
      "skip",
    );
    expect(plan.insert).toHaveLength(0);
    expect(plan.skipped).toEqual(["사피엔스"]);
  });

  it("ISBN 없는 책은 제목으로 건너뛴다", () => {
    const plan = planImport(existing, [book({ title: "백석 시집" })], "skip");
    expect(plan.insert).toHaveLength(0);
  });

  it("새 책은 넣는다", () => {
    const plan = planImport(existing, [book({ title: "코스모스" })], "skip");
    expect(plan.insert).toHaveLength(1);
    expect(plan.skipped).toEqual([]);
  });

  // 손으로 합친 파일에 같은 책이 두 번 들어 있을 수 있다.
  it("파일 안의 중복도 한 번만 넣는다", () => {
    const plan = planImport([], [book({ title: "코스모스" }), book({ title: "코스모스" })], "skip");
    expect(plan.insert).toHaveLength(1);
    expect(plan.skipped).toHaveLength(1);
  });

  it("add 정책이면 전부 넣는다", () => {
    const plan = planImport(
      existing,
      [book({ isbn13: "9781234567897", title: "사피엔스" })],
      "add",
    );
    expect(plan.insert).toHaveLength(1);
    expect(plan.skipped).toEqual([]);
  });

  it("빈 서재에 빈 백업을 넣어도 터지지 않는다", () => {
    expect(planImport([], [], "skip")).toEqual({ insert: [], skipped: [] });
  });

  it("정책 타입 가드", () => {
    expect(isDuplicatePolicy("skip")).toBe(true);
    expect(isDuplicatePolicy("add")).toBe(true);
    expect(isDuplicatePolicy("replace")).toBe(false);
  });
});

describe("describeSummary", () => {
  it("건너뛴 것이 없으면 언급하지 않는다", () => {
    const text = describeSummary({ books: 3, readings: 4, logs: 10, notes: 2, skipped: 0 });
    expect(text).toContain("책 3권");
    expect(text).not.toContain("건너뛰");
  });

  it("건너뛴 것이 있으면 몇 권인지 알려준다", () => {
    const text = describeSummary({ books: 1, readings: 1, logs: 0, notes: 0, skipped: 2 });
    expect(text).toContain("2권은 이미 있어 건너뛰었습니다");
  });
});
