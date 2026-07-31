import { describe, expect, it } from "vitest";

import {
  checkMinutes,
  checkProgress,
  formatDelta,
  formatProgress,
  planUnitChange,
  progressDelta,
  progressPercent,
} from "@/lib/progress";

describe("progressPercent", () => {
  it.each([
    [0, 100, 0],
    [30, 100, 30],
    [100, 100, 100],
    [120, 480, 25],
    [1, 3, 33],
    [2, 3, 67],
  ])("%i / %i → %i%%", (current, target, expected) => {
    expect(progressPercent(current, target)).toBe(expected);
  });

  it("분량을 모르면 0으로 본다 — 나누기가 성립하지 않는다", () => {
    expect(progressPercent(50, null)).toBe(0);
    expect(progressPercent(50, 0)).toBe(0);
  });

  it("분량을 넘겨도 100을 넘지 않는다", () => {
    expect(progressPercent(500, 480)).toBe(100);
  });
});

describe("formatProgress", () => {
  it("전자책은 퍼센트로 적는다", () => {
    expect(formatProgress(30, "percent", 100)).toBe("30%");
  });

  it("종이책은 현재쪽/전체쪽으로 적는다", () => {
    expect(formatProgress(120, "page", 480)).toBe("120 / 480쪽");
  });

  it("전체 쪽수를 모르면 물음표로 둔다", () => {
    expect(formatProgress(120, "page", null)).toBe("120 / ?쪽");
  });
});

describe("checkProgress", () => {
  const percent = { current: 30, target: 100, unit: "percent" } as const;
  const page = { current: 120, target: 480, unit: "page" } as const;

  it("앞으로 나아간 값은 통과한다", () => {
    expect(checkProgress({ ...percent, value: 45 })).toEqual({ ok: true, backward: false });
  });

  it("같은 값도 통과한다 — 읽었지만 진도가 안 나간 날이 있다", () => {
    expect(checkProgress({ ...percent, value: 30 })).toEqual({ ok: true, backward: false });
  });

  // 되돌아가는 입력은 막지 않는다. 잘못 적은 값을 고치는 정당한 경우가 있다.
  it("되돌아간 값은 통과시키되 backward로 표시한다", () => {
    expect(checkProgress({ ...percent, value: 20 })).toEqual({ ok: true, backward: true });
  });

  it("0은 허용한다", () => {
    expect(checkProgress({ ...percent, value: 0 })).toEqual({ ok: true, backward: true });
  });

  it("음수는 거부한다", () => {
    const result = checkProgress({ ...percent, value: -1 });
    expect(result).toEqual({ ok: false, message: "진행 값은 0 이상이어야 합니다." });
  });

  it("소수는 거부한다", () => {
    expect(checkProgress({ ...percent, value: 30.5 })).toEqual({
      ok: false,
      message: "진행 값은 정수로 입력하세요.",
    });
  });

  it("숫자가 아니면 거부한다", () => {
    expect(checkProgress({ ...percent, value: Number.NaN })).toEqual({
      ok: false,
      message: "진행 값을 숫자로 입력하세요.",
    });
  });

  it("퍼센트가 100을 넘으면 단위에 맞는 문장으로 거부한다", () => {
    expect(checkProgress({ ...percent, value: 101 })).toEqual({
      ok: false,
      message: "진행률은 100%를 넘을 수 없습니다.",
    });
  });

  it("페이지가 전체를 넘으면 전체 쪽수를 알려주며 거부한다", () => {
    expect(checkProgress({ ...page, value: 481 })).toEqual({
      ok: false,
      message: "전체 480쪽을 넘을 수 없습니다.",
    });
  });

  it("분량을 모르면 상한을 걸지 않는다", () => {
    expect(checkProgress({ current: 0, target: null, unit: "page", value: 9999 })).toEqual({
      ok: true,
      backward: false,
    });
  });
});

