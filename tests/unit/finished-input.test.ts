import { describe, expect, it } from "vitest";

import {
  buildFinishedReading,
  checkFinishedMonth,
  monthToTimestamp,
} from "@/lib/books/finished-input";
import {
  countFinishedInYear,
  monthlyFinished,
  seoulDate,
  type FinishedReading,
} from "@/lib/stats/aggregate";

const TODAY = "2026-08-01";

describe("checkFinishedMonth", () => {
  it("YYYY-MM 형식을 받는다", () => {
    expect(checkFinishedMonth("2024-03", TODAY)).toEqual({ ok: true, month: "2024-03" });
  });

  it("앞뒤 공백은 다듬는다", () => {
    expect(checkFinishedMonth("  2024-03 ", TODAY)).toEqual({ ok: true, month: "2024-03" });
  });

  it("비어 있으면 거부한다 — 통계에 놓을 자리가 없다", () => {
    expect(checkFinishedMonth("", TODAY).ok).toBe(false);
    expect(checkFinishedMonth(null, TODAY).ok).toBe(false);
    expect(checkFinishedMonth("   ", TODAY).ok).toBe(false);
  });

  it.each(["2024", "2024-3", "24-03", "2024/03", "2024-00", "2024-13", "어제"])(
    "%s 는 형식이 아니라 거부한다",
    (raw) => {
      const result = checkFinishedMonth(raw, TODAY);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.message).toContain("YYYY-MM");
    },
  );

  it("이번 달까지는 허용한다", () => {
    expect(checkFinishedMonth("2026-08", TODAY).ok).toBe(true);
  });

  it("아직 오지 않은 달은 거부한다", () => {
    const result = checkFinishedMonth("2026-09", TODAY);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("아직 오지 않은");
  });

  it("다음 해도 거부한다", () => {
    expect(checkFinishedMonth("2027-01", TODAY).ok).toBe(false);
  });

  it("오래전은 허용한다 — 앱을 쓰기 전에 읽은 책이 목적이다", () => {
    expect(checkFinishedMonth("1999-12", TODAY).ok).toBe(true);
  });

  it("1900년 이전은 오타로 본다", () => {
    expect(checkFinishedMonth("1899-12", TODAY).ok).toBe(false);
  });
});

describe("monthToTimestamp", () => {
  // UTC 자정으로 넣으면 서울 기준으로 앞 달 마지막 날이 되어 통계가 밀린다.
  it("서울 기준 그 달 1일이 된다", () => {
    expect(seoulDate(monthToTimestamp("2024-03"))).toBe("2024-03-01");
  });

  it("1월도 앞 해로 밀리지 않는다", () => {
    expect(seoulDate(monthToTimestamp("2024-01"))).toBe("2024-01-01");
  });

  it("12월도 다음 해로 밀리지 않는다", () => {
    expect(seoulDate(monthToTimestamp("2024-12"))).toBe("2024-12-01");
  });
});

describe("buildFinishedReading", () => {
  const percent = { progress_unit: "percent" as const, target_value: 100 };
  const page = { progress_unit: "page" as const, target_value: 320 };

  it("완독 상태로 만든다", () => {
    expect(buildFinishedReading({ month: "2024-03", progress: percent }).status).toBe("finished");
  });

  // 다 읽은 책의 진행률 막대가 비어 있으면 안 된다.
  it("진행률을 꽉 채운다", () => {
    expect(buildFinishedReading({ month: "2024-03", progress: percent }).current_value).toBe(100);
    expect(buildFinishedReading({ month: "2024-03", progress: page }).current_value).toBe(320);
  });

  // DB 제약(readings_started_ts)이 want가 아닌 상태에 시작일을 요구한다.
  it("시작일을 완독 시점과 같게 둔다 — 시작일을 모른다", () => {
    const reading = buildFinishedReading({ month: "2024-03", progress: percent });
    expect(reading.started_at).toBe(reading.finished_at);
  });

  it("단위와 분량을 그대로 가져간다", () => {
    const reading = buildFinishedReading({ month: "2024-03", progress: page });
    expect(reading.progress_unit).toBe("page");
    expect(reading.target_value).toBe(320);
  });

  it("DB 제약을 만족한다 (current_value <= target_value)", () => {
    for (const progress of [percent, page]) {
      const reading = buildFinishedReading({ month: "2024-03", progress });
      expect(reading.current_value).toBeLessThanOrEqual(reading.target_value);
      expect(reading.finished_at).not.toBeNull();
      expect(reading.started_at).not.toBeNull();
    }
  });
});

// 요청의 핵심이 "통계치에 반영되도록"이다. 집계 함수에 실제로 잡히는지 본다.
describe("소급 등록한 책이 통계에 잡힌다", () => {
  function asFinished(month: string): FinishedReading {
    const reading = buildFinishedReading({
      month,
      progress: { progress_unit: "percent", target_value: 100 },
    });
    return {
      finishedAt: reading.finished_at,
      categoryId: "c1",
      categoryName: "역사",
      categoryColor: null,
      categorySortOrder: 7,
      rating: 4.5,
    };
  }

  it("연도별 완독 권수에 들어간다", () => {
    const readings = [asFinished("2024-03"), asFinished("2024-11"), asFinished("2025-02")];
    expect(countFinishedInYear(readings, "2024")).toBe(2);
    expect(countFinishedInYear(readings, "2025")).toBe(1);
  });

  it("입력한 달에 정확히 꽂힌다", () => {
    const months = monthlyFinished([asFinished("2024-03")], "2024");
    expect(months[2].count).toBe(1);
    expect(months.filter((m) => m.count > 0)).toHaveLength(1);
  });

  it("1월과 12월이 이웃 해로 새지 않는다", () => {
    const readings = [asFinished("2024-01"), asFinished("2024-12")];
    expect(countFinishedInYear(readings, "2024")).toBe(2);
    expect(countFinishedInYear(readings, "2023")).toBe(0);
    expect(countFinishedInYear(readings, "2025")).toBe(0);

    const months = monthlyFinished(readings, "2024");
    expect(months[0].count).toBe(1);
    expect(months[11].count).toBe(1);
  });
});
