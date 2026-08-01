/**
 * CSV 내보내기 (PRD §3.2 F15).
 *
 * 스프레드시트로 열어보려는 용도다. 되돌리기(가져오기)는 JSON이 맡는다 —
 * CSV는 중첩(회차·진행 기록·인용구)을 표현하지 못한다.
 */

/**
 * CSV 한 칸을 감싼다.
 *
 * 쉼표·따옴표·줄바꿈이 들어가면 칸이 깨진다. 소감과 메모에 전부 들어갈 수
 * 있는 문자들이다. 따옴표는 두 개로 늘려서 이스케이프한다(RFC 4180).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * CSV 파일 본문.
 *
 * 줄바꿈은 CRLF다. 엑셀이 LF만 있는 파일에서 줄을 제대로 안 나누는 경우가 있다.
 * 맨 앞의 BOM도 엑셀 때문이다 — 없으면 한글이 깨져 보인다.
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [csvRow(header), ...rows.map(csvRow)];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export type FinishedRow = {
  title: string;
  authors: string[];
  publisher: string | null;
  category: string | null;
  tags: string[];
  attemptNo: number;
  rating: number | null;
  finishedAt: string | null;
  minutes: number;
  review: string | null;
};

export const FINISHED_CSV_HEADER = [
  "제목",
  "저자",
  "출판사",
  "분야",
  "태그",
  "회차",
  "별점",
  "완독일",
  "독서시간(분)",
  "소감",
];

/** 완독 목록 CSV. 완독일 최신순으로 넘겨받는다. */
export function finishedCsv(rows: FinishedRow[]): string {
  return toCsv(
    FINISHED_CSV_HEADER,
    rows.map((row) => [
      row.title,
      row.authors.join(", "),
      row.publisher,
      row.category,
      row.tags.join(", "),
      row.attemptNo,
      row.rating,
      // 시각까지 넣으면 스프레드시트가 제멋대로 해석한다. 날짜만 남긴다.
      row.finishedAt ? row.finishedAt.slice(0, 10) : "",
      row.minutes,
      row.review,
    ]),
  );
}

/** 다운로드 파일 이름. 같은 날 여러 번 받아도 덮어쓰지 않게 날짜를 붙인다. */
export function backupFileName(kind: "json" | "csv", today: string): string {
  return kind === "json" ? `book-reader-${today}.json` : `book-reader-완독목록-${today}.csv`;
}