describe("checkMinutes", () => {
  it("입력하지 않아도 된다", () => {
    expect(checkMinutes(null)).toEqual({ ok: true });
  });

  it.each([1, 25, 1440])("%i분은 허용한다", (minutes) => {
    expect(checkMinutes(minutes)).toEqual({ ok: true });
  });

  it("0분 이하는 거부한다", () => {
    expect(checkMinutes(0)).toEqual({
      ok: false,
      message: "읽은 시간은 1분 이상이어야 합니다.",
    });
  });

  // DB 제약(progress_logs_minutes)과 같은 상한을 쓴다.
  it("하루를 넘으면 거부한다", () => {
    expect(checkMinutes(1441)).toEqual({
      ok: false,
      message: "읽은 시간은 하루(1440분)를 넘을 수 없습니다.",
    });
  });

  it.each([12.5, Number.NaN])("%s 는 거부한다", (minutes) => {
    expect(checkMinutes(minutes)).toEqual({
      ok: false,
      message: "읽은 시간은 분 단위 정수로 입력하세요.",
    });
  });
});

describe("progressDelta / formatDelta", () => {
  it("증가분을 계산한다", () => {
    expect(progressDelta(30, 45)).toBe(15);
    expect(progressDelta(null, 30)).toBe(30);
  });

  it("되돌린 기록은 음수가 된다", () => {
    expect(progressDelta(45, 30)).toBe(-15);
  });

  it("단위에 맞춰 표기한다", () => {
    expect(formatDelta(30, 45, "percent")).toBe("30% → 45%");
    expect(formatDelta(120, 180, "page")).toBe("120 → 180쪽");
    expect(formatDelta(null, 30, "percent")).toBe("0% → 30%");
  });
});

describe("planUnitChange", () => {
  const base = {
    to: "page",
    from: "percent",
    status: "reading",
    totalPages: 320,
    logCount: 0,
  } as const;

  it("기록이 없으면 %에서 쪽으로 바꾼다 — 분량은 책의 페이지수가 된다", () => {
    expect(planUnitChange(base)).toEqual({
      ok: true,
      progress_unit: "page",
      target_value: 320,
      current_value: 0,
    });
  });

  it("쪽에서 %로 되돌리면 분량은 항상 100이다 (DB 제약 readings_percent_target)", () => {
    expect(planUnitChange({ ...base, to: "percent", from: "page" })).toEqual({
      ok: true,
      progress_unit: "percent",
      target_value: 100,
      current_value: 0,
    });
  });

  it("같은 단위로는 바꾸지 않는다", () => {
    const result = planUnitChange({ ...base, to: "percent", from: "percent" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("이미");
  });

  it.each(["finished", "dropped"] as const)("%s 회차의 단위는 바꿀 수 없다", (status) => {
    const result = planUnitChange({ ...base, status });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("끝난 회차");
  });

  it("진행 기록이 있으면 거부하고 건수를 알려준다 — 지난 기록이 다른 눈금으로 읽힌다", () => {
    const result = planUnitChange({ ...base, logCount: 7 });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("7건");
  });

  it("기록이 있으면 되돌리는 방향도 막는다", () => {
    expect(planUnitChange({ ...base, to: "percent", from: "page", logCount: 1 }).ok).toBe(false);
  });

  it.each([null, 0])("페이지수가 %s 이면 쪽 단위로 못 바꾼다", (totalPages) => {
    const result = planUnitChange({ ...base, totalPages });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("페이지수");
  });

  it("페이지수가 없어도 %로 되돌리는 것은 막지 않는다", () => {
    expect(planUnitChange({ ...base, to: "percent", from: "page", totalPages: null }).ok).toBe(
      true,
    );
  });

  it("want·paused 회차도 바꿀 수 있다 — 아직 안 끝났으면 기록 전이다", () => {
    expect(planUnitChange({ ...base, status: "want" }).ok).toBe(true);
    expect(planUnitChange({ ...base, status: "paused" }).ok).toBe(true);
  });
});
