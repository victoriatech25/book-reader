import { describe, expect, it } from "vitest";

import {
  achievementFor,
  activeDays,
  averageRating,
  categoryDistribution,
  countFinishedInYear,
  currentStreak,
  formatMinutes,
  goalProgress,
  isGoalMetric,
  isGoalPeriod,
  monthlyFinished,
  periodKeyFor,
  seoulDate,
  seoulToday,
  totalMinutes,
  type FinishedReading,
  type ProgressEntry,
} from "@/lib/stats/aggregate";
import { barRatios, donutSlices } from "@/lib/stats/chart";

function finished(overrides: Partial<FinishedReading> = {}): FinishedReading {
  return {
    finishedAt: "2026-03-15T12:00:00Z",
    categoryId: "c1",
    categoryName: "역사",
    categoryColor: null,
    categorySortOrder: 7,
    rating: null,
    ...overrides,
  };
}

const log = (loggedOn: string, minutes: number | null = null): ProgressEntry => ({
  loggedOn,
  minutes,
});

describe("seoulDate", () => {
  it("ISO 시각을 서울 기준 날짜로 바꾼다", () => {
    expect(seoulDate("2026-03-15T12:00:00Z")).toBe("2026-03-15");
  });

  // UTC 기준으로 자르면 하루가 밀린다. KST는 UTC+9다.
  it("자정 근처는 서울 기준으로 넘어간다", () => {
    expect(seoulDate("2026-03-15T15:30:00Z")).toBe("2026-03-16");
    expect(seoulDate("2025-12-31T16:00:00Z")).toBe("2026-01-01");
  });

  it("값이 없거나 잘못됐으면 null", () => {
    expect(seoulDate(null)).toBeNull();
    expect(seoulDate("")).toBeNull();
    expect(seoulDate("어제")).toBeNull();
  });

  it("오늘은 YYYY-MM-DD 형식이다", () => {
    expect(seoulToday(new Date("2026-08-01T02:00:00Z"))).toBe("2026-08-01");
  });
});

describe("countFinishedInYear", () => {
  const readings = [
    finished({ finishedAt: "2026-01-05T00:00:00Z" }),
    finished({ finishedAt: "2026-07-20T00:00:00Z" }),
    finished({ finishedAt: "2025-11-01T00:00:00Z" }),
    finished({ finishedAt: null }),
  ];

  it("그 해 완독만 센다", () => {
    expect(countFinishedInYear(readings, "2026")).toBe(2);
    expect(countFinishedInYear(readings, "2025")).toBe(1);
  });

  it("미완독은 세지 않는다", () => {
    expect(countFinishedInYear([finished({ finishedAt: null })], "2026")).toBe(0);
  });

  it("완독이 없는 해는 0", () => {
    expect(countFinishedInYear(readings, "2024")).toBe(0);
  });
});

