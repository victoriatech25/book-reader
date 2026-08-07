import type { ProgressUnit, ReadingStatus } from "./reading-status";

/**
 * 진행률 계산과 입력 검증.
 *
 * DB의 record_progress()도 범위를 막지만, 사용자는 Postgres 에러가 아니라
 * 한국어 문장을 봐야 한다. 순수 함수로 두어 폼과 서버 액션이 함께 쓴다.
 */

/** 진행률(%). target이 없거나 0이면 0으로 본다. */
export function progressPercent(current: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

/** 화면에 보여줄 진행 표기. 단위에 따라 다르다. */
export function formatProgress(value: number, unit: ProgressUnit, target: number | null): string {
  return unit === "page" ? `${value} / ${target ?? "?"}쪽` : `${value}%`;
}

/**
 * 남은 분량 표기. 모르면 null이고, 그 경우 화면에서는 아무것도 그리지 않는다.
 *
 * formatProgress 옆에 퍼센트를 같이 놓으면 percent 단위에서 같은 숫자가 두 번
 * 나온다("42% … 42%"). 남은 양은 어느 단위에서도 진행 표기와 겹치지 않는다.
 *
 * 남은 분량이 0이어도 "완독"이라고 쓰지 않는다. 완독은 명시적 행위이고
 * 진행률 100%는 완독이 아니다 (PRD §2.1).
 */
export function formatRemaining(
  value: number,
  unit: ProgressUnit,
  target: number | null,
): string | null {
  if (!target || target <= 0) return null;

  const left = Math.max(0, target - value);
  if (left === 0) return "남은 분량 없음";

  return unit === "page" ? `${left}쪽 남음` : `${left}% 남음`;
}

export const PROGRESS_UNIT_LABEL: Record<ProgressUnit, string> = {
  percent: "퍼센트",
  page: "페이지",
};

export type ProgressCheck = { ok: true; backward: boolean } | { ok: false; message: string };

/**
 * 진행 값 검증.
 *
 * 되돌아가는 입력(backward)은 막지 않는다 — 잘못 기록한 값을 고치는 정당한
 * 경우가 있다. 대신 사고인지 확인할 수 있도록 표시만 남긴다.
 */
export function checkProgress(input: {
  value: number;
  current: number;
  target: number | null;
  unit: ProgressUnit;
}): ProgressCheck {
  const { value, current, target, unit } = input;

  if (!Number.isFinite(value)) {
    return { ok: false, message: "진행 값을 숫자로 입력하세요." };
  }

  if (!Number.isInteger(value)) {
    return { ok: false, message: "진행 값은 정수로 입력하세요." };
  }

  if (value < 0) {
    return { ok: false, message: "진행 값은 0 이상이어야 합니다." };
  }

  if (target !== null && value > target) {
    return {
      ok: false,
      message:
        unit === "percent"
          ? "진행률은 100%를 넘을 수 없습니다."
          : `전체 ${target}쪽을 넘을 수 없습니다.`,
    };
  }

  return { ok: true, backward: value < current };
}

export type MinutesCheck = { ok: true } | { ok: false; message: string };

/** 읽은 시간(분). DB 제약(1~1440)과 같은 범위를 쓴다. */
export function checkMinutes(minutes: number | null): MinutesCheck {
  if (minutes === null) return { ok: true };

  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
    return { ok: false, message: "읽은 시간은 분 단위 정수로 입력하세요." };
  }

  if (minutes < 1) {
    return { ok: false, message: "읽은 시간은 1분 이상이어야 합니다." };
  }

  if (minutes > 1440) {
    return { ok: false, message: "읽은 시간은 하루(1440분)를 넘을 수 없습니다." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 진행률 단위 변경 (PRD §3.1 F3 "단위는 format에 따라 자동 결정, 수동 변경 가능")
// ---------------------------------------------------------------------------

export type UnitChangePlan =
  | { ok: true; progress_unit: ProgressUnit; target_value: number; current_value: number }
  | { ok: false; message: string };

/**
 * 회차의 진행률 단위를 바꿀 수 있는지 판정하고, 바꾼다면 어떤 값이 되는지 계산한다.
 *
 * 지금까지는 단위가 등록 시점에 정해지면 바꿀 방법이 아예 없었다. 종이책을
 * 페이지수 없이 담으면 %로 굳어버려서, 나중에 페이지수를 채워도 그 회차는
 * 계속 %였다.
 *
 * 진행 기록이 이미 있으면 거부한다. progress_logs에는 단위 컬럼이 없어서
 * (value_from/value_to가 소속 reading의 단위를 따른다) 단위를 바꾸면 과거
 * 기록이 다른 눈금으로 잘못 읽힌다. 환산해서 덮어쓰는 방법도 있지만 그건
 * 실제 기록을 고치는 일이고, 스키마에 단위를 남기는 편이 옳다 — 마이그레이션이
 * 필요하므로 여기서는 기록이 없는 회차로 범위를 좁혔다.
 */
export function planUnitChange(input: {
  to: ProgressUnit;
  from: ProgressUnit;
  status: ReadingStatus;
  totalPages: number | null;
  logCount: number;
}): UnitChangePlan {
  const { to, from, status, totalPages, logCount } = input;

  if (to === from) {
    return { ok: false, message: `이미 ${PROGRESS_UNIT_LABEL[to]} 단위로 기록하고 있습니다.` };
  }

  if (status === "finished" || status === "dropped") {
    return { ok: false, message: "끝난 회차의 단위는 바꿀 수 없습니다." };
  }

  if (logCount > 0) {
    return {
      ok: false,
      message:
        `이미 진행 기록이 ${logCount}건 있어 단위를 바꿀 수 없습니다. ` +
        "지난 기록이 다른 눈금으로 읽히게 됩니다.",
    };
  }

  if (to === "page") {
    if (!totalPages || totalPages <= 0) {
      return {
        ok: false,
        message: "페이지수가 없습니다. 도서 수정에서 페이지수를 먼저 채워주세요.",
      };
    }
    return { ok: true, progress_unit: "page", target_value: totalPages, current_value: 0 };
  }

  // percent 단위의 분량은 항상 100이다 (DB 제약 readings_percent_target).
  return { ok: true, progress_unit: "percent", target_value: 100, current_value: 0 };
}

/** 진행 기록 한 줄의 증가분. 되돌린 기록은 음수가 된다. */
export function progressDelta(valueFrom: number | null, valueTo: number): number {
  return valueTo - (valueFrom ?? 0);
}

/** 타임라인 한 줄 표기: "30% → 45%" / "120 → 180쪽" */
export function formatDelta(valueFrom: number | null, valueTo: number, unit: ProgressUnit): string {
  const from = valueFrom ?? 0;
  return unit === "page" ? `${from} → ${valueTo}쪽` : `${from}% → ${valueTo}%`;
}
