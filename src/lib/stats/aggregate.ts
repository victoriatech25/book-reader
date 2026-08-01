/**
 * 대시보드 통계 집계 (PRD §3.1 F9 · §2.4).
 *
 * SQL view가 아니라 앱에서 집계한다 — CLAUDE.md가 "통계 집계는 src/lib/에
 * 분리해 단위 테스트 대상으로" 하라고 못박고 있고, W10의 DoD도 V2(집계 결과
 * 검증)다. 규모가 수백 권이라 성능 문제도 없다.
 *
 * 날짜는 전부 서울 기준이다. 실행 환경의 시간대를 따라가면 12월 31일 밤에
 * 완독한 책이 서버와 브라우저에서 다른 해로 잡힌다.
 */

const SEOUL_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ISO 시각 → 서울 기준 "YYYY-MM-DD". 잘못된 값은 null. */
export function seoulDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // en-CA 로케일이 ISO 형식(YYYY-MM-DD)을 준다.
  return SEOUL_DATE.format(date);
}

/** 오늘(서울 기준) "YYYY-MM-DD". */
export function seoulToday(now: Date = new Date()): string {
  return SEOUL_DATE.format(now);
}

/** "2026-03-15" → "2026" */
export function yearPart(day: string): string {
  return day.slice(0, 4);
}

/** "2026-03-15" → 3 */
export function monthPart(day: string): number {
  return Number(day.slice(5, 7));
}

// ---------------------------------------------------------------------------
// 입력 모양 — DB 행을 평평하게 편 것
// ---------------------------------------------------------------------------
export type FinishedReading = {
  finishedAt: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categorySortOrder: number;
  rating: number | null;
};

export type ProgressEntry = {
  loggedOn: string;
  minutes: number | null;
};

// ---------------------------------------------------------------------------
// 완독 집계
// ---------------------------------------------------------------------------

/** 그 해에 완독한 권수. */
export function countFinishedInYear(readings: FinishedReading[], year: string): number {
  return readings.filter((reading) => {
    const day = seoulDate(reading.finishedAt);
    return day !== null && yearPart(day) === year;
  }).length;
}

export type MonthlyCount = { month: number; count: number };

/**
 * 월별 완독 추이. 1월부터 12월까지 **빠짐없이** 돌려준다.
 *
 * 기록이 없는 달을 빼면 막대 그래프에 구멍이 생기는 게 아니라 달이 밀린다.
 */
export function monthlyFinished(readings: FinishedReading[], year: string): MonthlyCount[] {
  const counts = new Array<number>(12).fill(0);

  for (const reading of readings) {
    const day = seoulDate(reading.finishedAt);
    if (day === null || yearPart(day) !== year) continue;
    counts[monthPart(day) - 1] += 1;
  }

  return counts.map((count, index) => ({ month: index + 1, count }));
}

export type CategoryShare = {
  id: string | null;
  name: string;
  color: string | null;
  sortOrder: number;
  count: number;
};

/**
 * 분야 분포. 권수가 많은 것부터.
 *
 * 분야를 안 고른 책도 "분야 없음"으로 센다. 빼버리면 도넛의 합이 완독 권수와
 * 달라져서 "올해 12권 읽었는데 도넛은 9권"이 된다.
 */
export function categoryDistribution(
  readings: FinishedReading[],
  year: string | null,
): CategoryShare[] {
  const shares = new Map<string, CategoryShare>();

  for (const reading of readings) {
    const day = seoulDate(reading.finishedAt);
    if (day === null) continue;
    if (year !== null && yearPart(day) !== year) continue;

    const key = reading.categoryId ?? "";
    const existing = shares.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    shares.set(key, {
      id: reading.categoryId,
      name: reading.categoryName ?? "분야 없음",
      color: reading.categoryColor,
      // 분야 없음은 팔레트 끝쪽 색을 쓰도록 큰 값을 준다.
      sortOrder: reading.categoryId === null ? 999 : reading.categorySortOrder,
      count: 1,
    });
  }

  return [...shares.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko-KR"),
  );
}

