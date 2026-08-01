import { seoulToday } from "@/lib/stats/aggregate";
import type { ProgressUnit } from "@/lib/reading-status";

/**
 * 이미 읽은 책을 소급 등록한다 (W13.5).
 *
 * 앱을 쓰기 전에 읽은 책들을 넣어야 통계가 의미를 갖는다. 등록하면서 바로
 * 완독으로 만들고, 완독 시점과 소감을 함께 받는다.
 *
 * **완독일은 년-월까지만 받는다.** 몇 년 전에 읽은 책의 날짜를 정확히
 * 기억하는 사람은 없다. 통계가 쓰는 축도 연도(countFinishedInYear)와
 * 월(monthlyFinished)뿐이라 일까지 받아봐야 쓰이지 않는다.
 */

/** DB에 저장할 시각. 그 달 1일 서울 자정으로 고정한다. */
export function monthToTimestamp(month: string): string {
  // 서울 기준을 명시한다. UTC 자정으로 넣으면 통계가 앞 달로 밀릴 수 있다.
  return `${month}-01T00:00:00+09:00`;
}

export type MonthCheck = { ok: true; month: string } | { ok: false; message: string };

/**
 * "YYYY-MM" 입력을 검증한다.
 *
 * `<input type="month">`가 이 형식을 주지만 파이어폭스 데스크톱처럼 지원하지
 * 않는 브라우저는 그냥 텍스트로 보낸다. 서버가 다시 본다.
 */
export function checkFinishedMonth(raw: string | null, today: string = seoulToday()): MonthCheck {
  const month = (raw ?? "").trim();

  if (month.length === 0) {
    return { ok: false, message: "완독한 연월을 입력하세요." };
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return { ok: false, message: "완독 시기는 YYYY-MM 형식이어야 합니다. (예: 2024-03)" };
  }

  // 아직 오지 않은 달에 읽었을 수는 없다.
  if (month > today.slice(0, 7)) {
    return { ok: false, message: "아직 오지 않은 달입니다." };
  }

  // 종이가 발명되기 전에 읽었을 리도 없다. 오타를 거르는 정도의 하한이다.
  if (month < "1900-01") {
    return { ok: false, message: "완독 시기가 너무 이릅니다." };
  }

  return { ok: true, month };
}

export type FinishedReadingInput = {
  status: "finished";
  progress_unit: ProgressUnit;
  target_value: number;
  current_value: number;
  started_at: string;
  finished_at: string;
};

/**
 * 소급 등록할 회차의 값.
 *
 * `started_at`을 완독 시점과 같게 둔다. 시작일을 모르기 때문이기도 하지만,
 * DB 제약(readings_started_ts)이 want가 아닌 상태에 시작일을 요구하기도 한다.
 * 그래서 "완독 소요일"은 이 책들에서 0으로 나온다 — 알 수 없는 값을 지어내는
 * 것보다 낫다.
 *
 * 진행률은 꽉 채운다. 다 읽은 책의 막대가 비어 있으면 안 된다.
 */
export function buildFinishedReading(input: {
  month: string;
  progress: { progress_unit: ProgressUnit; target_value: number };
}): FinishedReadingInput {
  const at = monthToTimestamp(input.month);

  return {
    status: "finished",
    progress_unit: input.progress.progress_unit,
    target_value: input.progress.target_value,
    current_value: input.progress.target_value,
    started_at: at,
    finished_at: at,
  };
}