describe("monthlyFinished", () => {
  it("기록이 없는 달도 포함해 12칸을 돌려준다", () => {
    const result = monthlyFinished([finished({ finishedAt: "2026-03-15T00:00:00Z" })], "2026");
    expect(result).toHaveLength(12);
    expect(result.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("해당 월에 센다", () => {
    const result = monthlyFinished(
      [
        finished({ finishedAt: "2026-03-01T00:00:00Z" }),
        finished({ finishedAt: "2026-03-28T00:00:00Z" }),
        finished({ finishedAt: "2026-07-01T00:00:00Z" }),
      ],
      "2026",
    );
    expect(result[2].count).toBe(2);
    expect(result[6].count).toBe(1);
    expect(result[0].count).toBe(0);
  });

  it("다른 해는 섞이지 않는다", () => {
    const result = monthlyFinished([finished({ finishedAt: "2025-03-01T00:00:00Z" })], "2026");
    expect(result.every((m) => m.count === 0)).toBe(true);
  });
});

describe("categoryDistribution", () => {
  const readings = [
    finished({ categoryId: "c1", categoryName: "역사" }),
    finished({ categoryId: "c1", categoryName: "역사" }),
    finished({ categoryId: "c2", categoryName: "과학" }),
    finished({ categoryId: null, categoryName: null }),
  ];

  it("권수가 많은 것부터 정렬한다", () => {
    const result = categoryDistribution(readings, "2026");
    expect(result[0]).toMatchObject({ name: "역사", count: 2 });
  });

  // 빼버리면 도넛의 합이 완독 권수와 달라진다.
  it("분야를 안 고른 책도 '분야 없음'으로 센다", () => {
    const result = categoryDistribution(readings, "2026");
    const none = result.find((share) => share.id === null);
    expect(none).toMatchObject({ name: "분야 없음", count: 1 });
  });

  it("도넛 합이 완독 권수와 같다", () => {
    const result = categoryDistribution(readings, "2026");
    const sum = result.reduce((total, share) => total + share.count, 0);
    expect(sum).toBe(countFinishedInYear(readings, "2026"));
  });

  it("연도를 null로 주면 전체 기간을 센다", () => {
    const mixed = [
      finished({ finishedAt: "2026-01-01T00:00:00Z" }),
      finished({ finishedAt: "2025-01-01T00:00:00Z" }),
    ];
    expect(categoryDistribution(mixed, null)[0].count).toBe(2);
    expect(categoryDistribution(mixed, "2026")[0].count).toBe(1);
  });

  it("미완독은 분포에 넣지 않는다", () => {
    expect(categoryDistribution([finished({ finishedAt: null })], null)).toEqual([]);
  });
});

describe("averageRating", () => {
  it("별점을 매긴 책만 평균낸다", () => {
    const readings = [finished({ rating: 5 }), finished({ rating: 4 }), finished({ rating: null })];
    expect(averageRating(readings, "2026")).toBe(4.5);
  });

  it("소수 한 자리로 반올림한다", () => {
    const readings = [finished({ rating: 5 }), finished({ rating: 4 }), finished({ rating: 4 })];
    expect(averageRating(readings, "2026")).toBe(4.3);
  });

  it("매긴 책이 없으면 null", () => {
    expect(averageRating([finished({ rating: null })], "2026")).toBeNull();
    expect(averageRating([], "2026")).toBeNull();
  });
});

describe("totalMinutes / formatMinutes", () => {
  it("시간을 안 적은 기록은 0으로 본다", () => {
    expect(totalMinutes([log("2026-03-01", 30), log("2026-03-02", null)])).toBe(30);
  });

  it("연도로 거를 수 있다", () => {
    const entries = [log("2026-03-01", 30), log("2025-03-01", 100)];
    expect(totalMinutes(entries)).toBe(130);
    expect(totalMinutes(entries, "2026")).toBe(30);
  });

  it.each([
    [0, "0분"],
    [45, "45분"],
    [60, "1시간"],
    [90, "1시간 30분"],
    [1234, "20시간 34분"],
  ])("%i분 → %s", (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});

describe("currentStreak", () => {
  it("오늘부터 이어진 날을 센다", () => {
    const entries = [log("2026-08-01"), log("2026-07-31"), log("2026-07-30")];
    expect(currentStreak(entries, "2026-08-01")).toBe(3);
  });

  // 아침에 열었다고 어제까지의 연속이 0으로 보이면 안 된다.
  it("오늘 아직 안 적었어도 어제까지 이어졌으면 살아 있다", () => {
    const entries = [log("2026-07-31"), log("2026-07-30")];
    expect(currentStreak(entries, "2026-08-01")).toBe(2);
  });

  it("그제까지만 있으면 끊긴 것으로 본다", () => {
    expect(currentStreak([log("2026-07-30")], "2026-08-01")).toBe(0);
  });

  it("같은 날 여러 번 적어도 하루로 센다", () => {
    const entries = [log("2026-08-01"), log("2026-08-01"), log("2026-07-31")];
    expect(currentStreak(entries, "2026-08-01")).toBe(2);
  });

  it("중간이 비면 거기서 멈춘다", () => {
    const entries = [log("2026-08-01"), log("2026-07-31"), log("2026-07-28")];
    expect(currentStreak(entries, "2026-08-01")).toBe(2);
  });

  // 문자열로 하루를 빼므로 월·연 경계에서 틀리기 쉽다.
  it("월 경계를 넘는다", () => {
    const entries = [log("2026-08-01"), log("2026-07-31"), log("2026-07-30")];
    expect(currentStreak(entries, "2026-08-01")).toBe(3);
  });

  it("연 경계를 넘는다", () => {
    const entries = [log("2026-01-01"), log("2025-12-31"), log("2025-12-30")];
    expect(currentStreak(entries, "2026-01-01")).toBe(3);
  });

  it("윤년 2월 29일을 넘는다", () => {
    const entries = [log("2028-03-01"), log("2028-02-29"), log("2028-02-28")];
    expect(currentStreak(entries, "2028-03-01")).toBe(3);
  });

  it("기록이 없으면 0", () => {
    expect(currentStreak([], "2026-08-01")).toBe(0);
  });
});

describe("activeDays", () => {
  it("중복을 빼고 기록한 날 수를 센다", () => {
    const entries = [log("2026-08-01"), log("2026-08-01"), log("2026-07-20")];
    expect(activeDays(entries)).toBe(2);
  });

  it("연속이 아니어도 센다 — 스트릭과 다르다", () => {
    expect(activeDays([log("2026-01-01"), log("2026-08-01")])).toBe(2);
  });

  it("연도로 거를 수 있다", () => {
    expect(activeDays([log("2026-08-01"), log("2025-08-01")], "2026")).toBe(1);
  });
});

describe("goalProgress", () => {
  it("달성률을 백분율로 준다", () => {
    expect(goalProgress(6, 12)).toMatchObject({ percent: 50, remaining: 6, reached: false });
  });

  it("목표를 채우면 reached", () => {
    expect(goalProgress(12, 12)).toMatchObject({ percent: 100, remaining: 0, reached: true });
  });

  // 게이지가 밖으로 나가면 안 된다.
  it("목표를 넘겨도 100에서 멈추고 남은 양은 0", () => {
    expect(goalProgress(20, 12)).toMatchObject({ percent: 100, remaining: 0, reached: true });
  });

  it("목표가 0 이하면 0으로 처리한다", () => {
    expect(goalProgress(5, 0)).toMatchObject({ percent: 0, reached: false });
  });

  it("아직 아무것도 안 했으면 0%", () => {
    expect(goalProgress(0, 12).percent).toBe(0);
  });
});

describe("periodKeyFor / achievementFor", () => {
  it("기간키는 DB 제약과 같은 형식이다", () => {
    expect(periodKeyFor("year", "2026-08-01")).toBe("2026");
    expect(periodKeyFor("month", "2026-08-01")).toBe("2026-08");
  });

  const readings = [
    finished({ finishedAt: "2026-08-05T00:00:00Z" }),
    finished({ finishedAt: "2026-03-05T00:00:00Z" }),
    finished({ finishedAt: "2025-08-05T00:00:00Z" }),
  ];
  const entries = [log("2026-08-01", 60), log("2026-03-01", 30), log("2025-08-01", 500)];

  it("연간 · 권수", () => {
    expect(
      achievementFor({ period: "year", periodKey: "2026", metric: "books" }, readings, entries),
    ).toBe(2);
  });

  it("월간 · 권수", () => {
    expect(
      achievementFor({ period: "month", periodKey: "2026-08", metric: "books" }, readings, entries),
    ).toBe(1);
  });

  it("연간 · 시간", () => {
    expect(
      achievementFor({ period: "year", periodKey: "2026", metric: "minutes" }, readings, entries),
    ).toBe(90);
  });

  it("월간 · 시간", () => {
    expect(
      achievementFor(
        { period: "month", periodKey: "2026-08", metric: "minutes" },
        readings,
        entries,
      ),
    ).toBe(60);
  });

  it("해당 기간에 아무것도 없으면 0", () => {
    expect(
      achievementFor({ period: "year", periodKey: "2024", metric: "books" }, readings, entries),
    ).toBe(0);
  });
});

describe("타입 가드", () => {
  it("지표", () => {
    expect(isGoalMetric("books")).toBe(true);
    expect(isGoalMetric("minutes")).toBe(true);
    // PRD §3.1 F10에서 페이지는 제외했다.
    expect(isGoalMetric("pages")).toBe(false);
  });

  it("기간", () => {
    expect(isGoalPeriod("year")).toBe(true);
    expect(isGoalPeriod("week")).toBe(false);
  });
});

describe("donutSlices", () => {
  it("조각 수는 값 수와 같다", () => {
    expect(donutSlices([3, 2, 1])).toHaveLength(3);
  });

  it("비율의 합은 1이다", () => {
    const sum = donutSlices([3, 2, 1]).reduce((total, slice) => total + slice.ratio, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("비율을 백분율로도 준다", () => {
    expect(donutSlices([3, 1]).map((s) => s.percent)).toEqual([75, 25]);
  });

  it("전부 0이면 빈 배열 — 그릴 것이 없다", () => {
    expect(donutSlices([0, 0])).toEqual([]);
    expect(donutSlices([])).toEqual([]);
  });

  it("0인 조각은 path가 비고 자리만 지킨다", () => {
    const slices = donutSlices([5, 0]);
    expect(slices).toHaveLength(2);
    expect(slices[1].path).toBe("");
    expect(slices[1].ratio).toBe(0);
  });

  // SVG의 호는 시작점과 끝점이 같으면 아무것도 그리지 않는다.
  it("한 조각이 100%면 고리로 그린다 (빈 path가 아니다)", () => {
    const [slice] = donutSlices([7]);
    expect(slice.path).not.toBe("");
    expect(slice.percent).toBe(100);
    // 반원 두 개씩 바깥·안쪽 = 호 네 개
    expect(slice.path.match(/A /g)).toHaveLength(4);
  });

  it("반원을 넘는 조각은 large-arc 플래그를 세운다", () => {
    const [big] = donutSlices([3, 1]); // 75%
    expect(big.path).toMatch(/A 80 80 0 1 1/);
  });

  it("반원보다 작은 조각은 large-arc 플래그가 0이다", () => {
    const [small] = donutSlices([1, 3]); // 25%
    expect(small.path).toMatch(/A 80 80 0 0 1/);
  });

  it("음수는 0으로 본다", () => {
    expect(donutSlices([5, -3]).map((s) => s.percent)).toEqual([100, 0]);
  });

  it("크기와 두께를 바꿀 수 있다", () => {
    const [slice] = donutSlices([1, 1], { size: 100, thickness: 10 });
    // 바깥 반지름 50, 안쪽 40
    expect(slice.path).toContain("A 50 50");
    expect(slice.path).toContain("A 40 40");
  });
});

describe("barRatios", () => {
  it("가장 큰 값이 1이 된다", () => {
    expect(barRatios([1, 2, 4])).toEqual([0.25, 0.5, 1]);
  });

  // 1을 주면 완독이 없는 해에 막대가 꽉 차 보인다.
  it("전부 0이면 전부 0", () => {
    expect(barRatios([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("음수는 0으로 본다", () => {
    expect(barRatios([-1, 2])).toEqual([0, 1]);
  });

  it("빈 배열은 빈 배열", () => {
    expect(barRatios([])).toEqual([]);
  });
});
