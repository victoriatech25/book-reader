import { describe, expect, it } from "vitest";

import {
  buildStatusPatch,
  canTransition,
  initialProgress,
  InvalidTransitionError,
  isTerminal,
  nextStatuses,
  READING_STATUSES,
  transitionLabel,
  type ReadingDates,
  type ReadingStatus,
} from "@/lib/reading-status";

/** PRD §2.2 전이도에서 허용하는 조합. 이 목록에 없으면 전부 거부되어야 한다. */
const ALLOWED: ReadonlyArray<[ReadingStatus, ReadingStatus]> = [
  ["want", "reading"],
  ["reading", "paused"],
  ["reading", "finished"],
  ["reading", "dropped"],
  ["paused", "reading"],
  ["paused", "dropped"],
];

function isAllowed(from: ReadingStatus, to: ReadingStatus) {
  return ALLOWED.some(([f, t]) => f === from && t === to);
}

describe("canTransition — 전수 검사", () => {
  // 5 x 5 = 25가지 조합을 빠짐없이 확인한다.
  for (const from of READING_STATUSES) {
    for (const to of READING_STATUSES) {
      const expected = isAllowed(from, to);
      it(`${from} → ${to} : ${expected ? "허용" : "거부"}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }

  it("자기 자신으로의 전이는 모두 거부한다", () => {
    for (const status of READING_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("완독·중단은 종착점이라 나가는 전이가 없다", () => {
    expect(nextStatuses("finished")).toEqual([]);
    expect(nextStatuses("dropped")).toEqual([]);
    expect(isTerminal("finished")).toBe(true);
    expect(isTerminal("dropped")).toBe(true);
  });

  it("나머지 상태는 종착점이 아니다", () => {
    expect(isTerminal("want")).toBe(false);
    expect(isTerminal("reading")).toBe(false);
    expect(isTerminal("paused")).toBe(false);
  });
});

describe("buildStatusPatch", () => {
  const now = new Date("2026-07-30T12:00:00.000Z");
  const iso = now.toISOString();

  const blank: ReadingDates = {
    status: "want",
    started_at: null,
    finished_at: null,
    dropped_at: null,
  };

  it("허용되지 않는 전이는 던진다", () => {
    expect(() => buildStatusPatch({ ...blank, status: "finished" }, "reading")).toThrowError(
      InvalidTransitionError,
    );
  });

  it("읽기 시작하면 started_at을 찍는다", () => {
    const patch = buildStatusPatch(blank, "reading", { now });

    expect(patch.status).toBe("reading");
    expect(patch.started_at).toBe(iso);
    expect(patch.finished_at).toBeNull();
    expect(patch.dropped_at).toBeNull();
  });

  it("이어읽기는 최초 시작일을 덮어쓰지 않는다", () => {
    const paused: ReadingDates = {
      status: "paused",
      started_at: "2026-01-02T00:00:00.000Z",
      finished_at: null,
      dropped_at: null,
    };

    const patch = buildStatusPatch(paused, "reading", { now });

    expect(patch.started_at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("완독하면 finished_at을 찍고 started_at은 유지한다", () => {
    const reading: ReadingDates = {
      status: "reading",
      started_at: "2026-01-02T00:00:00.000Z",
      finished_at: null,
      dropped_at: null,
    };

    const patch = buildStatusPatch(reading, "finished", { now });

    expect(patch.finished_at).toBe(iso);
    expect(patch.started_at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("중단하면 dropped_at과 사유를 남긴다", () => {
    const reading: ReadingDates = { ...blank, status: "reading", started_at: iso };

    const patch = buildStatusPatch(reading, "dropped", { now, dropReason: "  번역이 어렵다  " });

    expect(patch.dropped_at).toBe(iso);
    expect(patch.drop_reason).toBe("번역이 어렵다");
  });

  it("빈 중단 사유는 null로 정리한다", () => {
    const reading: ReadingDates = { ...blank, status: "reading", started_at: iso };

    expect(buildStatusPatch(reading, "dropped", { now, dropReason: "   " }).drop_reason).toBeNull();
    expect(buildStatusPatch(reading, "dropped", { now }).drop_reason).toBeNull();
  });

  // DB 제약 readings_started_ts: want이 아닌 상태는 started_at이 반드시 있어야 한다.
  it.each([
    ["reading", "want"],
    ["paused", "reading"],
    ["finished", "reading"],
    ["dropped", "reading"],
  ] as const)("%s 로 바뀌면 started_at이 비어 있지 않다", (to, from) => {
    const patch = buildStatusPatch({ ...blank, status: from }, to, { now });
    expect(patch.started_at).not.toBeNull();
  });

  it("잠시 멈춤은 날짜를 새로 찍지 않는다", () => {
    const reading: ReadingDates = {
      status: "reading",
      started_at: "2026-01-02T00:00:00.000Z",
      finished_at: null,
      dropped_at: null,
    };

    const patch = buildStatusPatch(reading, "paused", { now });

    expect(patch.started_at).toBe("2026-01-02T00:00:00.000Z");
    expect(patch.finished_at).toBeNull();
    expect(patch.dropped_at).toBeNull();
  });
});

describe("transitionLabel", () => {
  it("상태 이름이 아니라 행위로 표시한다", () => {
    expect(transitionLabel("want", "reading")).toBe("읽기 시작");
    expect(transitionLabel("paused", "reading")).toBe("다시 읽기");
    expect(transitionLabel("reading", "finished")).toBe("완독");
  });
});

describe("initialProgress", () => {
  it("전자책은 퍼센트로 센다", () => {
    expect(initialProgress({ format: "ebook", total_pages: 320 })).toEqual({
      progress_unit: "percent",
      target_value: 100,
    });
  });

  it("페이지수를 아는 종이책은 페이지로 센다", () => {
    expect(initialProgress({ format: "paper", total_pages: 320 })).toEqual({
      progress_unit: "page",
      target_value: 320,
    });
  });

  it.each([null, 0])(
    "페이지수가 %s 인 종이책은 퍼센트로 시작한다 — 등록을 막지 않는다",
    (totalPages) => {
      expect(initialProgress({ format: "paper", total_pages: totalPages })).toEqual({
        progress_unit: "percent",
        target_value: 100,
      });
    },
  );
});