/** 평균 별점. 별점을 매긴 책만 센다. 없으면 null. */
export function averageRating(readings: FinishedReading[], year: string | null): number | null {
  const rated = readings.filter((reading) => {
    if (reading.rating === null) return false;
    const day = seoulDate(reading.finishedAt);
    if (day === null) return false;
    return year === null || yearPart(day) === year;
  });

  if (rated.length === 0) return null;

  const sum = rated.reduce((total, reading) => total + (reading.rating ?? 0), 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// 독서 시간 · 스트릭
// ---------------------------------------------------------------------------

/**
 * 총 독서 시간(분). 시간을 안 적은 기록은 0으로 본다.
 *
 * 통계의 주 지표가 권수 + 시간이다 (PRD §2.1 C). 총 페이지는 전자책 비중
 * 탓에 실제 독서량을 왜곡해서 쓰지 않는다.
 */
export function totalMinutes(entries: ProgressEntry[], year: string | null = null): number {
  return entries.reduce((total, entry) => {
    if (year !== null && yearPart(entry.loggedOn) !== year) return total;
    return total + (entry.minutes ?? 0);
  }, 0);
}

/** "1234분" → "20시간 34분" */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0분";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  if (rest === 0) return `${hours}시간`;
  return `${hours}시간 ${rest}분`;
}

/** "YYYY-MM-DD"에서 하루 뺀 날. 시간대에 기대지 않고 문자열로 계산한다. */
function previousDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  // UTC로 만들어 계산하면 서머타임·시간대 이동의 영향을 받지 않는다.
  const stamp = Date.UTC(year, month - 1, date) - 24 * 60 * 60 * 1000;
  return new Date(stamp).toISOString().slice(0, 10);
}

/**
 * 연속 기록 일수 (PRD §2.4).
 *
 * 오늘 아직 기록하지 않았어도 어제까지 이어졌으면 스트릭은 살아 있다 —
 * 아침에 대시보드를 열었다고 어제까지의 연속이 0으로 보이면 안 된다.
 * 대신 그제까지만 있으면 끊긴 것으로 본다.
 */
export function currentStreak(entries: ProgressEntry[], today: string): number {
  const days = new Set(entries.map((entry) => entry.loggedOn));
  if (days.size === 0) return 0;

  const yesterday = previousDay(today);

  let cursor: string;
  if (days.has(today)) cursor = today;
  else if (days.has(yesterday)) cursor = yesterday;
  else return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }

  return streak;
}

/** 기록한 날 수(중복 제외). 스트릭과 달리 연속이 아니어도 센다. */
export function activeDays(entries: ProgressEntry[], year: string | null = null): number {
  const days = new Set<string>();
  for (const entry of entries) {
    if (year !== null && yearPart(entry.loggedOn) !== year) continue;
    days.add(entry.loggedOn);
  }
  return days.size;
}

// ---------------------------------------------------------------------------
// 목표 (PRD §3.1 F10)
// ---------------------------------------------------------------------------
export const GOAL_METRICS = ["books", "minutes"] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

export const GOAL_PERIODS = ["year", "month"] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const GOAL_METRIC_LABEL: Record<GoalMetric, string> = {
  books: "권수",
  minutes: "독서 시간(분)",
};

export const GOAL_PERIOD_LABEL: Record<GoalPeriod, string> = {
  year: "연간",
  month: "월간",
};

export function isGoalMetric(value: unknown): value is GoalMetric {
  return typeof value === "string" && (GOAL_METRICS as readonly string[]).includes(value);
}

export function isGoalPeriod(value: unknown): value is GoalPeriod {
  return typeof value === "string" && (GOAL_PERIODS as readonly string[]).includes(value);
}

/** 오늘이 속한 기간키. year → "2026", month → "2026-08". DB 제약과 같은 형식. */
export function periodKeyFor(period: GoalPeriod, today: string): string {
  return period === "year" ? yearPart(today) : today.slice(0, 7);
}

export type GoalProgress = {
  achieved: number;
  target: number;
  /** 0~100. 넘겨도 100에서 멈춘다 — 게이지가 밖으로 나가면 안 된다. */
  percent: number;
  /** 남은 양. 이미 넘었으면 0. */
  remaining: number;
  reached: boolean;
};

export function goalProgress(achieved: number, target: number): GoalProgress {
  if (target <= 0) {
    return { achieved, target, percent: 0, remaining: 0, reached: false };
  }

  return {
    achieved,
    target,
    percent: Math.min(100, Math.round((achieved / target) * 100)),
    remaining: Math.max(0, target - achieved),
    reached: achieved >= target,
  };
}

/**
 * 목표가 가리키는 실제 달성값.
 *
 * 기간(연/월)과 지표(권수/시간)의 네 조합을 한 곳에서 푼다. 화면마다 따로
 * 계산하면 어긋난다.
 */
export function achievementFor(
  goal: { period: GoalPeriod; periodKey: string; metric: GoalMetric },
  readings: FinishedReading[],
  entries: ProgressEntry[],
): number {
  const inPeriod = (day: string) =>
    goal.period === "year" ? yearPart(day) === goal.periodKey : day.slice(0, 7) === goal.periodKey;

  if (goal.metric === "books") {
    return readings.filter((reading) => {
      const day = seoulDate(reading.finishedAt);
      return day !== null && inPeriod(day);
    }).length;
  }

  return entries.reduce(
    (total, entry) => (inPeriod(entry.loggedOn) ? total + (entry.minutes ?? 0) : total),
    0,
  );
}
